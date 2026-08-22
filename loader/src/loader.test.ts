import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { Loader } from "./loader.js";

const TEMP_DIR = path.resolve("./test-temp-dir");

async function setupTempDir() {
	await fs.rm(TEMP_DIR, { recursive: true, force: true });
	await fs.mkdir(TEMP_DIR, { recursive: true });
}

async function cleanupTempDir() {
	await fs.rm(TEMP_DIR, { recursive: true, force: true });
}

function waitForEvent(loader: Loader, event: "reload" | "load" | "unload", timeoutMs = 2_000): Promise<void> {
	return new Promise((resolve, reject) => {
		let timeout: NodeJS.Timeout;
		const listener = () => {
			clearTimeout(timeout);
			loader.off(event, listener);
			resolve();
		};

		timeout = setTimeout(() => {
			loader.off(event, listener);
			reject(new Error(`Timed out waiting for loader ${event}.`));
		}, timeoutMs);

		loader.once(event, listener);
	});
}

test.describe("Loader Lifecycle", () => {
	test.beforeEach(setupTempDir);
	test.afterEach(cleanupTempDir);

	test("should load a simple module", async () => {
		const filePath = path.join(TEMP_DIR, "simple.js");
		await fs.writeFile(filePath, "export default { val: 42 };");
		const loader = new Loader({ extensions: [".js"] });
		try {
			const result = await loader.load(filePath);
			assert.equal(result.loaded.length, 1);
			assert.equal(result.failed.length, 0);
			assert.deepEqual(loader.get("simple"), { val: 42 });
		} finally { await loader.destroy(); }
	});

	test("should execute init lifecycle function", async () => {
		const filePath = path.join(TEMP_DIR, "init-test.js");
		await fs.writeFile(filePath, `export default { initialized: false, init() { this.initialized = true; } };`);
		const loader = new Loader({ extensions: [".js"], init: true });
		try {
			await loader.load(filePath);
			assert.equal((loader.get("init-test") as { initialized: boolean }).initialized, true);
		} finally { await loader.destroy(); }
	});

	test("should bind and unbind event listeners", async () => {
		const emitter = new EventEmitter();
		const filePath = path.join(TEMP_DIR, "events-test.js");
		await fs.writeFile(filePath, `export default { triggered: 0, onEvent() { this.triggered++; } };`);
		const loader = new Loader({ extensions: [".js"], events: emitter, on: { testEvent: "onEvent" } });
		try {
			await loader.load(filePath);
			const module = loader.get("events-test") as { triggered: number };
			emitter.emit("testEvent");
			assert.equal(module.triggered, 1);
			await loader.unload("events-test");
			emitter.emit("testEvent");
			assert.equal(module.triggered, 1);
		} finally { await loader.destroy(); }
	});

	test("should bind once listeners", async () => {
		const emitter = new EventEmitter();
		const filePath = path.join(TEMP_DIR, "once-test.js");
		await fs.writeFile(filePath, `export default { triggered: 0, onEvent() { this.triggered++; } };`);
		const loader = new Loader({ extensions: [".js"], events: emitter, once: { testEvent: "onEvent" } });
		try {
			await loader.load(filePath);
			const module = loader.get("once-test") as { triggered: number };
			emitter.emit("testEvent");
			emitter.emit("testEvent");
			assert.equal(module.triggered, 1);
		} finally { await loader.destroy(); }
	});

	test("should cleanup a partially bound event set", async () => {
		const emitter = new EventEmitter();
		const filePath = path.join(TEMP_DIR, "bad-events.js");
		await fs.writeFile(filePath, `export default { onGood() {} };`);
		const loader = new Loader({ extensions: [".js"], events: emitter, on: { good: "onGood", bad: "missingHandler" }, throwOnError: false });
		try {
			const result = await loader.load(filePath);
			assert.equal(result.failed.length, 1);
			assert.equal(emitter.listenerCount("good"), 0);
		} finally { await loader.destroy(); }
	});

	test("should abort signal on unload", async () => {
		const filePath = path.join(TEMP_DIR, "abort-test.js");
		await fs.writeFile(filePath, `export default { aborted: false, init(ctx) { ctx.signal.addEventListener("abort", () => { this.aborted = true; }); } };`);
		const loader = new Loader({ extensions: [".js"], init: true });
		try {
			await loader.load(filePath);
			const module = loader.get("abort-test") as { aborted: boolean };
			assert.equal(module.aborted, false);
			await loader.unload("abort-test");
			assert.equal(module.aborted, true);
		} finally { await loader.destroy(); }
	});

	test("should watch directory and reload changes", async () => {
		const dirPath = path.join(TEMP_DIR, "watch-dir");
		const filePath = path.join(dirPath, "watch-file.js");
		await fs.mkdir(dirPath, { recursive: true });
		await fs.writeFile(filePath, "export default { version: 1 };");
		const loader = new Loader({ extensions: [".js"], watch: true, debounce: 50 });
		try {
			await loader.load(dirPath);
			assert.deepEqual(loader.get("watch-file"), { version: 1 });
			const reloaded = waitForEvent(loader, "reload");
			await fs.writeFile(filePath, "export default { version: 2 };");
			await reloaded;
			assert.deepEqual(loader.get("watch-file"), { version: 2 });
		} finally { await loader.destroy(); }
	});

	test("should watch a single file", async () => {
		const filePath = path.join(TEMP_DIR, "single-watch.js");
		await fs.writeFile(filePath, "export default { version: 1 };");
		const loader = new Loader({ extensions: [".js"], watch: true, debounce: 50 });
		try {
			await loader.load(filePath);
			const reloaded = waitForEvent(loader, "reload");
			await fs.writeFile(filePath, "export default { version: 2 };");
			await reloaded;
			assert.deepEqual(loader.get("single-watch"), { version: 2 });
		} finally { await loader.destroy(); }
	});

	test("should keep the old module when reload fails", async () => {
		const dirPath = path.join(TEMP_DIR, "atomic");
		const filePath = path.join(dirPath, "atomic.js");
		await fs.mkdir(dirPath, { recursive: true });
		await fs.writeFile(filePath, "export default { version: 1 };");
		const errors: Error[] = [];
		const loader = new Loader({ extensions: [".js"], watch: true, debounce: 50 });
		loader.on("error", (error) => errors.push(error));
		try {
			await loader.load(dirPath);
			await fs.writeFile(filePath, "export default { version: ;");
			await new Promise((resolve) => setTimeout(resolve, 150));
			assert.deepEqual(loader.get("atomic"), { version: 1 });
			assert.ok(errors.length > 0);
			const reloaded = waitForEvent(loader, "reload");
			await fs.writeFile(filePath, "export default { version: 2 };");
			await reloaded;
			assert.deepEqual(loader.get("atomic"), { version: 2 });
		} finally { await loader.destroy(); }
	});

	test("should load new files with the watch root options", async () => {
		const dirPath = path.join(TEMP_DIR, "new-file");
		const filePath = path.join(dirPath, "new.js");
		await fs.mkdir(dirPath, { recursive: true });
		const loader = new Loader({ extensions: [".js"], watch: true, debounce: 50, init: true });
		try {
			await loader.load(dirPath);
			await fs.writeFile(filePath, `export default { initialized: false, init() { this.initialized = true; } };`);
			await new Promise((resolve) => setTimeout(resolve, 150));
			assert.equal((loader.get("new") as { initialized: boolean }).initialized, true);
		} finally { await loader.destroy(); }
	});
});

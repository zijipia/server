import test from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { Loader } from "./loader.js";

const TEMP_DIR = path.resolve("./test-temp-dir");

async function setupTempDir() {
	await fs.mkdir(TEMP_DIR, { recursive: true });
}

async function cleanupTempDir() {
	await fs.rm(TEMP_DIR, { recursive: true, force: true });
}

test.describe("Loader Lifecycle", () => {
	test.beforeEach(setupTempDir);
	test.afterEach(cleanupTempDir);

	test("should load a simple module", async () => {
		const filePath = path.join(TEMP_DIR, "simple.js");
		await fs.writeFile(filePath, "export default { val: 42 };");

		const loader = new Loader({
			extensions: [".js"],
		});

		const result = await loader.load(filePath);
		assert.strictEqual(result.loaded.length, 1);
		assert.strictEqual(result.failed.length, 0);

		const module = loader.get("simple");
		assert.deepStrictEqual(module, { val: 42 });
	});

	test("should execute init lifecycle function", async () => {
		const filePath = path.join(TEMP_DIR, "init-test.js");
		await fs.writeFile(
			filePath,
			`export default {
				initialized: false,
				init(ctx) {
					this.initialized = true;
				}
			};`,
		);

		const loader = new Loader({
			extensions: [".js"],
			init: true,
		});

		await loader.load(filePath);
		const module: any = loader.get("init-test");
		assert.strictEqual(module.initialized, true);
	});

	test("should bind/unbind event listeners", async () => {
		const emitter = new EventEmitter();
		const filePath = path.join(TEMP_DIR, "events-test.js");
		await fs.writeFile(
			filePath,
			`export default {
				triggered: 0,
				onEvent() {
					this.triggered++;
				}
			};`,
		);

		const loader = new Loader({
			extensions: [".js"],
			events: emitter,
			on: {
				testEvent: "onEvent",
			},
		});

		await loader.load(filePath);
		emitter.emit("testEvent");

		const module: any = loader.get("events-test");
		assert.strictEqual(module.triggered, 1);

		// Unload should unbind the event listener
		await loader.unload("events-test");
		emitter.emit("testEvent");
		assert.strictEqual(module.triggered, 1);
	});

	test("should abort signal on unload/reload", async () => {
		const filePath = path.join(TEMP_DIR, "abort-test.js");
		await fs.writeFile(
			filePath,
			`export default {
				aborted: false,
				init(ctx) {
					ctx.signal.addEventListener("abort", () => {
						this.aborted = true;
					});
				}
			};`,
		);

		const loader = new Loader({
			extensions: [".js"],
			init: true,
		});

		await loader.load(filePath);
		const module: any = loader.get("abort-test");
		assert.strictEqual(module.aborted, false);

		await loader.unload("abort-test");
		assert.strictEqual(module.aborted, true);
	});

	test("should watch directory and reload changes", async () => {
		const dirPath = path.join(TEMP_DIR, "watch-dir");
		await fs.mkdir(dirPath, { recursive: true });

		const filePath = path.join(dirPath, "watch-file.js");
		await fs.writeFile(filePath, "export default { version: 1 };");

		const loader = new Loader({
			extensions: [".js"],
			watch: true,
			debounce: 50,
		});

		await loader.load(dirPath);
		assert.deepStrictEqual(loader.get("watch-file"), { version: 1 });

		// Listen to the reload event
		let reloaded = false;
		loader.on("reload", () => {
			reloaded = true;
		});

		// Modify file content
		await fs.writeFile(filePath, "export default { version: 2 };");

		// Wait for debounce and watch reload to execute
		await new Promise((resolve) => setTimeout(resolve, 200));

		assert.strictEqual(reloaded, true);
		assert.deepStrictEqual(loader.get("watch-file"), { version: 2 });

		await loader.destroy();
	});
});

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
		} finally {
			await loader.destroy();
		}
	});

	test("should execute init lifecycle function", async () => {
		const filePath = path.join(TEMP_DIR, "init-test.js");
		await fs.writeFile(
			filePath,
			`export default {
				initialized: false,
				init() {
					this.initialized = true;
				}
			};`,
		);

		const loader = new Loader({ extensions: [".js"], init: true });

		try {
			await loader.load(filePath);
			const module = loader.get("init-test") as { initialized: boolean };
			assert.equal(module.initialized, true);
		} finally {
			await loader.destroy();
		}
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
			on: { testEvent: "onEvent" },
		});

		try {
			await loader.load(filePath);
			emitter.emit("testEvent");

			const module = loader.get("events-test") as { triggered: number };
			assert.equal(module.triggered, 1);

			await loader.unload("events-test");
			emitter.emit("testEvent");
			assert.equal(module.triggered, 1);
		} finally {
			await loader.destroy();
		}
	});

	test("should abort signal on unload", async () => {
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

		const loader = new Loader({ extensions: [".js"], init: true });

		try {
			await loader.load(filePath);
			const module = loader.get("abort-test") as { aborted: boolean };
			assert.equal(module.aborted, false);

			await loader.unload("abort-test");
			assert.equal(module.aborted, true);
		} finally {
			await loader.destroy();
		}
	});

	test("should watch directory and reload changes", async () => {
		const dirPath = path.join(TEMP_DIR, "watch-dir");
		const filePath = path.join(dirPath, "watch-file.js");

		await fs.mkdir(dirPath, { recursive: true });
		await fs.writeFile(filePath, "export default { version: 1 };");

		const loader = new Loader({
			extensions: [".js"],
			watch: true,
			debounce: 50,
		});

		try {
			await loader.load(dirPath);
			assert.deepEqual(loader.get("watch-file"), { version: 1 });

			const reloadPromise = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					loader.off("reload", onReload);
					reject(new Error("Timed out waiting for loader reload."));
				}, 2_000);

				const onReload = () => {
					clearTimeout(timeout);
					loader.off("reload", onReload);
					resolve();
				};

				loader.once("reload", onReload);
			});

			await fs.writeFile(filePath, "export default { version: 2 };");
			await reloadPromise;

			assert.deepEqual(loader.get("watch-file"), { version: 2 });
		} finally {
			await loader.destroy();
		}
	});
});

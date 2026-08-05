import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { Loader } from "../src/loader";

const TEMP_DIR = path.resolve(__dirname, "tmp-loader");

async function writeFile(filePath: string, content: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, content, "utf8");
}

async function removeDir(directory: string): Promise<void> {
	try {
		await fs.rm(directory, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

describe("Loader", () => {
	beforeEach(async () => {
		await removeDir(TEMP_DIR);
		await fs.mkdir(TEMP_DIR, { recursive: true });
	});

	afterEach(async () => {
		await removeDir(TEMP_DIR);
	});

	it("loads modules from a directory", async () => {
		await writeFile(path.join(TEMP_DIR, "first.js"), "export default { value: 1 };\n");
		await writeFile(path.join(TEMP_DIR, "sub", "second.js"), "export const value = 2;\n");

		const loader = new Loader({ directory: TEMP_DIR });
		const loaded = await loader.load();

		expect(loaded.map((entry) => path.basename(entry.filePath))).toEqual(["first.js", "second.js"]);
		expect(loaded[0].module).toEqual({ value: 1 });
		expect((loaded[1].module as any).value).toBe(2);
	});

	it("caches loaded modules and reloads in dev mode", async () => {
		const filePath = path.join(TEMP_DIR, "reload.js");
		await writeFile(filePath, "export default { value: 1 };\n");

		const loader = new Loader({ directory: TEMP_DIR, dev: true });
		const firstLoad = await loader.load();
		expect(firstLoad[0].module).toEqual({ value: 1 });

		await fs.writeFile(filePath, "export default { value: 2 };\n", "utf8");
		const secondLoad = await loader.load();
		expect(secondLoad[0].module).toEqual({ value: 2 });

		await loader.dispose();
	});

	it("returns cached module when not in dev mode", async () => {
		const filePath = path.join(TEMP_DIR, "static.js");
		await writeFile(filePath, "export default { value: 1 };\n");

		const loader = new Loader({ directory: TEMP_DIR, dev: false });
		const firstLoad = await loader.load();
		await fs.writeFile(filePath, "export default { value: 2 };\n", "utf8");
		const secondLoad = await loader.load();

		expect(firstLoad[0].module).toEqual({ value: 1 });
		expect(secondLoad[0].module).toEqual({ value: 1 });
	});
});

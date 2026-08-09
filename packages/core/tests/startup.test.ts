import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveStartupPriority, runStartup } from "../src/startup";

const TEMP_DIR = path.resolve(__dirname, "tmp-startup");

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

describe("startup", () => {
	beforeEach(async () => {
		await removeDir(TEMP_DIR);
		await fs.mkdir(TEMP_DIR, { recursive: true });
	});

	afterEach(async () => {
		await removeDir(TEMP_DIR);
	});

	it("resolves priority from export before filename prefix", () => {
		const priority = resolveStartupPriority(path.join(TEMP_DIR, "900-late.js"), { priority: 5 });
		expect(priority).toBe(5);
	});

	it("resolves priority from filename prefix when export is missing", () => {
		const priority = resolveStartupPriority(path.join(TEMP_DIR, "010-config.js"), {});
		expect(priority).toBe(10);
	});

	it("executes startup files in priority order", async () => {
		await writeFile(
			path.join(TEMP_DIR, "200-second.js"),
			`export default async function startup() { globalThis.__startupOrder = [...(globalThis.__startupOrder || []), "200-run"]; }\n`,
		);
		await writeFile(
			path.join(TEMP_DIR, "010-first.js"),
			`export default async function startup() { globalThis.__startupOrder = [...(globalThis.__startupOrder || []), "010-run"]; }\n`,
		);
		await writeFile(
			path.join(TEMP_DIR, "050-middle.js"),
			`export const priority = 50; export default async function startup() { globalThis.__startupOrder = [...(globalThis.__startupOrder || []), "050-run"]; }\n`,
		);

		const result = await runStartup({ directory: TEMP_DIR });

		expect((globalThis as { __startupOrder?: string[] }).__startupOrder).toEqual(["010-run", "050-run", "200-run"]);
		expect(result.executed.map((filePath) => path.basename(filePath))).toEqual(["010-first.js", "050-middle.js", "200-second.js"]);
		expect(result.loader.getModule("010-first.js")).toBeDefined();
	});

	it("skips modules without a default function export", async () => {
		await writeFile(path.join(TEMP_DIR, "010-config.js"), `export const config = { ok: true };\n`);

		const result = await runStartup({ directory: TEMP_DIR });

		expect(result.executed).toEqual([]);
		expect(result.loaded).toHaveLength(1);
	});
});

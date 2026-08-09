import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { ZijiApp } from "../src/app";
import { getApp, resetApp, setApp } from "../src/app-singleton";
import { definePlugin } from "../src/plugin";

const TEMP_DIR = path.resolve(__dirname, "tmp-app-startup");

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

describe("ZijiApp", () => {
	afterEach(async () => {
		resetApp();
		await removeDir(TEMP_DIR);
	});

	it("emits lifecycle events and boots plugins", async () => {
		const app = new ZijiApp();
		const events: string[] = [];

		app.events.on("app:boot", () => {
			events.push("boot");
		});
		app.events.on("app:config", () => {
			events.push("config");
		});
		app.events.on("app:ready", () => {
			events.push("ready");
		});
		app.events.on("app:shutdown", () => {
			events.push("shutdown");
		});

		app.register(
			definePlugin({
				name: "sample",
				setup: async () => {
					events.push("setup");
				},
				ready: async () => {
					events.push("ready-plugin");
				},
				dispose: async () => {
					events.push("dispose");
				},
			}),
		);

		await app.boot();
		expect(events).toEqual(["boot", "config", "setup", "ready-plugin", "ready"]);

		await app.shutdown();
		expect(events).toEqual(["boot", "config", "setup", "ready-plugin", "ready", "shutdown", "dispose"]);
	});

	it("runs startup scripts before plugin bootstrap", async () => {
		await removeDir(TEMP_DIR);
		await fs.mkdir(TEMP_DIR, { recursive: true });

		const startupMarker = { ran: false };
		(globalThis as { __startupMarker?: typeof startupMarker }).__startupMarker = startupMarker;

		await writeFile(
			path.join(TEMP_DIR, "010-startup.js"),
			`export default async function startup() { globalThis.__startupMarker.ran = true; }\n`,
		);

		const app = new ZijiApp();
		const events: string[] = [];

		app.register(
			definePlugin({
				name: "sample",
				setup: async () => {
					events.push("setup");
					expect((globalThis as { __startupMarker?: typeof startupMarker }).__startupMarker?.ran).toBe(true);
				},
			}),
		);

		await app.boot({ startupDirectory: TEMP_DIR });
		expect(events).toEqual(["setup"]);
		expect(app.getStartupLoader()).not.toBeNull();
		expect(app.getLoadedModule("010-startup.js")).toBeDefined();

		await app.shutdown();
	});

	it("allows startup scripts to access getApp", async () => {
		await removeDir(TEMP_DIR);
		await fs.mkdir(TEMP_DIR, { recursive: true });

		const startupDir = path.join(TEMP_DIR, "startup-app");
		await fs.mkdir(startupDir, { recursive: true });

		const singletonPath = path.resolve(__dirname, "../src/app-singleton.ts").replace(/\\/g, "/");
		await writeFile(
			path.join(startupDir, "010-register.js"),
			`import { getApp } from ${JSON.stringify(singletonPath)};\n` +
				`export default async function startup() {\n` +
				`  const app = getApp();\n` +
				`  globalThis.__startupAppEvents = typeof app.events.on === "function";\n` +
				`};\n`,
		);

		const app = new ZijiApp({ registerSingleton: false });
		setApp(app);

		await app.boot({ startupDirectory: startupDir });
		expect((globalThis as { __startupAppEvents?: boolean }).__startupAppEvents).toBe(true);
		expect(getApp()).toBe(app);

		await app.shutdown();
	});
});

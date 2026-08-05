import { describe, expect, it } from "vitest";
import { ZijiApp } from "../src/app";
import { definePlugin } from "../src/plugin";

describe("ZijiApp", () => {
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
});

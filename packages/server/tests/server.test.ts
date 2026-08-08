import { describe, expect, it } from "vitest";
import { Server, pluginRouter, pluginDiscord } from "../src";
import { definePlugin } from "@ziji/core";

describe("@ziji/server", () => {
	it("can create a server, register plugins, and boot", async () => {
		const events: string[] = [];

		const server = new Server({
			plugins: [
				definePlugin({
					name: "server-sample",
					setup: async () => events.push("setup"),
					ready: async () => events.push("ready-plugin"),
				}),
			],
		});

		server.app.events.on("app:boot", () => events.push("boot"));
		server.app.events.on("app:config", () => events.push("config"));
		server.app.events.on("app:ready", () => events.push("ready"));

		await server.boot();
		expect(events).toEqual(["boot", "config", "setup", "ready-plugin", "ready"]);
		await server.shutdown();
	});

	it("re-exports the router plugin from the server entrypoint", () => {
		const plugin = pluginRouter({ routesDir: "routes" });

		expect(plugin.name).toBe("@ziji/plugin-router");
		expect(typeof plugin.setup).toBe("function");
	});

	it("re-exports the discord plugin from the server entrypoint", () => {
		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });

		expect(plugin.name).toBe("@ziji/plugin-discord");
		expect(typeof plugin.setup).toBe("function");
	});
});

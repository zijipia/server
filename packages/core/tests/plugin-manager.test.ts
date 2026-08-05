import { describe, expect, it } from "vitest";
import { definePlugin, PluginManager, createToken, Container, SimpleEventBus } from "../src";

describe("PluginManager", () => {
	it("bootstraps plugins in dependency order", async () => {
		const manager = new PluginManager(new Container(), new SimpleEventBus());
		const order: string[] = [];

		manager.register(
			definePlugin({
				name: "a",
				setup: async () => {
					order.push("setup-a");
				},
				ready: async () => {
					order.push("ready-a");
				},
			}),
		);

		manager.register(
			definePlugin({
				name: "b",
				dependencies: ["a"],
				setup: async () => {
					order.push("setup-b");
				},
				ready: async () => {
					order.push("ready-b");
				},
			}),
		);

		await manager.bootstrap();

		expect(order).toEqual(["setup-a", "setup-b", "ready-a", "ready-b"]);
	});

	it("detects missing dependency", () => {
		const manager = new PluginManager(new Container(), new SimpleEventBus());
		manager.register(
			definePlugin({
				name: "b",
				dependencies: ["a"],
			}),
		);

		return expect(manager.bootstrap()).rejects.toThrow(/depends on missing plugin a/);
	});
});

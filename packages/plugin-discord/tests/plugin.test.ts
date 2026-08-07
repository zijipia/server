import { describe, expect, it } from "vitest";
import { createToken, definePlugin, Container, SimpleEventBus } from "@ziji/core";
import { pluginDiscord, discordClientToken, DiscordClient } from "../src";

describe("@ziji/plugin-discord", () => {
	it("registers a discord client and exposes it through the container", async () => {
		const container = new Container();
		const events = new SimpleEventBus();
		const client = new DiscordClient({ token: "test-token", intents: ["Guilds"] });
		const token = createToken<DiscordClient>("discord.client");

		container.register(token, { useValue: client });

		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		await plugin.setup?.({ container, events });

		const resolved = container.resolve(token);
		expect(resolved).toBeInstanceOf(DiscordClient);
		expect(resolved.token).toBe("test-token");
	});

	it("can be used as a plugin descriptor", async () => {
		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		expect(plugin.name).toBe("@ziji/plugin-discord");
		expect(typeof plugin.setup).toBe("function");
	});
});

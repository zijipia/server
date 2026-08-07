import { describe, expect, it } from "vitest";
import { createToken, Container, SimpleEventBus, type PluginDescriptor } from "@ziji/core";
import { pluginDiscord, discordClientToken, DiscordClient, type DiscordEvents } from "../src";

describe("@ziji/plugin-discord", () => {
	it("registers a discord client and exposes it through the container", async () => {
		const container = new Container();
		const events = new SimpleEventBus();

		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		await plugin.setup?.({ container, events });

		const resolved = container.resolve(discordClientToken);
		expect(resolved).toBeInstanceOf(DiscordClient);
		expect(resolved.token).toBe("test-token");
		expect(resolved.intents).toEqual(["Guilds"]);
	});

	it("uses a custom client token when provided", async () => {
		const container = new Container();
		const events = new SimpleEventBus();
		const customToken = createToken<DiscordClient>("discord.custom");

		const plugin = pluginDiscord({ token: "custom-token", intents: ["Guilds"], clientToken: customToken });
		await plugin.setup?.({ container, events });

		const resolved = container.resolve(customToken);
		expect(resolved).toBeInstanceOf(DiscordClient);
		expect(resolved.token).toBe("custom-token");
	});

	it("can be used as a plugin descriptor", async () => {
		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		expect(plugin.name).toBe("@ziji/plugin-discord");
		expect(typeof plugin.setup).toBe("function");
	});

	it("is assignable to a DiscordEvents plugin descriptor", () => {
		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		const descriptor: PluginDescriptor<DiscordEvents> = plugin;
		expect(descriptor.name).toBe("@ziji/plugin-discord");
	});
});

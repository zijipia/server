import { describe, expect, it, vi, beforeEach } from "vitest";
import { createToken, Container, SimpleEventBus, type PluginDescriptor } from "@ziji/core";

const mockLogin = vi.fn().mockResolvedValue("mock-token");
const mockDestroy = vi.fn();
const mockOn = vi.fn();
const mockOnce = vi.fn();

vi.mock("discord.js", () => {
	class MockClient {
		login = mockLogin;
		destroy = mockDestroy;
		on = mockOn;
		once = mockOnce;
	}
	return {
		Client: MockClient,
		GatewayIntentBits: {
			Guilds: 1,
			GuildMessages: 2,
			GuildMembers: 4,
			MessageContent: 8,
		},
	};
});

import { pluginDiscord, discordClientToken, DiscordClient, type DiscordEvents, Message } from "../src";

describe("@ziji/plugin-discord", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

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

	it("sets up event forwarding on ready and connects", async () => {
		const container = new Container();
		const events = new SimpleEventBus<DiscordEvents>();

		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		await plugin.setup?.({ container, events });

		let readyEmitted = false;
		events.on("discord:ready", () => {
			readyEmitted = true;
		});

		let messageReceived: Message | null = null;
		events.on("discord:message", (msg) => {
			messageReceived = msg;
		});

		await plugin.ready?.({ container, events });

		expect(mockOn).toHaveBeenCalledWith("messageCreate", expect.any(Function));
		expect(mockOnce).toHaveBeenCalledWith("ready", expect.any(Function));
		expect(mockLogin).toHaveBeenCalledWith("test-token");

		// Simulate ready event from discord.js client
		const readyCallback = mockOnce.mock.calls.find((call) => call[0] === "ready")?.[1];
		readyCallback?.();
		expect(readyEmitted).toBe(true);

		// Simulate message event from discord.js client
		const messageCallback = mockOn.mock.calls.find((call) => call[0] === "messageCreate")?.[1];
		const mockMsg = { content: "hello" };
		messageCallback?.(mockMsg);
		expect(messageReceived).toBe(mockMsg);
	});

	it("disconnects the client on dispose", async () => {
		const container = new Container();
		const events = new SimpleEventBus<DiscordEvents>();

		const plugin = pluginDiscord({ token: "test-token", intents: ["Guilds"] });
		await plugin.setup?.({ container, events });
		await plugin.ready?.({ container, events });
		await plugin.dispose?.({ container, events });

		expect(mockDestroy).toHaveBeenCalled();
	});

	it("skips connection when token is a placeholder or missing", async () => {
		const container = new Container();
		const events = new SimpleEventBus<DiscordEvents>();

		const plugin = pluginDiscord({ token: "your-token", intents: ["Guilds"] });
		await plugin.setup?.({ container, events });
		await plugin.ready?.({ container, events });

		expect(mockLogin).not.toHaveBeenCalled();
	});
});


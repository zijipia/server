import { createToken, definePlugin, type PluginContext, type EventMap, type Token } from "@ziji/core";

export type DiscordIntent = "Guilds" | "GuildMessages" | "GuildMembers" | "MessageContent";

export interface DiscordEvents {
	"discord:ready": void;
}

export interface DiscordClientOptions {
	token: string;
	intents: DiscordIntent[];
	name?: string;
}

export class DiscordClient {
	readonly token: string;
	readonly intents: DiscordIntent[];
	readonly name: string;
	private connected = false;

	constructor(options: DiscordClientOptions) {
		this.token = options.token;
		this.intents = options.intents;
		this.name = options.name ?? "discord-client";
	}

	async connect(): Promise<void> {
		this.connected = true;
	}

	async disconnect(): Promise<void> {
		this.connected = false;
	}

	isConnected(): boolean {
		return this.connected;
	}
}

export interface DiscordPluginOptions extends DiscordClientOptions {
	clientToken?: Token<DiscordClient>;
}

export const discordClientToken = createToken<DiscordClient>("discord.client");

type DiscordPluginEventMap<EM extends EventMap = Record<string, unknown>> = EM & DiscordEvents;

export function pluginDiscord<EM extends EventMap = Record<string, unknown>>(options: DiscordPluginOptions) {
	const clientToken = options.clientToken ?? discordClientToken;
	const client = new DiscordClient({
		token: options.token,
		intents: options.intents,
		name: options.name,
	});

	return definePlugin<DiscordPluginEventMap<EM>>({
		name: "@ziji/plugin-discord",
		async setup(context: PluginContext<DiscordPluginEventMap<EM>>) {
			context.container.register(clientToken, { useValue: client }, "singleton");
		},
		async ready(context: PluginContext<DiscordPluginEventMap<EM>>) {
			const resolved = context.container.resolve(clientToken);
			await resolved.connect();
			await context.events.emit<"discord:ready">("discord:ready", undefined);
		},
		async dispose(context: PluginContext<DiscordPluginEventMap<EM>>) {
			const resolved = context.container.resolve(clientToken);
			await resolved.disconnect();
		},
	});
}

export default pluginDiscord;

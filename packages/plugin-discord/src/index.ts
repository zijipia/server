import { createToken, definePlugin, type PluginContext, type Token, AppEvents } from "@ziji/core";

export type DiscordIntent = "Guilds" | "GuildMessages" | "GuildMembers" | "MessageContent";

export interface DiscordEvents extends AppEvents {
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

export function pluginDiscord(options: DiscordPluginOptions) {
	const clientToken = options.clientToken ?? discordClientToken;
	const client = new DiscordClient({
		token: options.token,
		intents: options.intents,
		name: options.name,
	});

	return definePlugin<DiscordEvents>({
		name: "@ziji/plugin-discord",
		async setup(context: PluginContext<DiscordEvents>) {
			context.container.register(clientToken, { useValue: client }, "singleton");
		},
		async ready(context: PluginContext<DiscordEvents>) {
			const resolved = context.container.resolve(clientToken);
			await resolved.connect();
			await context.events.emit("discord:ready");
		},
		async dispose(context: PluginContext<DiscordEvents>) {
			const resolved = context.container.resolve(clientToken);
			await resolved.disconnect();
		},
	});
}

export default pluginDiscord;

import { createToken, definePlugin, type PluginContext, type Token, AppEvents } from "@ziji/core";
import { Client as DiscordJSClient, GatewayIntentBits, Message, Interaction } from "discord.js";

export { Message, Interaction } from "discord.js";

export type DiscordIntent = "Guilds" | "GuildMessages" | "GuildMembers" | "MessageContent";

const IntentMap: Record<DiscordIntent, number> = {
	Guilds: GatewayIntentBits.Guilds,
	GuildMessages: GatewayIntentBits.GuildMessages,
	GuildMembers: GatewayIntentBits.GuildMembers,
	MessageContent: GatewayIntentBits.MessageContent,
};

export interface DiscordEvents extends AppEvents {
	"discord:ready": void;
	"discord:message": Message;
	"discord:interaction": Interaction;
}

export interface DiscordClientOptions {
	token: string;
	intents: DiscordIntent[];
	name?: string;
}

export class DiscordClient {
	readonly client: DiscordJSClient;
	readonly token: string;
	readonly intents: DiscordIntent[];
	readonly name: string;
	private connected = false;

	constructor(options: DiscordClientOptions) {
		this.token = options.token;
		this.intents = options.intents;
		this.name = options.name ?? "discord-client";

		const mappedIntents = this.intents.map((intent) => {
			const bit = IntentMap[intent];
			if (bit === undefined) {
				throw new Error(
					`[@ziji/plugin-discord] Invalid configuration for field "intents": intent "${intent}" is not a valid DiscordIntent.`,
				);
			}
			return bit;
		});

		this.client = new DiscordJSClient({
			intents: mappedIntents,
		});
	}

	async connect(): Promise<void> {
		if (this.connected) return;
		if (!this.token || this.token === "your-token") {
			console.warn(`[${this.name}] Discord token is missing or placeholder. Skipping client connection.`);
			return;
		}
		await this.client.login(this.token);
		this.connected = true;
	}

	async disconnect(): Promise<void> {
		if (!this.connected) return;
		this.client.destroy();
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

			resolved.client.once("ready", () => {
				context.events.emit("discord:ready").catch((err) => {
					console.error(`[@ziji/plugin-discord] Error in discord:ready listener:`, err);
				});
			});

			resolved.client.on("messageCreate", (message) => {
				context.events.emit("discord:message", message).catch((err) => {
					console.error(`[@ziji/plugin-discord] Error in discord:message listener:`, err);
				});
			});

			resolved.client.on("interactionCreate", (interaction) => {
				context.events.emit("discord:interaction", interaction).catch((err) => {
					console.error(`[@ziji/plugin-discord] Error in discord:interaction listener:`, err);
				});
			});

			await resolved.connect();
		},
		async dispose(context: PluginContext<DiscordEvents>) {
			const resolved = context.container.resolve(clientToken);
			await resolved.disconnect();
		},
	});
}

export default pluginDiscord;


import { createToken, definePlugin, type PluginContext, type Token, AppEvents } from "@ziji/core";
import { Client as DiscordJSClient, GatewayIntentBits, Message, Interaction, Events, type ClientEvents } from "discord.js";

export { Message, Interaction } from "discord.js";

export type DiscordIntent = "Guilds" | "GuildMessages" | "GuildMembers" | "MessageContent";

const IntentMap: Record<DiscordIntent, number> = {
	Guilds: GatewayIntentBits.Guilds,
	GuildMessages: GatewayIntentBits.GuildMessages,
	GuildMembers: GatewayIntentBits.GuildMembers,
	MessageContent: GatewayIntentBits.MessageContent,
};

export type DiscordEvents = AppEvents & {
	"discord:ready": void;
	"discord:message": Message;
	"discord:interaction": Interaction;
	"discord:messageCreate": Message;
	"discord:interactionCreate": Interaction;
} & {
	[K in Exclude<keyof ClientEvents, "ready" | "messageCreate" | "interactionCreate"> as `discord:${K}`]: ClientEvents[K] extends (
		[]
	) ?
		void
	: ClientEvents[K] extends [infer Single] ? Single
	: ClientEvents[K];
};

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

			let readyEmitted = false;
			const emitReady = () => {
				if (readyEmitted) return;
				readyEmitted = true;
				context.events.emit("discord:ready").catch((err) => {
					console.error(`[@ziji/plugin-discord] Error in discord:ready listener:`, err);
				});
			};

			// Listen to 'ready' for legacy/test mock support
			resolved.client.once("ready", () => {
				emitReady();
			});

			for (const eventName of Object.values(Events)) {
				resolved.client.on(eventName as any, (...args: any[]) => {
					const payload =
						args.length === 0 ? undefined
						: args.length === 1 ? args[0]
						: args;

					context.events.emit(`discord:${eventName}` as any, payload).catch((err) => {
						console.error(`[@ziji/plugin-discord] Error in discord:${eventName} listener:`, err);
					});

					// Backwards compatibility mappings:
					if (eventName === "clientReady") {
						emitReady();
					}
					if (eventName === "messageCreate") {
						context.events.emit("discord:message", args[0]).catch((err) => {
							console.error(`[@ziji/plugin-discord] Error in discord:message listener:`, err);
						});
					}
					if (eventName === "interactionCreate") {
						context.events.emit("discord:interaction", args[0]).catch((err) => {
							console.error(`[@ziji/plugin-discord] Error in discord:interaction listener:`, err);
						});
					}
				});
			}

			await resolved.connect();
		},
		async dispose(context: PluginContext<DiscordEvents>) {
			const resolved = context.container.resolve(clientToken);
			await resolved.disconnect();
		},
	});
}

export default pluginDiscord;

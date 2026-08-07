import { Server, pluginDiscord, type DiscordEvents } from "@ziji/server";

const server = new Server<DiscordEvents>({
	extensions: [
		pluginDiscord({
			token: process.env.DISCORD_TOKEN ?? "",
			intents: ["Guilds", "GuildMessages"],
			name: "example-bot",
		}),
	],
});

server.app.events.on("discord:ready", async () => {
	console.log("Discord client is ready");
});

await server.boot();

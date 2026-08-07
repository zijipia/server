import { Server, pluginDiscord, type DiscordEvents } from "@ziji/server";
import fs from "node:fs";

// Load local .env if present
if (fs.existsSync(".env")) {
	const envConfig = fs.readFileSync(".env", "utf-8");
	for (const line of envConfig.split("\n")) {
		const match = line.trim().match(/^([\w.-]+)\s*=\s*(.*)?\s*$/);
		if (match) {
			const key = match[1];
			let value = match[2] || "";
			if (value.startsWith('"') && value.endsWith('"')) {
				value = value.substring(1, value.length - 1);
			} else if (value.startsWith("'") && value.endsWith("'")) {
				value = value.substring(1, value.length - 1);
			}
			process.env[key] = value;
		}
	}
}

const server = new Server<DiscordEvents>({
	keepAlive: true,
	plugins: [
		pluginDiscord({
			token: process.env.DISCORD_TOKEN ?? "",
			intents: ["Guilds", "GuildMessages", "MessageContent"],
			name: "example-bot",
		}),
	],
});

server.app.events.on("discord:ready", async () => {
	console.log("Discord client is ready");
});

server.app.events.on("discord:message", async (message) => {
	if (message.author.bot) return;

	console.log(`Received message: ${message.content}`);

	if (message.content === "!ping") {
		await message.reply("pong!");
	}
});

(async () => {
	await server.boot();
})();


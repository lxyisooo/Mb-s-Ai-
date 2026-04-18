import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";

import { handleMessage } from "./handlers/messageHandler.js";
import { handleInteraction } from "./handlers/interactionHandler.js";

console.log("TOKEN CHECK:", !!process.env.DISCORD_TOKEN);

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN missing in .env");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => handleMessage(client, message));
client.on("interactionCreate", (interaction) => handleInteraction(interaction));

client.login(process.env.DISCORD_TOKEN);

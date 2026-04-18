import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import messageHandler from "./handlers/messageHandler.js";

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

client.on("messageCreate", (msg) => messageHandler(client, msg));

client.login(process.env.DISCORD_TOKEN);

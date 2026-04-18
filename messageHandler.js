import { PREFIX } from "../config.js";
import { checkCooldown } from "../utils/cooldown.js";
import { handleAI, handleExplain, handleRecommend } from "../commands/ai.js";
import { embed } from "../utils/embeds.js";

export async function handleMessage(client, message) {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;

  const isMention = message.content.startsWith(mention);
  const isPrefix = message.content.startsWith(PREFIX);

  if (!isMention && !isPrefix) return;

  const args = isMention
    ? message.content.slice(mention.length).trim().split(/ +/)
    : message.content.slice(PREFIX.length).trim().split(/ +/);

  const command = args.shift()?.toLowerCase();
  if (!command) return;

  if (checkCooldown(message.author.id, command)) return;

  try {
    if (command === "ask") return handleAI(message, args);
    if (command === "explain") return handleExplain(message, args);
    if (command === "recommend") return handleRecommend(message, args);

    if (command === "ping") {
      return message.reply({
        embeds: [embed("🏓 Pong").setDescription("Alive & working")]
      });
    }

    if (command === "help") {
      return message.reply({
        embeds: [
          embed("Help Menu").setDescription(`
mb ask <question>
mb explain <topic>
mb recommend <genre>
mb escape
          `)
        ]
      });
    }

  } catch (err) {
    console.error(err);
    message.reply("⚠️ Something broke.");
  }
}

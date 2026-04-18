import ask from "../commands/ask.js";
import explain from "../commands/explain.js";
import recommend from "../commands/recommend.js";

const PREFIX = "mb";

export default async function messageHandler(client, message) {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift();

  try {
    if (command === "ask") return ask(message, args);
    if (command === "explain") return explain(message, args);
    if (command === "recommend") return recommend(message, args);
  } catch (err) {
    console.error(err);
    message.reply("❌ Something broke in the command.");
  }
}

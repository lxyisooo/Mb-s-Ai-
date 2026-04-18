import OpenAI from "openai";
import { EmbedBuilder } from "discord.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const memory = new Map();

export default async function ask(message, args) {
  const prompt = args.join(" ");
  if (!prompt) return message.reply("Ask something.");

  const history = memory.get(message.author.id) || [];

  history.push({ role: "user", content: prompt });

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "You are a helpful Discord AI." },
      ...history.slice(-10)
    ]
  });

  const reply = res.choices[0].message.content;

  history.push({ role: "assistant", content: reply });
  memory.set(message.author.id, history);

  const embed = new EmbedBuilder()
    .setTitle("🧠 AI Response")
    .setDescription(reply)
    .setColor("Green");

  return message.reply({ embeds: [embed] });
}

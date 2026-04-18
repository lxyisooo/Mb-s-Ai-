import OpenAI from "openai";
import { embed } from "../utils/embeds.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const memory = new Map();

export async function handleAI(message, args) {
  const prompt = args.join(" ");
  if (!prompt) return message.reply("Ask something.");

  const history = memory.get(message.author.id) || [];

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "You are a Discord assistant." },
      ...history.slice(-8),
      { role: "user", content: prompt }
    ]
  });

  const reply = res.choices[0].message.content;

  history.push({ role: "user", content: prompt });
  history.push({ role: "assistant", content: reply });

  memory.set(message.author.id, history);

  return message.reply({
    embeds: [embed("🧠 AI").setDescription(reply)]
  });
}

export async function handleExplain(message, args) {
  const topic = args.join(" ");
  if (!topic) return message.reply("Explain what?");

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Explain simply." },
      { role: "user", content: topic }
    ]
  });

  return message.reply({
    embeds: [embed(`📚 ${topic}`).setDescription(res.choices[0].message.content)]
  });
}

export async function handleRecommend(message, args) {
  const genre = args.join(" ") || "any";

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "user", content: `Recommend a movie and TV show for: ${genre}` }
    ]
  });

  return message.reply({
    embeds: [embed("🎬 Recommendations").setDescription(res.choices[0].message.content)]
  });
      }

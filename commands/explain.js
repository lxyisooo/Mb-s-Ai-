import OpenAI from "openai";
import { EmbedBuilder } from "discord.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function explain(message, args) {
  const topic = args.join(" ");
  if (!topic) return message.reply("Explain what gng?");

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Explain simply." },
      { role: "user", content: topic }
    ]
  });

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`📚 ${topic}`)
        .setDescription(res.choices[0].message.content)
        .setColor("Blue")
    ]
  });
}

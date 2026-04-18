import OpenAI from "openai";
import { EmbedBuilder } from "discord.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function recommend(message, args) {
  const genre = args.join(" ") || "any";

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "user",
        content: `Give 1 movie + 1 TV show for genre: ${genre}`
      }
    ]
  });

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎬 Recommendations")
        .setDescription(res.choices[0].message.content)
        .setColor("Orange")
    ]
  });
}

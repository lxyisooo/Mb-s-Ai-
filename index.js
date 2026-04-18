import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import OpenAI from "openai";

// ───────────────── CONFIG ─────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PREFIX = "mb";
const escapeRooms = new Map();

// ───────────────── READY ─────────────────
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log("OpenAI Key Loaded:", !!process.env.OPENAI_API_KEY);
});

// ───────────────── MESSAGE HANDLER ─────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  if (
    !message.content.startsWith(PREFIX) &&
    !message.content.startsWith(mention)
  ) return;

  const args = message.content
    .replace(mention, PREFIX)
    .slice(PREFIX.length)
    .trim()
    .split(/ +/);

  const command = args.shift()?.toLowerCase();

  // ───────── HELP ─────────
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("✨ MultiBot Ultimate Control Panel")
      .setDescription("AI + Games + Entertainment")
      .addFields(
        { name: "🧩 Escape Room", value: "`mb escape`" },
        { name: "🎬 AI Recommendations", value: "`mb recommend`" },
        { name: "🧠 Ask AI", value: "`mb ask <question>`" }
      )
      .setColor("Blurple");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("escape").setLabel("🧩 Escape").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("recommend").setLabel("🎬 Movies").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ask").setLabel("🧠 Ask AI").setStyle(ButtonStyle.Secondary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  // ───────── ESCAPE ROOM (AI + TIMED + RANDOM) ─────────
  if (command === "escape") {
    try {
      const ai = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: "Create a short escape room riddle. End with 'ANSWER:' followed by the answer."
      });

      const text = ai.output_text;
      const [riddle, answer] = text.split("ANSWER:");

      escapeRooms.set(message.author.id, {
        answer: answer.trim().toLowerCase(),
        start: Date.now()
      });

      const embed = new EmbedBuilder()
        .setTitle("🧩 AI Escape Room")
        .setDescription(riddle)
        .setFooter({ text: "⏱️ You have 60 seconds" })
        .setColor("DarkPurple");

      return message.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      return message.reply("❌ Escape room AI failed.");
    }
  }

  // ───────── ESCAPE ANSWERS ─────────
  if (escapeRooms.has(message.author.id)) {
    const data = escapeRooms.get(message.author.id);

    if (Date.now() - data.start > 60000) {
      escapeRooms.delete(message.author.id);
      return message.reply("⏱️ Time’s up! Try `mb escape` again.");
    }

    if (message.content.toLowerCase().includes(data.answer)) {
      escapeRooms.delete(message.author.id);
      return message.reply("🏆 **YOU ESCAPED!**");
    }
  }

  // ───────── AI MOVIE & TV RECOMMENDATIONS ─────────
  if (command === "recommend") {
    const thinking = await message.reply("🎬 Thinking...");

    try {
      const ai = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: "Recommend 3 movies and 3 TV shows with short descriptions."
      });

      const embed = new EmbedBuilder()
        .setTitle("🎬 AI Recommendations")
        .setDescription(ai.output_text)
        .setColor("Gold");

      return thinking.edit({ content: "", embeds: [embed] });

    } catch (err) {
      console.error(err);
      return thinking.edit("❌ Recommendation AI failed.");
    }
  }

  // ───────── REAL AI KNOWLEDGE ASSISTANT ─────────
  if (command === "ask") {
    const question = args.join(" ");
    if (!question) return message.reply("❓ Ask something real.");

    const thinking = await message.reply("🧠 Thinking...");

    try {
      const ai = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: question
      });

      const embed = new EmbedBuilder()
        .setTitle("🧠 AI Answer")
        .setDescription(ai.output_text.slice(0, 4000))
        .setColor("Green");

      return thinking.edit({ content: "", embeds: [embed] });

    } catch (err) {
      console.error(err);
      return thinking.edit("❌ AI failed. Check key, model, or limits.");
    }
  }
});

// ───────────────── BUTTON HANDLER ─────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const map = {
    escape: "Type `mb escape`",
    recommend: "Type `mb recommend`",
    ask: "Type `mb ask <question>`"
  };

  await interaction.reply({
    content: map[interaction.customId],
    ephemeral: true
  });
});

// ───────────────── LOGIN ─────────────────
console.log("DISCORD_TOKEN value:", process.env.DISCORD_TOKEN);
console.log("Length:", process.env.DISCORD_TOKEN?.length);
client.login(process.env.DISCORD_TOKEN);

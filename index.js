import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import fetch from "node-fetch";

/* =======================
   ENV CHECK (DO NOT SKIP)
======================= */
console.log("DISCORD_TOKEN value:", process.env.DISCORD_TOKEN);
console.log("Length:", process.env.DISCORD_TOKEN?.length);
console.log("OpenAI Key Loaded:", !!process.env.OPENAI_API_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "mb";

/* =======================
   SIMPLE DATABASE (MEMORY)
======================= */
const users = new Map();
const escapeGames = new Map();

/* =======================
   AI FUNCTION (REAL)
======================= */
async function askAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response.";
}

/* =======================
   READY
======================= */
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* =======================
   MESSAGE HANDLER
======================= */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const mention = `<@${client.user.id}>`;
  const usedPrefix =
    message.content.startsWith(PREFIX) ||
    message.content.startsWith(mention);

  if (!usedPrefix) return;

  const args = message.content
    .replace(mention, PREFIX)
    .slice(PREFIX.length)
    .trim()
    .split(/ +/);

  const command = args.shift()?.toLowerCase();

  // USER INIT
  if (!users.has(message.author.id)) {
    users.set(message.author.id, { xp: 0, coins: 50 });
  }
  const user = users.get(message.author.id);
  user.xp += 5;

  /* =======================
     HELP
  ======================= */
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("✨ MultiBot Control Panel")
      .setDescription("Choose a system below 👇")
      .addFields(
        { name: "🧩 Escape Room", value: "`mb escape`" },
        { name: "🎬 Recommendations", value: "`mb recommend`" },
        { name: "🧠 Ask AI", value: "`mb ask <question>`" },
        { name: "💰 Profile", value: "`mb profile`" }
      )
      .setColor("Blurple");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("escape").setLabel("🧩 Escape").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ai").setLabel("🧠 Ask AI").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("movies").setLabel("🎬 Movies").setStyle(ButtonStyle.Secondary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  /* =======================
     PROFILE
  ======================= */
  if (command === "profile") {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${message.author.username}'s Profile`)
          .addFields(
            { name: "XP", value: `${user.xp}`, inline: true },
            { name: "Coins", value: `${user.coins}`, inline: true }
          )
          .setColor("Gold")
      ]
    });
  }

  /* =======================
     ESCAPE ROOM (UPGRADED)
  ======================= */
  if (command === "escape") {
    escapeGames.set(message.author.id, 1);

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧩 Escape Room — Room 1")
          .setDescription(
            "You wake up in a locked lab.\n\n🧠 **Riddle:**\nI have keys but no locks. I have space but no room. What am I?"
          )
          .setFooter({ text: "Reply with your answer!" })
          .setColor("DarkPurple")
      ]
    });
  }

  if (escapeGames.has(message.author.id)) {
    const stage = escapeGames.get(message.author.id);
    const answer = message.content.toLowerCase();

    if (stage === 1 && answer.includes("keyboard")) {
      escapeGames.set(message.author.id, 2);
      return message.reply("✅ Correct! Next room...\n🧩 *What runs but never walks?*");
    }

    if (stage === 2 && answer.includes("river")) {
      escapeGames.delete(message.author.id);
      user.coins += 100;
      return message.reply("🎉 YOU ESCAPED! +100 coins!");
    }
  }

  /* =======================
     MOVIE RECOMMENDATIONS
  ======================= */
  if (command === "recommend") {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎬 Top Picks")
          .addFields(
            { name: "Movies", value: "Inception\nInterstellar\nThe Matrix" },
            { name: "TV Shows", value: "Breaking Bad\nThe Boys\nStranger Things" }
          )
          .setColor("Orange")
      ]
    });
  }

  /* =======================
     AI COMMAND
  ======================= */
  if (command === "ask") {
    const question = args.join(" ");
    if (!question) return message.reply("Ask something 😭");

    const reply = await askAI(question);

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🧠 AI Response")
          .setDescription(reply)
          .setColor("Green")
      ]
    });
  }
});

/* =======================
   BUTTONS
======================= */
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "escape") return i.reply({ content: "Type `mb escape`", ephemeral: true });
  if (i.customId === "ai") return i.reply({ content: "Type `mb ask <question>`", ephemeral: true });
  if (i.customId === "movies") return i.reply({ content: "Type `mb recommend`", ephemeral: true });
});

/* =======================
   LOGIN
======================= */
client.login(process.env.DISCORD_TOKEN);

/******************************************************************************************
 * MULTIBOT SUPREME EDITION
 * Author: You 😈
 * Version: 6.0.0
 * Node: 18+
 * discord.js: v14
 ******************************************************************************************/

import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection
} from "discord.js";
import OpenAI from "openai";

/******************************************************************************************
 * ENV VALIDATION (THIS PREVENTS YOUR TOKEN BUG)
 ******************************************************************************************/

console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN);
console.log("TOKEN LENGTH:", process.env.DISCORD_TOKEN?.length);
console.log("OPENAI KEY LOADED:", Boolean(process.env.OPENAI_API_KEY));

if (!process.env.DISCORD_TOKEN)
  throw new Error("❌ DISCORD_TOKEN is missing from environment variables");

if (!process.env.OPENAI_API_KEY)
  console.warn("⚠️ OpenAI key missing — AI features disabled");

/******************************************************************************************
 * CLIENT SETUP
 ******************************************************************************************/

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PREFIX = "mb";

/******************************************************************************************
 * GLOBAL STATE (MEMORY, GAMES, COOLDOWNS)
 ******************************************************************************************/

const userMemory = new Map();       // AI memory
const escapeGames = new Map();      // Escape room states
const cooldowns = new Collection();

/******************************************************************************************
 * UTILS
 ******************************************************************************************/

function cooldown(userId, command, time = 3000) {
  const key = `${userId}-${command}`;
  if (cooldowns.has(key)) return true;
  cooldowns.set(key, true);
  setTimeout(() => cooldowns.delete(key), time);
  return false;
}

function baseEmbed(title, color = "Blurple") {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setFooter({ text: "MultiBot Supreme" })
    .setTimestamp();
}

/******************************************************************************************
 * READY
 ******************************************************************************************/

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/******************************************************************************************
 * MESSAGE HANDLER (PREFIX + MENTION)
 ******************************************************************************************/

client.on("messageCreate", async (message) => {
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

  if (cooldown(message.author.id, command)) return;

  /****************************************************************************************
   * HELP COMMAND
   ****************************************************************************************/
  if (command === "help") {
    const embed = baseEmbed("🤖 MultiBot Help")
      .setDescription("Prefix: `mb` or mention the bot")
      .addFields(
        { name: "🧠 AI", value: "`mb ask <question>`" },
        { name: "📚 Knowledge", value: "`mb explain <topic>`" },
        { name: "🎬 Movies & TV", value: "`mb recommend <genre>`" },
        { name: "🧩 Escape Room", value: "`mb escape`" },
        { name: "ℹ️ Utility", value: "`mb ping`, `mb uptime`" }
      );

    return message.reply({ embeds: [embed] });
  }

  /****************************************************************************************
   * PING
   ****************************************************************************************/
  if (command === "ping") {
    return message.reply({
      embeds: [
        baseEmbed("🏓 Pong", "Green")
          .setDescription(`Latency: **${Date.now() - message.createdTimestamp}ms**`)
      ]
    });
  }

  /****************************************************************************************
   * AI ASK (MEMORY ENABLED)
   ****************************************************************************************/
  if (command === "ask") {
    if (!process.env.OPENAI_API_KEY)
      return message.reply("❌ AI disabled.");

    const prompt = args.join(" ");
    if (!prompt) return message.reply("Ask something.");

    const memory = userMemory.get(message.author.id) || [];
    memory.push({ role: "user", content: prompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a helpful Discord AI assistant." },
        ...memory.slice(-10)
      ]
    });

    const reply = response.choices[0].message.content;
    memory.push({ role: "assistant", content: reply });
    userMemory.set(message.author.id, memory);

    return message.reply({
      embeds: [
        baseEmbed("🧠 AI Response", "Green").setDescription(reply)
      ]
    });
  }

  /****************************************************************************************
   * KNOWLEDGE ASSISTANT
   ****************************************************************************************/
  if (command === "explain") {
    const topic = args.join(" ");
    if (!topic) return message.reply("Explain what?");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Explain concepts simply and clearly." },
        { role: "user", content: topic }
      ]
    });

    return message.reply({
      embeds: [
        baseEmbed(`📚 ${topic}`, "Blue")
          .setDescription(response.choices[0].message.content)
      ]
    });
  }

  /****************************************************************************************
   * MOVIE & TV RECOMMENDER
   ****************************************************************************************/
  if (command === "recommend") {
    const genre = args.join(" ") || "any";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: `Recommend one movie and one TV show for genre: ${genre}`
        }
      ]
    });

    return message.reply({
      embeds: [
        baseEmbed("🎬 Recommendations", "Orange")
          .setDescription(response.choices[0].message.content)
      ]
    });
  }

  /****************************************************************************************
   * ESCAPE ROOM V2 (MULTI-STAGE)
   ****************************************************************************************/
  if (command === "escape") {
    escapeGames.set(message.author.id, {
      stage: 1,
      inventory: []
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("look").setLabel("👀 Look Around").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("desk").setLabel("🗄 Desk").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("door").setLabel("🚪 Door").setStyle(ButtonStyle.Danger)
    );

    return message.reply({
      embeds: [
        baseEmbed("🧩 Escape Room")
          .setDescription("You wake up in a locked room. What do you do?")
      ],
      components: [row]
    });
  }
});

/******************************************************************************************
 * BUTTON INTERACTIONS (ESCAPE ROOM LOGIC)
 ******************************************************************************************/

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const game = escapeGames.get(interaction.user.id);
  if (!game)
    return interaction.reply({ content: "No active escape room.", ephemeral: true });

  if (interaction.customId === "look") {
    return interaction.reply({
      embeds: [
        baseEmbed("👀 You Look Around")
          .setDescription("A desk, a locked door, and a strange painting.")
      ],
      ephemeral: true
    });
  }

  if (interaction.customId === "desk") {
    if (!game.inventory.includes("key")) {
      game.inventory.push("key");
      return interaction.reply({
        embeds: [
          baseEmbed("🗝️ Desk Opened", "Gold")
            .setDescription("You found a **key**!")
        ],
        ephemeral: true
      });
    }
    return interaction.reply({ content: "Nothing else here.", ephemeral: true });
  }

  if (interaction.customId === "door") {
    if (game.inventory.includes("key")) {
      escapeGames.delete(interaction.user.id);
      return interaction.reply({
        embeds: [
          baseEmbed("🎉 Escaped!", "Green")
            .setDescription("You unlocked the door and escaped!")
        ]
      });
    }
    return interaction.reply({ content: "🚫 Door is locked.", ephemeral: true });
  }
});

/******************************************************************************************
 * LOGIN
 ******************************************************************************************/

client.login(process.env.DISCORD_TOKEN);

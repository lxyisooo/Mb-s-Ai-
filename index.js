const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

const PREFIX = "mb ";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ---------------- DATABASE ---------------- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🍃 MongoDB connected"))
  .catch(console.error);

const userSchema = new mongoose.Schema({
  userId: String,
  cash: { type: Number, default: 1000 },
  luck: { type: Number, default: 1 },
  inv: { type: [String], default: [] },
  accepted: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

/* ---------------- READY ---------------- */
client.once("ready", () => {
  console.log(`🚀 ${client.user.tag} online`);
});

/* ---------------- HELP EMBEDS ---------------- */
const helpEmbeds = {
  main: new EmbedBuilder()
    .setTitle("📘 Wimble Help")
    .setDescription("Choose a category below")
    .setColor("#5865F2"),

  economy: new EmbedBuilder()
    .setTitle("💰 Economy Commands")
    .setDescription(
      "`mb hunt` – hunt animals\n" +
      "`mb work` – earn money\n" +
      "`mb daily` – daily reward\n" +
      "`mb crime` – risky money\n" +
      "`mb slots <amt>` – gamble"
    )
    .setColor("Green"),

  social: new EmbedBuilder()
    .setTitle("💍 Social Commands")
    .setDescription(
      "`mb marry @user`\n" +
      "`mb divorce`\n" +
      "`mb profile`"
    )
    .setColor("Pink"),

  utility: new EmbedBuilder()
    .setTitle("🧰 Utility Commands")
    .setDescription(
      "`mb help`\n" +
      "`mb rules`\n" +
      "`mb inv`\n" +
      "`mb lb`"
    )
    .setColor("Blue"),

  fun: new EmbedBuilder()
    .setTitle("🎮 Fun & Extras")
    .setDescription(
      "`mb shop`\n" +
      "`mb buy <item>`\n" +
      "`mb zoo`"
    )
    .setColor("Orange")
};

/* ---------------- HELP BUTTONS ---------------- */
const helpRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("help_main")
    .setLabel("🏠 Home")
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId("help_economy")
    .setLabel("💰 Economy")
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId("help_social")
    .setLabel("💍 Social")
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId("help_utility")
    .setLabel("🧰 Utility")
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId("help_fun")
    .setLabel("🎮 Fun")
    .setStyle(ButtonStyle.Secondary)
);

/* ---------------- MESSAGE HANDLER ---------------- */
client.on("messageCreate", async message => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const cmd = message.content.slice(PREFIX.length).trim().toLowerCase();

  let user = await User.findOne({ userId: message.author.id });
  if (!user) user = await User.create({ userId: message.author.id });

  /* ---- HELP v2 ---- */
  if (cmd === "help") {
    return message.reply({
      embeds: [helpEmbeds.main],
      components: [helpRow]
    });
  }

  /* ---- RULES ---- */
  if (cmd === "rules") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_rules")
        .setLabel("Accept Rules")
        .setStyle(ButtonStyle.Success)
    );

    return message.reply({
      content: "📜 **Rules**\nNo spam • No abuse • Be cool",
      components: [row]
    });
  }

  if (!user.accepted) {
    return message.reply("⚠️ Accept the rules first: `mb rules`");
  }

  // (Your existing commands continue here)
});

/* ---------------- BUTTON HANDLER ---------------- */
client.on("interactionCreate", async i => {
  if (i.isButton()) {

    /* ---- RULE ACCEPT ---- */
    if (i.customId === "accept_rules") {
      await User.findOneAndUpdate(
        { userId: i.user.id },
        { accepted: true }
      );

      return i.update({
        content: "✅ Rules accepted! Type `mb help`",
        components: []
      });
    }

    /* ---- HELP NAV ---- */
    if (i.customId.startsWith("help_")) {
      const page = i.customId.split("_")[1];
      const embed = helpEmbeds[page] || helpEmbeds.main;

      return i.update({
        embeds: [embed],
        components: [helpRow]
      });
    }
  }
});

client.login(process.env.TOKEN);

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

const PREFIX = "mb";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ───── DB ───── */
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  userId: String,
  cash: { type: Number, default: 1000 },
  luck: { type: Number, default: 1 },
  accepted: { type: Boolean, default: false },

  ship: { type: String, default: "None" },

  /* 🐾 PET SYSTEM */
  pet: {
    name: { type: String, default: null },
    level: { type: Number, default: 0 },
    hunger: { type: Number, default: 100 }
  },

  /* 🏅 BADGES */
  badges: { type: [String], default: [] }
});

const User = mongoose.model("User", userSchema);

/* ───── READY ───── */
client.once("ready", () => {
  console.log(`🚀 House of MB online`);
});

/* ───── HELP ───── */
const help = new EmbedBuilder()
  .setTitle("🏠 House of MB Help")
  .setDescription(
    "**💰 Economy**\n`mb hunt` `mb slots`\n\n" +
    "**🐾 Pets**\n`mb adopt <name>`\n`mb pet`\n`mb feed`\n\n" +
    "**💞 Social**\n`mb ship @user`\n\n" +
    "**📊 Profile**\n`mb profile`"
  )
  .setColor("#ff7a18");

/* ───── CORE ───── */
client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  let u = await User.findOne({ userId: msg.author.id });
  if (!u) u = await User.create({ userId: msg.author.id });

  if (!u.accepted && cmd !== "rules") {
    return msg.reply("⚠️ Accept rules first: `mb rules`");
  }

  /* ───── RULES ───── */
  if (cmd === "rules") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept")
        .setLabel("Accept Rules")
        .setStyle(ButtonStyle.Success)
    );

    return msg.reply({
      content: "📜 House of MB Rules\nBe respectful • No abuse",
      components: [row]
    });
  }

  /* ───── HELP ───── */
  if (cmd === "help") return msg.reply({ embeds: [help] });

  /* ───── HUNT (PET SYNERGY) ───── */
  if (cmd === "hunt") {
    const gain = Math.floor(Math.random() * 200) + 50;

    let bonus = 0;
    if (u.pet.name) bonus = u.pet.level * 10;

    u.cash += gain + bonus;
    await u.save();

    return msg.reply(
      `🏹 You earned **${gain} MB**` +
      (bonus ? ` + 🐾 pet bonus **${bonus}**` : "")
    );
  }

  /* ───── ADOPT PET ───── */
  if (cmd === "adopt") {
    const name = args.join(" ");
    if (!name) return msg.reply("🐾 Give your pet a name!");

    u.pet.name = name;
    u.pet.level = 1;
    u.pet.hunger = 100;

    u.badges.push("🐾 Pet Owner");

    await u.save();

    return msg.reply(`🐾 You adopted **${name}**!`);
  }

  /* ───── PET INFO ───── */
  if (cmd === "pet") {
    if (!u.pet.name) return msg.reply("❌ No pet yet!");

    return msg.reply(
      `🐾 **${u.pet.name}**\n` +
      `Level: ${u.pet.level}\n` +
      `Hunger: ${u.pet.hunger}%`
    );
  }

  /* ───── FEED PET ───── */
  if (cmd === "feed") {
    if (!u.pet.name) return msg.reply("❌ No pet!");

    u.pet.hunger = Math.min(100, u.pet.hunger + 25);
    u.pet.level += 1;

    await u.save();

    return msg.reply(`🍖 You fed **${u.pet.name}**! Level up +1`);
  }

  /* ───── SHIP ───── */
  if (cmd === "ship") {
    const t = msg.mentions.users.first();
    if (!t) return msg.reply("💞 Mention someone!");

    const p = Math.floor(Math.random() * 101);

    u.ship = t.username;
    await u.save();

    return msg.reply(`💘 Ship: ${p}% between you and ${t.username}`);
  }

  /* ───── PROFILE V2 ───── */
  if (cmd === "profile") {
    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${msg.author.username}`)
      .addFields(
        { name: "💰 Cash", value: `${u.cash}`, inline: true },
        { name: "🐾 Pet", value: u.pet.name || "None", inline: true },
        { name: "📊 Level", value: `${u.pet.level}`, inline: true },
        { name: "🏅 Badges", value: u.badges.join(", ") || "None" }
      )
      .setColor("#ff7a18");

    return msg.reply({ embeds: [embed] });
  }
});

/* ───── BUTTONS ───── */
client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  if (i.customId === "accept") {
    await User.findOneAndUpdate(
      { userId: i.user.id },
      { accepted: true }
    );

    return i.update({
      content: "✅ Welcome to House of MB 🏠",
      components: []
    });
  }
});

client.login(process.env.TOKEN);

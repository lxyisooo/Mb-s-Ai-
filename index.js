const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const mongoose = require("mongoose");
const OpenAI = require("openai");
require("dotenv").config();

// ================= CONFIG =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const PREFIX = process.env.PREFIX || ";";
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const VOICE_CATEGORY_ID = process.env.VOICE_CATEGORY_ID;

// ================= AI =================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function ai(msg) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful Discord bot assistant." },
        { role: "user", content: msg }
      ]
    });

    return res.choices[0].message.content;
  } catch {
    return "AI error 🤖";
  }
}

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🩸 MongoDB Connected"));

// ================= MODELS =================
const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  balance: { type: Number, default: 0 }
}));

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  moderatorId: String,
  reason: String,
  caseId: Number
}));

const Profile = mongoose.model("Profile", new mongoose.Schema({
  userId: String,
  roblox: String,
  tiktok: String,
  snapchat: String
}));

const Filter = mongoose.model("Filter", new mongoose.Schema({
  guildId: String,
  enabled: { type: Boolean, default: true },
  words: { type: Array, default: ["fuck", "shit", "bitch"] }
}));

const Ticket = mongoose.model("Ticket", new mongoose.Schema({
  channelId: String,
  userId: String
}));

// ================= LOGGING =================
async function log(guild, action, mod, target, reason) {
  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📜 LOG")
    .setColor("Red")
    .addFields(
      { name: "Action", value: action },
      { name: "Moderator", value: `<@${mod}>` },
      { name: "Target", value: target ? `<@${target}>` : "N/A" },
      { name: "Reason", value: reason || "N/A" }
    );

  channel.send({ embeds: [embed] });
}

// ================= READY =================
client.once("ready", () => {
  console.log(`🩸 ${client.user.tag} ONLINE`);
});

// ================= MESSAGE =================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (message.guild.id !== GUILD_ID) return;

  // ================= FILTER =================
  const filter = await Filter.findOne({ guildId: message.guild.id });

  if (filter?.enabled) {
    if (filter.words.some(w => message.content.toLowerCase().includes(w))) {
      message.delete().catch(() => {});
      log(message.guild, "FILTER", client.user.id, message.author.id, "Bad word");
      return;
    }
  }

  // ================= XP + ECONOMY =================
  let user = await User.findOne({ userId: message.author.id });
  if (!user) user = await User.create({ userId: message.author.id });

  user.xp += 5;
  user.balance += 1;

  if (user.xp >= (user.level + 1) * 100) {
    user.level++;
    user.xp = 0;
    message.channel.send(`📈 ${message.author} reached level ${user.level}`);
  }

  await user.save();

  // ================= PREFIX =================
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ================= HELP =================
  if (cmd === "help") {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🩸 HELP MENU")
          .setColor("DarkRed")
          .setDescription(`
🤖 AI: ;ai <msg>

🛡 MOD: ;ban ;warn ;purge

🎫 Tickets: ;ticketpanel

🌐 Profile: ;profile set/view

💰 Economy: ;balance

📊 Leaderboard: ;leaderboard
          `)
      ]
    });
  }

  // ================= AI =================
  if (cmd === "ai") {
    return message.reply(await ai(args.join(" ")));
  }

  // ================= BALANCE =================
  if (cmd === "balance") {
    return message.reply(`💰 ${user.balance} coins`);
  }

  // ================= LEADERBOARD =================
  if (cmd === "leaderboard") {
    const top = await User.find().sort({ level: -1 }).limit(5);

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📊 LEADERBOARD")
          .setDescription(
            top.map((u, i) =>
              `#${i + 1} <@${u.userId}> - Level ${u.level}`
            ).join("\n")
          )
      ]
    });
  }

  // ================= WARN =================
  if (cmd === "warn") {
    const target = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason";

    const caseId = await Warn.countDocuments() + 1;

    await Warn.create({
      userId: target.id,
      moderatorId: message.author.id,
      reason,
      caseId
    });

    await log(message.guild, "WARN", message.author.id, target.id, reason);
    return message.reply(`⚠️ Warned ${target.user.tag}`);
  }

  // ================= BAN =================
  if (cmd === "ban") {
    const target = message.mentions.members.first();
    await target.ban();

    await log(message.guild, "BAN", message.author.id, target.id, "No reason");
  }

  // ================= PURGE =================
  if (cmd === "purge") {
    const amount = parseInt(args[0]);
    await message.channel.bulkDelete(amount);

    await log(message.guild, "PURGE", message.author.id, null, `${amount} msgs`);
  }

  // ================= PROFILE =================
  if (cmd === "profile") {
    let profile = await Profile.findOne({ userId: message.author.id });
    if (!profile) profile = await Profile.create({ userId: message.author.id });

    if (args[0] === "set") {
      profile[args[1]] = args.slice(2).join(" ");
      await profile.save();
      return message.reply("Saved.");
    }

    const target = message.mentions.members.first() || message.member;
    const data = await Profile.findOne({ userId: target.id });

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🌐 PROFILE")
          .addFields(
            { name: "Roblox", value: data?.roblox || "None" },
            { name: "TikTok", value: data?.tiktok || "None" },
            { name: "Snapchat", value: data?.snapchat || "None" }
          )
      ]
    });
  }

  // ================= TICKET PANEL =================
  if (cmd === "ticketpanel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({
      embeds: [new EmbedBuilder().setTitle("🎫 Tickets")],
      components: [row]
    });
  }
});

// ================= BUTTONS =================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "ticket_create") {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    await Ticket.create({ channelId: channel.id, userId: i.user.id });

    return i.reply({ content: "Ticket created!", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);

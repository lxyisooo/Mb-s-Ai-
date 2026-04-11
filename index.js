const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType
} = require("discord.js");

const mongoose = require("mongoose");
require("dotenv").config();

const GUILD_ID = process.env.GUILD_ID;
const PREFIX = process.env.PREFIX || ";";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= DB =================
mongoose.connect(process.env.MONGO_URI);

// ================= USER =================
const userSchema = new mongoose.Schema({
  userId: String,
  balance: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  warns: { type: Array, default: [] }
});
const User = mongoose.model("User", userSchema);

// ================= TICKET STORAGE =================
const activeTickets = new Map();

// ================= GUILD LOCK =================
const isGuild = (g) => g?.id === GUILD_ID;

// ================= READY =================
client.once("ready", () => {
  console.log(`🩸 ${client.user.tag} ONLINE`);

  // Mobile-like status
  client.user.setPresence({
    activities: [
      {
        name: "Mobile Chat",
        type: ActivityType.Competing
      }
    ],
    status: "idle"
  });
});

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!isGuild(message.guild)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (!message.content.startsWith(PREFIX)) return;

  // ================= PROFILE =================
  if (cmd === "profile") {
    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    const sub = args[0];

    if (sub === "set") {
      const amount = parseInt(args[1]);
      if (!amount) return message.reply("Set amount.");

      user.balance += amount;
      await user.save();

      return message.reply(`💰 Added ${amount}`);
    }

    const embed = new EmbedBuilder()
      .setTitle("🌐 Profile")
      .setColor("Blue")
      .setDescription(`Balance: **${user.balance}**`);

    return message.reply({ embeds: [embed] });
  }

  // ================= BALANCE =================
  if (cmd === "balance") {
    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    return message.reply(`💰 Balance: **${user.balance}**`);
  }

  // ================= AI (mock) =================
  if (cmd === "ai") {
    const prompt = args.join(" ");
    if (!prompt) return message.reply("Ask something.");

    return message.reply(`🤖 AI: I processed "${prompt}" (AI system placeholder)`);
  }

  // ================= WARN =================
  if (cmd === "warn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("No permission.");

    const user = message.mentions.users.first();
    if (!user) return message.reply("Mention user.");

    let db = await User.findOne({ userId: user.id });
    if (!db) db = await User.create({ userId: user.id });

    db.warns.push(args.slice(1).join(" ") || "No reason");
    await db.save();

    message.reply(`⚠️ Warned ${user.tag}`);
  }

  // ================= BAN (FIXED HARD) =================
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ No permission.");

    const member = message.mentions.members.first();
    if (!member) return message.reply("Mention user.");

    if (member.roles.highest.position >= message.member.roles.highest.position)
      return message.reply("❌ Cannot ban this user.");

    await member.ban();
    message.channel.send(`🔨 Banned ${member.user.tag}`);
  }

  // ================= PURGE =================
  if (cmd === "purge") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply("No permission.");

    const amount = parseInt(args[0]);
    if (!amount) return message.reply("Number required.");

    await message.channel.bulkDelete(amount);
    message.reply("🧹 Cleared.");
  }

  // ================= LEADERBOARD =================
  if (cmd === "leaderboard") {
    const top = await User.find().sort({ balance: -1 }).limit(5);

    const embed = new EmbedBuilder()
      .setTitle("📊 Leaderboard")
      .setColor("Gold")
      .setDescription(
        top.map((u, i) => `**${i + 1}.** <@${u.userId}> — 💰 ${u.balance}`).join("\n")
      );

    return message.reply({ embeds: [embed] });
  }

  // ================= TICKET PANEL =================
  if (cmd === "ticketpanel") {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Support Tickets")
      .setColor("Purple")
      .setDescription("Click below to create a ticket");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Success)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }
});

// ================= BUTTONS (TICKETS) =================
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;
  if (!isGuild(i.guild)) return;

  if (i.customId === "ticket_create") {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    activeTickets.set(i.user.id, channel.id);

    return i.reply({ content: `🎫 Ticket created: ${channel}`, ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);

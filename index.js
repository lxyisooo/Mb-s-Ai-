const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  ActivityType
} = require("discord.js");

const mongoose = require("mongoose");
const https = require("https");
require("dotenv").config();

// ================= CONFIG =================
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

// ================= USER MODEL =================
const userSchema = new mongoose.Schema({
  userId: String,
  warns: { type: Array, default: [] },
  afk: { type: String, default: null }
});
const User = mongoose.model("User", userSchema);

// ================= LOG SYSTEM =================
function log(guild, text) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;

  ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📜 LOG")
        .setColor("DarkRed")
        .setDescription(text)
    ]
  });
}

// ================= AI =================
async function ai(prompt) {
  const key = process.env.OPENAI_KEY;

  if (!key) return `🤖 AI (offline): ${prompt}`;

  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const req = https.request({
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      }
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try {
          resolve(JSON.parse(body).choices[0].message.content);
        } catch {
          resolve("AI error.");
        }
      });
    });

    req.write(data);
    req.end();
  });
}

// ================= SLASH RESET =================
const slashCommands = [
  { name: "ping", description: "Latency" },
  { name: "help", description: "Commands" },
  { name: "ai", description: "Ask AI" },
  { name: "afk", description: "Set AFK" }
];

// ================= READY =================
client.once("ready", async () => {
  console.log(`💀 ${client.user.tag} ONLINE`);

  client.user.setPresence({
    activities: [{ name: "Cod b07", type: ActivityType.playing }],
    status: "do not disturb"
  });

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  // PURGE OLD SLASH COMMANDS
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: slashCommands }
  );
});

// ================= MESSAGE =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.guild?.id !== GUILD_ID) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (!message.content.startsWith(PREFIX)) return;

  // ================= AFK SYSTEM =================
  if (cmd === "afk") {
    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    user.afk = args.join(" ") || "AFK";
    await user.save();

    return message.reply(`😴 AFK set: ${user.afk}`);
  }

  // remove AFK when chatting
  let afkUser = await User.findOne({ userId: message.author.id });
  if (afkUser?.afk) {
    afkUser.afk = null;
    await afkUser.save();
    message.channel.send(`👋 Welcome back ${message.author}`);
  }

  // ================= HELP =================
  if (cmd === "help") {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Help Menu")
          .setColor("DarkRed")
          .setDescription(`
🤖 AI
;ai

🛡 MOD
;ban ;warn ;purge ;kick

⚙ UTIL
;ping ;avatar ;userinfo ;serverinfo ;uptime

😴 AFK
;afk

🎫 TICKETS
;ticketpanel

🌐 SOCIAL
;roblox ;tiktok ;snapchat ;youtube ;twitch
          `)
      ]
    });
  }

  // ================= UTILITY =================
  if (cmd === "ping") return message.reply(`🏓 ${client.ws.ping}ms`);
  if (cmd === "avatar") return message.reply(message.author.displayAvatarURL());
  if (cmd === "uptime") return message.reply(`⏱ ${Math.floor(process.uptime())}s`);
  if (cmd === "serverinfo") return message.reply(`📡 ${message.guild.name}`);
  if (cmd === "userinfo") {
    const u = message.mentions.users.first() || message.author;
    return message.reply(`👤 ${u.tag}`);
  }

  // ================= AI =================
  if (cmd === "ai") {
    const res = await ai(args.join(" "));
    return message.reply(`🤖 ${res}`);
  }

  // ================= MODERATION =================
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply("No permission.");

    const m = message.mentions.members.first();
    if (!m) return message.reply("Mention user.");

    await m.ban();
    log(message.guild, `🔨 Ban: ${m.user.tag}`);
    return message.reply("Banned.");
  }

  if (cmd === "kick") {
    const m = message.mentions.members.first();
    if (!m) return;

    await m.kick();
    log(message.guild, `👢 Kick: ${m.user.tag}`);
  }

  if (cmd === "warn") {
    const u = message.mentions.users.first();
    let db = await User.findOne({ userId: u.id });
    if (!db) db = await User.create({ userId: u.id });

    db.warns.push(args.slice(1).join(" ") || "No reason");
    await db.save();

    log(message.guild, `⚠️ Warn: ${u.tag}`);
  }

  if (cmd === "purge") {
    const amt = parseInt(args[0]);
    await message.channel.bulkDelete(amt);
    log(message.guild, `🧹 Purge: ${amt}`);
  }

  // ================= SOCIAL =================
  if (cmd === "roblox") return message.reply("🌐 Roblox lookup ready");
  if (cmd === "tiktok") return message.reply("📱 TikTok lookup ready");
  if (cmd === "snapchat") return message.reply("👻 Snapchat lookup ready");
  if (cmd === "youtube") return message.reply("▶ YouTube lookup ready");
  if (cmd === "twitch") return message.reply("🎮 Twitch lookup ready");
});

// ================= SLASH =================
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.guildId !== GUILD_ID) return;

  if (i.commandName === "ping")
    return i.reply(`🏓 ${client.ws.ping}ms`);

  if (i.commandName === "ai") {
    const res = await ai(i.options.getString("message"));
    return i.reply(`🤖 ${res}`);
  }

  if (i.commandName === "afk") {
    return i.reply("AFK set via prefix ;afk for now");
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);

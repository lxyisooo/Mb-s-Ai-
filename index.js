const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
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
const THEME_COLOR = "#2b2d31"; 

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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("💾 Connected to Database"))
  .catch(err => console.error("❌ Database Error:", err));

const userSchema = new mongoose.Schema({
  userId: String,
  warns: { type: Array, default: [] },
  afk: { type: String, default: null }
});
const User = mongoose.model("User", userSchema);

// ================= HELPERS =================
function log(guild, text) {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!ch) return;
  ch.send({
    embeds: [new EmbedBuilder().setTitle("📜 System Log").setColor("DarkRed").setDescription(text).setTimestamp()]
  });
}

async function ai(prompt) {
  const key = process.env.OPENAI_KEY;
  if (!key) return `🤖 AI is currently offline.`;
  return new Promise((resolve) => {
    const data = JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] });
    const req = https.request({
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` }
    }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body).choices[0].message.content); } 
        catch { resolve("⚠️ AI encountered an error processing that."); }
      });
    });
    req.write(data);
    req.end();
  });
}

// ================= READY =================
client.once("ready", async () => {
  console.log(`💀 ${client.user.tag} ONLINE`);
  client.user.setPresence({ activities: [{ name: "MB's Videos", type: ActivityType.Watching }], status: "idle" });

  const slashCommands = [
    { name: "ping", description: "Latency check" },
    { name: "help", description: "Show premium menu" },
    { name: "ai", description: "Ask the AI a question" }
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: slashCommands });
  } catch (err) { console.error("Slash Error:", err); }
});

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // AFK Logic: Remove AFK
  const afkUser = await User.findOne({ userId: message.author.id });
  if (afkUser?.afk) {
    afkUser.afk = null;
    await afkUser.save();
    message.reply("💫 Welcome back! I've removed your AFK status.").then(m => setTimeout(() => m.delete(), 5000));
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  // --- PREMIUM HELP MENU ---
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setTitle("🔱 Help Menu")
      .setColor(THEME_COLOR)
      .setDescription("Welcome. Use the buttons below to navigate the command modules.")
      .setThumbnail(client.user.displayAvatarURL());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("h_mod").setLabel("Moderation").setStyle(ButtonStyle.Danger).setEmoji("🛡️"),
      new ButtonBuilder().setCustomId("h_util").setLabel("Utility").setStyle(ButtonStyle.Secondary).setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("h_social").setLabel("Socials").setStyle(ButtonStyle.Primary).setEmoji("🌐")
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  // --- UTILITY ---
  if (cmd === "ping") return message.reply(`🏓 **${client.ws.ping}ms**`);
  if (cmd === "uptime") return message.reply(`⏱ Running for: **${Math.floor(process.uptime())}s**`);
  if (cmd === "avatar") return message.reply(message.author.displayAvatarURL({ dynamic: true, size: 1024 }));
  
  if (cmd === "afk") {
    const reason = args.join(" ") || "AFK";
    await User.findOneAndUpdate({ userId: message.author.id }, { afk: reason }, { upsert: true });
    return message.reply(`😴 AFK status set: **${reason}**`);
  }

  // --- AI ---
  if (cmd === "ai") {
    const msg = await message.reply("🛰️ Processing request...");
    const res = await ai(args.join(" "));
    return msg.edit(`🤖 ${res}`);
  }

  // --- MODERATION ---
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return;
    const target = message.mentions.members.first();
    if (!target) return message.reply("Specify a user.");
    try {
      await target.ban();
      log(message.guild, `🔨 **Ban**: ${target.user.tag} by ${message.author.tag}`);
      message.reply(" 😂✌️ banned");
    } catch { message.reply("❌ Permission error."); }
  }

  if (cmd === "purge") {
    const amt = parseInt(args[0]);
    if (isNaN(amt) || amt > 1000) return message.reply("Enter 1-1000.");
    await message.channel.bulkDelete(amt, true);
    log(message.guild, `🧹 **Purge**: ${amt} messages in ${message.channel.name}`);
  }

  // --- SOCIALS ---
  const socials = { 
    roblox: "🌐 Roblox", tiktok: "📱 TikTok", snapchat: "👻 Snapchat", 
    youtube: "▶️ YouTube", twitch: "🎮 Twitch" 
  };
  if (socials[cmd]) return message.reply(`${socials[cmd]} lookup system initialized.`);
});

// ================= INTERACTION HANDLER =================
client.on("interactionCreate", async (i) => {
  if (i.isButton()) {
    const pages = {
      h_mod: "🛡️ **Moderation**\n`;ban` `;kick` `;warn` `;purge`",
      h_util: "⚙️ **Utility**\n`;ping` `;avatar` `;userinfo` `;uptime` `;afk` `;ai`",
      h_social: "🌐 **Socials**\n`;roblox` `;tiktok` `;snapchat` `;youtube` `;twitch`"
    };
    
    const newEmbed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle("Module Information")
      .setDescription(pages[i.customId]);
    
    await i.update({ embeds: [newEmbed] });
  }

  if (i.isChatInputCommand()) {
    if (i.commandName === "ping") await i.reply(`🏓 **${client.ws.ping}ms**`);
    if (i.commandName === "ai") {
        await i.deferReply();
        const res = await ai(i.options.getString("message") || "Hello");
        await i.editReply(`🤖 ${res}`);
    }
  }
});

client.login(process.env.TOKEN);

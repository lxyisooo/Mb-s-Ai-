// ============================================================
//  SpinBot — SlotBot-inspired economy & casino bot
//  Prefix: ~  |  discord.js v14  |  MongoDB
// ============================================================
require("dotenv").config();
const {
  Client, GatewayIntentBits, Partials,
  Collection, EmbedBuilder,
} = require("discord.js");
const mongoose = require("mongoose");
const express  = require("express");

// ── Keep-alive (Render free tier) ─────────────────────────────
const app = express();
app.get("/", (_, res) => res.send("SpinBot is alive!"));
app.listen(process.env.PORT || 3000);

// ── Client ────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── FIX: cooldowns Collection must be initialised on the client ──
client.cooldowns = new Collection();

const PREFIX    = process.env.PREFIX   || "~";
const CURRENCY  = "💎";
const CURR_NAME = "SpinBucks";

// ── Mongoose Schemas ──────────────────────────────────────────
const userSchema = new mongoose.Schema({
  userId        : { type: String, required: true },
  guildId       : { type: String, required: true },
  cash          : { type: Number, default: 500 },
  bank          : { type: Number, default: 0 },
  xp            : { type: Number, default: 0 },
  level         : { type: Number, default: 1 },
  inventory     : { type: [String], default: [] },
  lastDaily     : { type: Date,   default: null },
  lastWork      : { type: Date,   default: null },
  lastRob       : { type: Date,   default: null },
  lastAttack    : { type: Date,   default: null },
  lastWalletDrop: { type: Date,   default: null },
  lastBeg       : { type: Date,   default: null },
  lastDig       : { type: Date,   default: null },
  lastFish      : { type: Date,   default: null },
  lastHunt      : { type: Date,   default: null },
  lastCrime     : { type: Date,   default: null },
  marriedTo     : { type: String, default: null },
  marriedAt     : { type: Date,   default: null },
  goose: {
    name   : { type: String,  default: null },
    hunger : { type: Number,  default: 100  },
    lastFed: { type: Date,    default: null },
    alive  : { type: Boolean, default: false },
  },
  stunUntil     : { type: Date,   default: null },
  totalWon      : { type: Number, default: 0 },
  totalLost     : { type: Number, default: 0 },
  gamesPlayed   : { type: Number, default: 0 },
  streak        : { type: Number, default: 0 },
  // ── Farm ──
  farm: {
    plots : { type: Number, default: 2 },        // unlocked plot slots
    crops : { type: mongoose.Schema.Types.Mixed, default: {} }, // slot -> { crop, plantedAt }
    lastWatered: { type: Date, default: null },
  },
  // ── Pub ──
  pub: {
    drinkCount  : { type: Number, default: 0 },
    lastDrink   : { type: Date,   default: null },
    lastPubWork : { type: Date,   default: null },
    drunkUntil  : { type: Date,   default: null },
  },
  // ── Black Market ──
  bm: {
    lastVisit   : { type: Date,   default: null },
    heatLevel   : { type: Number, default: 0 },   // 0-100, too high = busted
    lastLaunder : { type: Date,   default: null },
  },
});
userSchema.index({ guildId: 1, cash: -1 });
const User = mongoose.model("SpinUser", userSchema);

// ── Helpers ───────────────────────────────────────────────────
const rand    = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const fmt     = (n) => Number(n).toLocaleString();
const cdLeft  = (date, ms) => Math.max(0, new Date(date).getTime() + ms - Date.now());
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

const ok  = (d) => ({ embeds: [{ color: 0x5865F2, description: `✅  ${d}` }] });
const err = (d) => ({ embeds: [{ color: 0xe24b4a, description: `❌  ${d}` }] });

// FIX: never pass empty string to setDescription — Discord.js v14 rejects it
const emb = (title, desc, color = 0x5865F2) => {
  const e = new EmbedBuilder().setColor(color).setTitle(title);
  if (desc && desc.trim().length > 0) e.setDescription(desc);
  return e;
};

async function getUser(userId, guildId) {
  let u = await User.findOne({ userId, guildId });
  if (!u) u = await User.create({ userId, guildId });
  return u;
}

// XP / Level helper
async function addXP(u, amount) {
  u.xp = (u.xp || 0) + amount;
  const needed = u.level * 100;
  if (u.xp >= needed) { u.xp -= needed; u.level++; return true; }
  return false;
}

// ── Command Map ───────────────────────────────────────────────
const cmds = {};
const reg  = (name, obj) => {
  cmds[name] = obj;
  (obj.aliases || []).forEach((a) => (cmds[a] = obj));
};

// ════════════════════════════════════════════════════════════
//  HELP & INFO
// ════════════════════════════════════════════════════════════
reg("help", {
  cat: "info", desc: "Show all commands or info on one",
  aliases: ["h", "commands"],
  async run(msg, args) {
    if (args[0]) {
      const c = cmds[args[0].toLowerCase()];
      if (!c) return msg.reply(err("Command not found."));
      return msg.reply({ embeds: [emb(`~${args[0]}`,
        `**Description:** ${c.desc}\n**Aliases:** ${c.aliases?.join(", ") || "none"}\n**Cooldown:** ${c.cd ? fmtTime(c.cd) : "none"}`)] });
    }
    const cats = {};
    for (const [k, v] of Object.entries(cmds)) {
      if (cmds[k] !== v) continue;
      (cats[v.cat] = cats[v.cat] || []).push(k);
    }
    const icons = { info: "📋", economy: "💰", casino: "🎰", social: "💍", goose: "🪿", fun: "😂", shop: "🛒", farm: "🌾", pub: "🍺", blackmarket: "🕵️" };
    const e = emb("🎰 SpinBot Commands", `Prefix: \`${PREFIX}\` · Use \`~help <cmd>\` for details\n\nA **${CURR_NAME}** economy & casino bot — not your average economy bot.`);
    for (const [cat, cs] of Object.entries(cats))
      e.addFields({ name: `${icons[cat] || "📦"} ${cat}`, value: cs.map((c) => `\`${c}\``).join(" ") });
    msg.reply({ embeds: [e] });
  },
});

reg("ping", {
  cat: "info", desc: "Check bot latency",
  async run(msg, _args, client) {
    const s = await msg.reply({ embeds: [{ color: 0xf0a500, description: "🏓 Pinging..." }] });
    s.edit({ embeds: [{ color: 0x5865F2, description: `🏓 Pong! **${s.createdTimestamp - msg.createdTimestamp}ms** · API **${Math.round(client.ws.ping)}ms**` }] });
  },
});

reg("botinfo", {
  cat: "info", desc: "Info about SpinBot",
  async run(msg, _args, client) {
    const total = await User.countDocuments();
    msg.reply({ embeds: [emb("🎰 SpinBot", "*Not your average economy bot.*")
      .addFields(
        { name: "Servers",  value: `${client.guilds.cache.size}`, inline: true },
        { name: "Players",  value: `${total}`,                   inline: true },
        { name: "Prefix",   value: `\`${PREFIX}\``,              inline: true },
        { name: "Currency", value: `${CURRENCY} ${CURR_NAME}`,   inline: true },
        { name: "Uptime",   value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
      )] });
  },
});

// ════════════════════════════════════════════════════════════
//  ECONOMY — BALANCE / BANK / DAILY / WORK / ROB / BEG / CRIME
// ════════════════════════════════════════════════════════════
reg("balance", {
  cat: "economy", desc: "Check your balance",
  aliases: ["bal", "wallet", "cash"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    msg.reply({ embeds: [emb(`${CURRENCY} ${t.username}'s Balance`)
      .addFields(
        { name: "💵 Cash",      value: `${CURRENCY} ${fmt(u.cash)}`,            inline: true },
        { name: "🏦 Bank",      value: `${CURRENCY} ${fmt(u.bank)}`,            inline: true },
        { name: "📊 Net Worth", value: `${CURRENCY} ${fmt(u.cash + u.bank)}`,   inline: true },
        { name: "⭐ Level",     value: `${u.level} (${u.xp} XP)`,               inline: true },
      )] });
  },
});

reg("deposit", {
  cat: "economy", desc: "Deposit cash into your bank",
  aliases: ["dep"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const amt = args[0]?.toLowerCase() === "all" ? u.cash : parseInt(args[0]);
    if (!amt || amt <= 0 || isNaN(amt)) return msg.reply(err("Provide a valid amount or `all`."));
    if (amt > u.cash) return msg.reply(err(`You only have ${CURRENCY} **${fmt(u.cash)}** in cash.`));
    u.cash -= amt; u.bank += amt; await u.save();
    msg.reply(ok(`Deposited ${CURRENCY} **${fmt(amt)}** → Bank: ${CURRENCY} **${fmt(u.bank)}**`));
  },
});

reg("withdraw", {
  cat: "economy", desc: "Withdraw cash from your bank",
  aliases: ["with"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const amt = args[0]?.toLowerCase() === "all" ? u.bank : parseInt(args[0]);
    if (!amt || amt <= 0 || isNaN(amt)) return msg.reply(err("Provide a valid amount or `all`."));
    if (amt > u.bank) return msg.reply(err(`You only have ${CURRENCY} **${fmt(u.bank)}** in your bank.`));
    u.bank -= amt; u.cash += amt; await u.save();
    msg.reply(ok(`Withdrew ${CURRENCY} **${fmt(amt)}** → Cash: ${CURRENCY} **${fmt(u.cash)}**`));
  },
});

reg("daily", {
  cat: "economy", desc: "Claim your daily SpinBucks",
  cd: 86400000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastDaily, 86400000);
    if (cd > 0) return msg.reply(err(`Daily resets in **${fmtTime(cd)}**.`));
    const base   = randInt(200, 400);
    const streak = Math.min((u.streak || 0) + 1, 30);
    const bonus  = Math.floor(base * (streak * 0.05));
    const total  = base + bonus;
    u.cash += total; u.lastDaily = new Date(); u.streak = streak;
    await u.save();
    msg.reply({ embeds: [emb("📅 Daily Claimed!", `${CURRENCY} **+${fmt(total)}** added to your wallet!\n\n🔥 **Streak:** ${streak} day${streak > 1 ? "s" : ""} (+${fmt(bonus)} bonus)`, 0x23a559)] });
  },
});

reg("work", {
  cat: "economy", desc: "Work for SpinBucks",
  aliases: ["grind"],
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastWork, 3600000);
    if (cd > 0) return msg.reply(err(`Work cooldown: **${fmtTime(cd)}** remaining.`));
    const jobs = ["dealt cards at the casino 🃏", "cleaned the slot machines 🎰",
                  "fixed a broken roulette wheel 🎡", "served drinks at the casino bar 🍹",
                  "counted chips for the house 💰", "drove the getaway car 🚗",
                  "secured the vault 🔒", "ran a quick errand for the boss 🧳",
                  "washed dishes at the buffet 🍽️", "shined shoes in the lobby 👞"];
    const pay = randInt(80, 180);
    u.cash += pay; u.lastWork = new Date();
    const leveled = await addXP(u, 10);
    await u.save();
    msg.reply({ embeds: [emb("💼 Work Complete",
      `You ${rand(jobs)} and earned ${CURRENCY} **${fmt(pay)}**!${leveled ? `\n\n⬆️ **Level up! You're now level ${u.level}!**` : ""}`, 0x23a559)] });
  },
});

reg("beg", {
  cat: "economy", desc: "Beg for some loose change",
  cd: 1800000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastBeg, 1800000);
    if (cd > 0) return msg.reply(err(`Beg cooldown: **${fmtTime(cd)}** remaining.`));
    const success = Math.random() < 0.7;
    u.lastBeg = new Date();
    if (success) {
      const amt = randInt(10, 80);
      u.cash += amt; await u.save();
      const lines = [
        `A kind stranger tossed you ${CURRENCY} **${fmt(amt)}** out of pity.`,
        `You held a sign outside the casino and earned ${CURRENCY} **${fmt(amt)}**.`,
        `Someone dropped ${CURRENCY} **${fmt(amt)}** in your cup.`,
        `A passing whale felt bad and gave you ${CURRENCY} **${fmt(amt)}**.`,
      ];
      msg.reply({ embeds: [emb("🙏 Begging Successful", rand(lines), 0x23a559)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("🙅 Nobody Cares", "People walked right past you. Try again later.", 0xe24b4a)] });
    }
  },
});

reg("crime", {
  cat: "economy", desc: "Commit a petty crime for cash",
  cd: 7200000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastCrime, 7200000);
    if (cd > 0) return msg.reply(err(`Crime cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastCrime = new Date();
    const success = Math.random() < 0.5;
    if (success) {
      const amt = randInt(150, 500);
      u.cash += amt;
      const crimes = ["pickpocketed a tourist 👜", "hacked an ATM 💻", "ran a street hustle 🎭",
                      "forged a winning lottery ticket 🎟️", "smuggled casino chips 🎰"];
      await u.save();
      msg.reply({ embeds: [emb("🦹 Crime Pays!", `You ${rand(crimes)} and got away with ${CURRENCY} **${fmt(amt)}**!`, 0x23a559)] });
    } else {
      const fine = randInt(100, 300);
      u.cash = Math.max(0, u.cash - fine);
      await u.save();
      msg.reply({ embeds: [emb("👮 Busted!", `You were caught and fined ${CURRENCY} **${fmt(fine)}**. Unlucky.`, 0xe24b4a)] });
    }
  },
});

reg("rob", {
  cat: "economy", desc: "Rob another player's wallet",
  cd: 7200000,
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id) return msg.reply(err("Mention a valid member to rob."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastRob, 7200000);
    if (cd > 0) return msg.reply(err(`Rob cooldown: **${fmtTime(cd)}** remaining.`));
    const tv = await getUser(target.id, msg.guild.id);
    if (tv.cash < 50) return msg.reply(err(`**${target.user.username}** is too broke to rob.`));
    const success = Math.random() < 0.45;
    u.lastRob = new Date();
    if (success) {
      const stolen = randInt(Math.floor(tv.cash * 0.1), Math.floor(tv.cash * 0.3));
      u.cash += stolen; tv.cash -= stolen;
      await u.save(); await tv.save();
      msg.reply({ embeds: [emb("🥷 Successful Heist!", `You swiped ${CURRENCY} **${fmt(stolen)}** from **${target.user.username}**!`, 0x23a559)] });
    } else {
      const fine = randInt(50, 150);
      u.cash = Math.max(0, u.cash - fine);
      await u.save();
      msg.reply({ embeds: [emb("🚔 Caught!", `You got caught and paid a ${CURRENCY} **${fmt(fine)}** fine!`, 0xe24b4a)] });
    }
  },
});

reg("give", {
  cat: "economy", desc: "Give SpinBucks to another player",
  aliases: ["pay", "transfer"],
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id || target.user.bot) return msg.reply(err("Mention a valid member."));
    const amt = parseInt(args[1]);
    if (!amt || amt <= 0) return msg.reply(err("Provide a valid amount."));
    const u = await getUser(msg.author.id, msg.guild.id);
    if (u.cash < amt) return msg.reply(err(`You only have ${CURRENCY} **${fmt(u.cash)}**.`));
    const tv = await getUser(target.id, msg.guild.id);
    u.cash -= amt; tv.cash += amt;
    await u.save(); await tv.save();
    msg.reply(ok(`Sent ${CURRENCY} **${fmt(amt)}** to **${target.user.username}**!`));
  },
});

reg("leaderboard", {
  cat: "economy", desc: "Top 10 richest players",
  aliases: ["lb", "top", "rich"],
  async run(msg) {
    const top = await User.find({ guildId: msg.guild.id }).sort({ cash: -1 }).limit(10);
    if (!top.length) return msg.reply(err("No players yet."));
    const medals = ["🥇", "🥈", "🥉"];
    const rows   = await Promise.all(top.map(async (u, i) => {
      const member = await msg.guild.members.fetch(u.userId).catch(() => null);
      const name   = member?.user.username || `<@${u.userId}>`;
      return `${medals[i] || `**${i + 1}.**`} ${name} — ${CURRENCY} **${fmt(u.cash)}**`;
    }));
    msg.reply({ embeds: [emb("🏆 SpinBucks Leaderboard", rows.join("\n"))] });
  },
});

reg("networth", {
  cat: "economy", desc: "Net worth leaderboard (cash + bank)",
  aliases: ["nw"],
  async run(msg) {
    const top = await User.find({ guildId: msg.guild.id }).limit(200);
    const sorted = top.sort((a, b) => (b.cash + b.bank) - (a.cash + a.bank)).slice(0, 10);
    if (!sorted.length) return msg.reply(err("No players yet."));
    const medals = ["🥇", "🥈", "🥉"];
    const rows   = await Promise.all(sorted.map(async (u, i) => {
      const member = await msg.guild.members.fetch(u.userId).catch(() => null);
      const name   = member?.user.username || `<@${u.userId}>`;
      return `${medals[i] || `**${i + 1}.**`} ${name} — ${CURRENCY} **${fmt(u.cash + u.bank)}**`;
    }));
    msg.reply({ embeds: [emb("🏆 Net Worth Leaderboard", rows.join("\n"))] });
  },
});

reg("stats", {
  cat: "economy", desc: "View your gambling stats",
  async run(msg, args) {
    const t   = msg.mentions.users.first() || msg.author;
    const u   = await getUser(t.id, msg.guild.id);
    const net = u.totalWon - u.totalLost;
    msg.reply({ embeds: [emb(`📊 ${t.username}'s Stats`)
      .addFields(
        { name: "🎮 Games Played", value: `${u.gamesPlayed}`,                inline: true },
        { name: "✅ Total Won",    value: `${CURRENCY} ${fmt(u.totalWon)}`,   inline: true },
        { name: "❌ Total Lost",   value: `${CURRENCY} ${fmt(u.totalLost)}`,  inline: true },
        { name: "📈 Net",          value: `${CURRENCY} ${fmt(net)} ${net >= 0 ? "📈" : "📉"}`, inline: true },
        { name: "⭐ Level",        value: `${u.level}`,                       inline: true },
        { name: "✨ XP",           value: `${u.xp} / ${u.level * 100}`,      inline: true },
      )] });
  },
});

reg("inventory", {
  cat: "economy", desc: "View your inventory",
  aliases: ["inv", "bag"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    const inv = u.inventory || [];
    if (!inv.length) return msg.reply(err(`**${t.username}** has nothing in their inventory.`));
    const counts = {};
    inv.forEach(i => counts[i] = (counts[i] || 0) + 1);
    const lines = Object.entries(counts).map(([item, n]) => `${item} ×${n}`).join("\n");
    msg.reply({ embeds: [emb(`🎒 ${t.username}'s Inventory`, lines)] });
  },
});

// ════════════════════════════════════════════════════════════
//  ADVENTURE — DIG / FISH / HUNT
// ════════════════════════════════════════════════════════════
reg("dig", {
  cat: "economy", desc: "Dig for buried treasure",
  aliases: ["shovel"],
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastDig, 3600000);
    if (cd > 0) return msg.reply(err(`Dig cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastDig = new Date();
    const roll = Math.random();
    if (roll < 0.05) {
      const amt = randInt(500, 2000);
      u.cash += amt; await u.save();
      msg.reply({ embeds: [emb("⛏️ Jackpot Find!", `You dug up a chest full of ${CURRENCY} **${fmt(amt)}**! 🪙`, 0xf5c518)] });
    } else if (roll < 0.4) {
      const amt = randInt(20, 150);
      u.cash += amt; await u.save();
      msg.reply({ embeds: [emb("⛏️ Digging...", `You found ${CURRENCY} **${fmt(amt)}** buried in the dirt!`, 0x23a559)] });
    } else if (roll < 0.65) {
      const items = ["🪨 Old Rock", "🦴 Bone", "🪱 Worm", "🥫 Old Can", "🔩 Rusty Bolt"];
      const item = rand(items);
      u.inventory.push(item); await u.save();
      msg.reply({ embeds: [emb("⛏️ Digging...", `You found a **${item}** in the ground. Not exactly treasure...`, 0xf0a500)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("⛏️ Nothing.", "You dug for hours and found absolutely nothing. Just dirt.", 0xe24b4a)] });
    }
  },
});

reg("fish", {
  cat: "economy", desc: "Go fishing for cash or items",
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastFish, 3600000);
    if (cd > 0) return msg.reply(err(`Fish cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastFish = new Date();
    const roll = Math.random();
    if (roll < 0.05) {
      const amt = randInt(600, 2500);
      u.cash += amt; await u.save();
      msg.reply({ embeds: [emb("🎣 Legendary Catch!", `You reeled in a **Giant Tuna** and sold it for ${CURRENCY} **${fmt(amt)}**! 🐟`, 0xf5c518)] });
    } else if (roll < 0.45) {
      const fish = ["🐟 Common Fish", "🐠 Tropical Fish", "🐡 Pufferfish", "🦈 Baby Shark", "🦞 Lobster"];
      const catch_ = rand(fish);
      const amt    = randInt(30, 200);
      u.cash += amt; await u.save();
      msg.reply({ embeds: [emb("🎣 Caught Something!", `You caught a **${catch_}** and sold it for ${CURRENCY} **${fmt(amt)}**!`, 0x23a559)] });
    } else if (roll < 0.6) {
      const junk = ["👟 Old Boot", "🧦 Wet Sock", "🪣 Rusty Bucket", "📱 Broken Phone"];
      const item = rand(junk);
      u.inventory.push(item); await u.save();
      msg.reply({ embeds: [emb("🎣 Caught Junk", `You fished up a **${item}**. Yikes.`, 0xf0a500)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("🎣 No Luck", "The fish weren't biting today. Try again later.", 0xe24b4a)] });
    }
  },
});

reg("hunt", {
  cat: "economy", desc: "Go hunting in the wild",
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastHunt, 3600000);
    if (cd > 0) return msg.reply(err(`Hunt cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastHunt = new Date();
    const roll = Math.random();
    if (roll < 0.05) {
      const amt = randInt(700, 3000);
      u.cash += amt; await u.save();
      msg.reply({ embeds: [emb("🏹 Trophy Kill!", `You hunted a **Legendary Bear** and sold the pelt for ${CURRENCY} **${fmt(amt)}**! 🐻`, 0xf5c518)] });
    } else if (roll < 0.5) {
      const animals = ["🐇 Rabbit", "🦆 Duck", "🦌 Deer", "🦊 Fox", "🐗 Boar"];
      const animal  = rand(animals);
      const amt     = randInt(50, 300);
      u.cash += amt; await u.save();
      msg.reply({ embeds: [emb("🏹 Nice Catch!", `You hunted a **${animal}** and sold it for ${CURRENCY} **${fmt(amt)}**!`, 0x23a559)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("🏹 Empty Handed", "Nothing was around to hunt today. Better luck next time.", 0xe24b4a)] });
    }
  },
});

// ════════════════════════════════════════════════════════════
//  SHOP & ITEMS
// ════════════════════════════════════════════════════════════
const SHOP_ITEMS = {
  "🍀 Lucky Clover":   { price: 500,  desc: "Adds +5% win chance on next casino game." },
  "🛡️ Robber Shield":  { price: 800,  desc: "Blocks the next rob attempt against you." },
  "💊 Goose Pill":     { price: 300,  desc: "Revives your dead goose." },
  "🎩 High Roller Hat":{ price: 2000, desc: "Doubles your next slots win." },
  "🧲 Pickpocket Kit": { price: 600,  desc: "+20% steal rate on your next rob." },
};

reg("shop", {
  cat: "shop", desc: "View the item shop",
  aliases: ["store"],
  async run(msg) {
    const lines = Object.entries(SHOP_ITEMS).map(([name, d]) =>
      `**${name}** — ${CURRENCY} **${fmt(d.price)}**\n> ${d.desc}`).join("\n\n");
    msg.reply({ embeds: [emb("🛒 SpinBot Shop", `${lines}\n\nUse \`~buy <item name>\` to purchase.`)] });
  },
});

reg("buy", {
  cat: "shop", desc: "Buy an item from the shop",
  async run(msg, args) {
    const name = args.join(" ");
    const item = Object.keys(SHOP_ITEMS).find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (!item) return msg.reply(err(`Item not found. Use \`~shop\` to see what's available.`));
    const u = await getUser(msg.author.id, msg.guild.id);
    const { price } = SHOP_ITEMS[item];
    if (u.cash < price) return msg.reply(err(`You need ${CURRENCY} **${fmt(price)}**. You have **${fmt(u.cash)}**.`));
    u.cash -= price;
    u.inventory.push(item);
    await u.save();
    msg.reply(ok(`You bought **${item}** for ${CURRENCY} **${fmt(price)}**!`));
  },
});

reg("use", {
  cat: "shop", desc: "Use an item from your inventory",
  async run(msg, args) {
    const name = args.join(" ");
    const u    = await getUser(msg.author.id, msg.guild.id);
    const inv  = u.inventory || [];
    const idx  = inv.findIndex(i => i.toLowerCase().includes(name.toLowerCase()));
    if (idx === -1) return msg.reply(err(`You don't have that item. Check \`~inventory\`.`));
    const item = inv.splice(idx, 1)[0];
    await u.save();
    if (item.includes("Goose Pill")) {
      if (u.goose.alive) return msg.reply(err("Your goose is already alive!"));
      u.goose.alive = true; u.goose.hunger = 100; u.goose.lastFed = new Date();
      await u.save();
      return msg.reply({ embeds: [emb("💊 Goose Revived!", `Your goose **${u.goose.name || "Unnamed"}** is alive again! 🪿`, 0x23a559)] });
    }
    msg.reply(ok(`Used **${item}**! (Effect applied to your next action.)`));
  },
});

// ════════════════════════════════════════════════════════════
//  CASINO — SLOTS / FLIP / DICE / BLACKJACK / ROULETTE / CRASH
//           + SCRATCH / LOTTERY / HORSE / HI-LO / TOWER
// ════════════════════════════════════════════════════════════
reg("slots", {
  cat: "casino", desc: "Spin the slot machine",
  aliases: ["slot", "spin"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10)      return msg.reply(err(`Minimum bet is ${CURRENCY} **10**.`));
    if (bet > 100000)  return msg.reply(err(`Maximum bet is ${CURRENCY} **100,000**.`));
    if (u.cash < bet)  return msg.reply(err(`You need ${CURRENCY} **${fmt(bet)}** to bet. You have **${fmt(u.cash)}**.`));

    const symbols = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "🔔", "🎰"];
    const weights = [30,    25,   20,   12,   7,    3,    2,    1  ];
    const pick = () => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return symbols[i]; }
      return symbols[0];
    };

    const reels = [pick(), pick(), pick()];
    const display = `[ ${reels.join("  |  ")} ]`;
    let mult = 0, label = "";

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      const jackpots = { "🎰": 100, "💎": 50, "⭐": 20, "🔔": 10 };
      mult  = jackpots[reels[0]] || 5;
      label = mult >= 20 ? "🎉 JACKPOT!!" : "✨ Three of a kind!";
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      mult  = 2;
      label = "🎯 Two of a kind!";
    } else {
      label = "💨 No match.";
    }

    const payout = mult > 0 ? bet * mult : 0;
    const net    = payout - bet;
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();

    const color  = net > 0 ? 0x23a559 : 0xe24b4a;
    const result = net > 0
      ? `${label}\n\n${CURRENCY} **+${fmt(payout)}** (×${mult})\nBalance: **${fmt(u.cash)}**`
      : `${label}\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(u.cash)}**`;

    msg.reply({ embeds: [new EmbedBuilder().setColor(color)
      .setTitle("🎰 Slot Machine")
      .setDescription(`\`\`\`\n${display}\n\`\`\`\n${result}`)] });
  },
});

reg("flip", {
  cat: "casino", desc: "Bet on a coin flip",
  aliases: ["coinflip", "cf"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseInt(args[0]) || 50;
    const side = (args[1] || rand(["heads", "tails"])).toLowerCase();
    if (!["heads","tails","h","t"].includes(side)) return msg.reply(err("Choose `heads` or `tails`."));
    if (bet < 10 || bet > 100000)  return msg.reply(err("Bet must be 10–100,000."));
    if (u.cash < bet)              return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const pick   = ["heads","heads","heads","heads","tails","tails","tails","edge"];
    const result = rand(pick);
    const norm   = side === "h" ? "heads" : side === "t" ? "tails" : side;
    const edge   = result === "edge";
    let net;
    if (edge)                { net = bet * 5; u.cash += net; }
    else if (norm === result){ net = bet;     u.cash += net; }
    else                     { net = -bet;    u.cash += net; }
    u.gamesPlayed++; if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();
    const emoji = result === "heads" ? "🪙 Heads" : result === "tails" ? "🌑 Tails" : "😱 EDGE";
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🪙 Coin Flip")
      .setDescription(`Result: **${emoji}**\nYou picked: **${norm}**\n\n${net > 0 ? `${CURRENCY} **+${fmt(Math.abs(net))}**` : `${CURRENCY} **-${fmt(Math.abs(net))}**`}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

reg("roll", {
  cat: "casino", desc: "Roll dice — predict higher or lower",
  aliases: ["dice"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    const dir = args[1]?.toLowerCase();
    if (!["high","low","h","l"].includes(dir)) return msg.reply(err("Usage: `~roll <bet> <high|low>`"));
    if (bet < 10 || bet > 100000) return msg.reply(err("Bet: 10–100,000."));
    if (u.cash < bet)             return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const roll = randInt(1, 12);
    const won  = (["high","h"].includes(dir) && roll >= 7) || (["low","l"].includes(dir) && roll <= 6);
    const net  = won ? bet : -bet;
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();
    const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","🎲"];
    msg.reply({ embeds: [new EmbedBuilder().setColor(won ? 0x23a559 : 0xe24b4a)
      .setTitle("🎲 Dice Roll")
      .setDescription(`${nums[roll - 1]} **Rolled ${roll}** (predicted ${dir})\n\n${won ? `${CURRENCY} **+${fmt(bet)}**` : `${CURRENCY} **-${fmt(bet)}**`}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

reg("blackjack", {
  cat: "casino", desc: "Play blackjack against the house",
  aliases: ["bj"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10 || bet > 50000) return msg.reply(err("Bet: 10–50,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));

    const suits = ["♠","♥","♦","♣"];
    const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    const deck  = suits.flatMap(s => ranks.map(r => ({ r, s }))).sort(() => Math.random() - 0.5);
    const val   = (hand) => {
      let v = 0, aces = 0;
      hand.forEach(c => { v += ["J","Q","K"].includes(c.r) ? 10 : c.r === "A" ? 11 : parseInt(c.r); if (c.r === "A") aces++; });
      while (v > 21 && aces-- > 0) v -= 10;
      return v;
    };
    const show = (hand) => hand.map(c => `\`${c.r}${c.s}\``).join(" ");

    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];

    if (val(player) === 21) {
      const payout = Math.floor(bet * 1.5);
      u.cash += payout; u.gamesPlayed++; u.totalWon += payout; await u.save();
      return msg.reply({ embeds: [emb("🃏 Blackjack — Natural 21! 🎉",
        `Your hand: ${show(player)} **(21)**\nDealer: ${show([dealer[0]])} **?**\n\n${CURRENCY} **+${fmt(payout)}** (3:2)\nBalance: **${fmt(u.cash)}**`, 0x23a559)] });
    }

    const makeEmbed = (ph, dh, result = null, color = 0x5865F2) => {
      let desc = `**Your hand:** ${show(ph)} **(${val(ph)})**\n**Dealer shows:** ${result ? show(dh) + ` **(${val(dh)})**` : show([dh[0]]) + " **?**"}`;
      desc += result ? `\n\n${result}` : "\n\nType `hit` or `stand`";
      return new EmbedBuilder().setColor(color).setTitle("🃏 Blackjack").setDescription(desc);
    };

    await msg.reply({ embeds: [makeEmbed(player, dealer)] });
    const filter = m => m.author.id === msg.author.id && ["hit","stand","h","s"].includes(m.content.toLowerCase());
    const coll   = msg.channel.createMessageCollector({ filter, time: 30000, max: 10 });

    coll.on("collect", async (m) => {
      if (m.content.toLowerCase() === "hit" || m.content.toLowerCase() === "h") {
        player.push(deck.pop());
        const pv = val(player);
        if (pv > 21) {
          u.cash -= bet; u.gamesPlayed++; u.totalLost += bet; await u.save(); coll.stop();
          return msg.channel.send({ embeds: [makeEmbed(player, dealer, `💥 Bust! **${pv}**\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(u.cash)}**`, 0xe24b4a)] });
        }
        if (pv === 21) { coll.stop(); settle(); }
        else msg.channel.send({ embeds: [makeEmbed(player, dealer)] });
      } else { coll.stop(); settle(); }
    });

    coll.on("end", (_, reason) => { if (reason === "time") msg.channel.send(err("Blackjack timed out.")); });

    async function settle() {
      while (val(dealer) < 17) dealer.push(deck.pop());
      const pv = val(player), dv = val(dealer);
      let net2, resultText, color;
      if (dv > 21 || pv > dv)  { net2 = bet;  resultText = `🎉 You win! **(${pv} vs ${dv})**\n${CURRENCY} **+${fmt(bet)}**`; color = 0x23a559; }
      else if (pv === dv)       { net2 = 0;    resultText = `🤝 Push! **(${pv} vs ${dv})**\nBet returned.`;                  color = 0xf0a500; }
      else                      { net2 = -bet; resultText = `😢 Dealer wins. **(${pv} vs ${dv})**\n${CURRENCY} **-${fmt(bet)}**`; color = 0xe24b4a; }
      u.cash += net2; u.gamesPlayed++;
      if (net2 > 0) u.totalWon += net2; else if (net2 < 0) u.totalLost += Math.abs(net2);
      await u.save();
      msg.channel.send({ embeds: [makeEmbed(player, dealer, `${resultText}\nBalance: **${fmt(u.cash)}**`, color)] });
    }
  },
});

reg("roulette", {
  cat: "casino", desc: "Bet on roulette (red/black/green/number)",
  aliases: ["rl"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseInt(args[0]) || 50;
    const pick = args[1]?.toLowerCase();
    if (!pick) return msg.reply(err("Usage: `~roulette <bet> <red|black|green|0-36>`"));
    if (bet < 10 || bet > 100000) return msg.reply(err("Bet: 10–100,000."));
    if (u.cash < bet)             return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const spin   = randInt(0, 36);
    const reds   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const colour = spin === 0 ? "green" : reds.includes(spin) ? "red" : "black";
    const emoji  = spin === 0 ? "💚" : colour === "red" ? "🔴" : "⚫";
    let mult = 0;
    if (pick === colour)              mult = pick === "green" ? 14 : 2;
    else if (parseInt(pick) === spin) mult = 36;
    const net = mult > 0 ? bet * (mult - 1) : -bet;
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🎡 Roulette")
      .setDescription(`${emoji} Ball landed on **${spin} (${colour})**\nYou bet: **${pick}** (×${mult || 0})\n\n${net >= 0 ? `${CURRENCY} **+${fmt(net)}**` : `${CURRENCY} **-${fmt(Math.abs(net))}**`}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

reg("crash", {
  cat: "casino", desc: "Ride the multiplier — cash out before it crashes!",
  aliases: ["cr"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10 || bet > 50000) return msg.reply(err("Bet: 10–50,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const crash = +(Math.max(1, (100 / (Math.random() * 100 + 1))).toFixed(2));
    let mult    = 1.00;
    const sent  = await msg.channel.send({ embeds: [emb("🚀 CRASH", `Multiplier: **${mult.toFixed(2)}×**\n\nType \`cashout\` to cash out!\nBet: ${CURRENCY} **${fmt(bet)}**`)] });
    const interval = setInterval(() => {
      mult = +(mult + (mult < 2 ? 0.07 : mult < 5 ? 0.15 : 0.3)).toFixed(2);
      if (mult >= crash) { clearInterval(interval); finish(null); return; }
      sent.edit({ embeds: [emb("🚀 CRASH", `Multiplier: **${mult.toFixed(2)}×** 🟢\n\nType \`cashout\` before it crashes!\nBet: ${CURRENCY} **${fmt(bet)}**`)] }).catch(() => {});
    }, 1200);
    const filter = m => m.author.id === msg.author.id && m.content.toLowerCase() === "cashout";
    const coll   = msg.channel.createMessageCollector({ filter, time: 30000, max: 1 });
    coll.on("collect", () => { clearInterval(interval); finish(mult); });
    coll.on("end", (_, reason) => { if (reason === "time") { clearInterval(interval); finish(null); } });
    async function finish(cashedAt) {
      const crashed = cashedAt === null;
      const net     = crashed ? -bet : Math.floor(bet * cashedAt) - bet;
      u.cash += net; u.gamesPlayed++;
      if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
      await u.save();
      const desc = crashed
        ? `💥 Crashed at **${crash.toFixed(2)}×**!\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(u.cash)}**`
        : `✅ Cashed out at **${cashedAt.toFixed(2)}×** (crashed at ${crash.toFixed(2)}×)\n\n${CURRENCY} **+${fmt(net)}**\nBalance: **${fmt(u.cash)}**`;
      sent.edit({ embeds: [new EmbedBuilder().setColor(crashed ? 0xe24b4a : 0x23a559).setTitle("🚀 CRASH Result").setDescription(desc)] });
    }
  },
});

reg("scratch", {
  cat: "casino", desc: "Buy and scratch a scratch card",
  aliases: ["scratchcard", "sc"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const cost = 50;
    if (u.cash < cost) return msg.reply(err(`Scratch cards cost ${CURRENCY} **${fmt(cost)}**.`));
    u.cash -= cost;
    const symbols = ["💎","⭐","🍒","🔔","💰","❌"];
    const weights  = [1,   4,   10,   8,   6,   20];
    const pick = () => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return symbols[i]; }
      return symbols[5];
    };
    const grid = Array.from({ length: 9 }, pick);
    const payouts = { "💎": 5000, "⭐": 500, "🍒": 150, "🔔": 100, "💰": 80 };
    const counts  = {};
    grid.forEach(s => { if (s !== "❌") counts[s] = (counts[s] || 0) + 1; });
    let win = 0;
    for (const [sym, count] of Object.entries(counts)) {
      if (count >= 3) win = Math.max(win, (payouts[sym] || 0) * (count - 2));
    }
    u.cash += win; u.gamesPlayed++;
    if (win > 0) u.totalWon += win; else u.totalLost += cost;
    await u.save();
    const rows = [0,3,6].map(i => grid.slice(i, i+3).join("  ")).join("\n");
    const desc = `\`\`\`\n${rows}\n\`\`\`\n${win > 0 ? `🎉 You won ${CURRENCY} **${fmt(win)}**!` : `No match. Better luck next time!`}\nBalance: **${fmt(u.cash)}**`;
    msg.reply({ embeds: [new EmbedBuilder().setColor(win > 0 ? 0x23a559 : 0xe24b4a).setTitle("🎟️ Scratch Card").setDescription(desc)] });
  },
});

// Lottery pool per guild stored in-memory
const lotteryPools = new Map(); // guildId -> { pool, tickets: Map<userId, count> }

reg("lottery", {
  cat: "casino", desc: "Buy lottery tickets — jackpot drawn when enough players join",
  aliases: ["lotto"],
  async run(msg, args) {
    const amt = parseInt(args[0]) || 1;
    if (amt < 1 || amt > 10) return msg.reply(err("Buy 1–10 tickets at a time."));
    const ticketPrice = 100;
    const u = await getUser(msg.author.id, msg.guild.id);
    const total = ticketPrice * amt;
    if (u.cash < total) return msg.reply(err(`You need ${CURRENCY} **${fmt(total)}** for ${amt} ticket(s).`));
    u.cash -= total; await u.save();

    if (!lotteryPools.has(msg.guild.id)) lotteryPools.set(msg.guild.id, { pool: 0, tickets: new Map() });
    const lotto = lotteryPools.get(msg.guild.id);
    lotto.pool += total;
    lotto.tickets.set(msg.author.id, (lotto.tickets.get(msg.author.id) || 0) + amt);

    const totalTickets = [...lotto.tickets.values()].reduce((a, b) => a + b, 0);
    msg.reply({ embeds: [emb("🎟️ Lottery Tickets Bought!", `You bought **${amt}** ticket(s)!\n\nPool: ${CURRENCY} **${fmt(lotto.pool)}**\nTotal Tickets: **${totalTickets}**\n\nUse \`~drawlottery\` when ready to draw!`)] });
  },
});

reg("drawlottery", {
  cat: "casino", desc: "Draw the lottery winner",
  aliases: ["drawlotto"],
  async run(msg) {
    const lotto = lotteryPools.get(msg.guild.id);
    if (!lotto || lotto.tickets.size < 2) return msg.reply(err("Not enough players in the lottery yet (need at least 2)."));
    const pool = [];
    for (const [uid, count] of lotto.tickets.entries()) {
      for (let i = 0; i < count; i++) pool.push(uid);
    }
    const winnerId = rand(pool);
    const prize    = Math.floor(lotto.pool * 0.9);
    lotteryPools.delete(msg.guild.id);
    const winner = await getUser(winnerId, msg.guild.id);
    winner.cash += prize; await winner.save();
    msg.channel.send({ embeds: [emb("🎟️ Lottery Draw!", `🎉 <@${winnerId}> wins the lottery!\n\nPrize: ${CURRENCY} **${fmt(prize)}** (10% house cut)`, 0xf5c518)] });
  },
});

reg("hilo", {
  cat: "casino", desc: "Guess if the next card is higher or lower",
  aliases: ["highlow"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10 || bet > 50000) return msg.reply(err("Bet: 10–50,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));

    const rankVals = { A:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, J:11, Q:12, K:13 };
    const ranks    = Object.keys(rankVals);
    const suits    = ["♠","♥","♦","♣"];
    const randCard = () => ({ r: rand(ranks), s: rand(suits) });

    const first = randCard();
    await msg.reply({ embeds: [emb("🃏 Hi-Lo", `Current card: **${first.r}${first.s}**\n\nType \`higher\` or \`lower\` within 15 seconds!`)] });

    const filter = m => m.author.id === msg.author.id && ["higher","lower","h","l"].includes(m.content.toLowerCase());
    const coll   = await msg.channel.awaitMessages({ filter, max: 1, time: 15000 }).catch(() => null);
    if (!coll?.size) return msg.channel.send(err("Hi-Lo timed out."));

    const guess  = coll.first().content.toLowerCase();
    const second = randCard();
    const fv     = rankVals[first.r], sv = rankVals[second.r];
    const won    = (["higher","h"].includes(guess) && sv > fv) || (["lower","l"].includes(guess) && sv < fv);
    const tie    = sv === fv;
    const net    = tie ? 0 : won ? bet : -bet;
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else if (net < 0) u.totalLost += Math.abs(net);
    await u.save();

    const result = tie ? `🤝 Tie! **${second.r}${second.s}** — bet returned.`
      : won ? `✅ Correct! **${second.r}${second.s}**\n\n${CURRENCY} **+${fmt(bet)}**`
      : `❌ Wrong! **${second.r}${second.s}**\n\n${CURRENCY} **-${fmt(bet)}**`;
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(net >= 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🃏 Hi-Lo Result").setDescription(`${result}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

reg("horse", {
  cat: "casino", desc: "Bet on a horse race",
  aliases: ["race", "horses"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseInt(args[0]) || 50;
    const pick = parseInt(args[1]);
    if (!pick || pick < 1 || pick > 4) return msg.reply(err("Usage: `~horse <bet> <1-4>` — pick horse 1, 2, 3, or 4."));
    if (bet < 10 || bet > 50000) return msg.reply(err("Bet: 10–50,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));

    const names  = ["⚡ Thunder", "🌪️ Cyclone", "🔥 Inferno", "💧 Tsunami"];
    const odds   = [2, 3, 4, 5]; // Horse 1 favourite, horse 4 underdog
    const winner = randInt(1, 4);

    // Weighted — horse 1 wins more often
    const weights2 = [40, 28, 20, 12];
    let r = Math.random() * 100, wonHorse = 1;
    for (let i = 0; i < weights2.length; i++) { r -= weights2[i]; if (r <= 0) { wonHorse = i + 1; break; } }

    const won = pick === wonHorse;
    const net = won ? bet * (odds[pick - 1] - 1) : -bet;
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();

    const raceLines = names.map((n, i) => `${n} ${i + 1 === wonHorse ? "🏆" : "  "}  (${odds[i]}:1)`).join("\n");
    const result    = won
      ? `🏆 **${names[pick-1]}** won! You picked correctly!\n\n${CURRENCY} **+${fmt(net)}**`
      : `**${names[wonHorse-1]}** won. You picked ${names[pick-1]}.\n\n${CURRENCY} **-${fmt(bet)}**`;
    msg.reply({ embeds: [new EmbedBuilder().setColor(won ? 0x23a559 : 0xe24b4a)
      .setTitle("🐎 Horse Race Results")
      .setDescription(`${raceLines}\n\n${result}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

reg("tower", {
  cat: "casino", desc: "Climb the tower — cash out before you fall!",
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10 || bet > 30000) return msg.reply(err("Bet: 10–30,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));

    let floor = 0;
    const maxFloor = 10;
    const fallChance = (f) => 0.1 + f * 0.08; // increases with each floor
    const multiplier = (f) => +(1 + f * 0.4).toFixed(2);

    const sendFloor = (extra = "") =>
      `🏰 **Tower — Floor ${floor}/${maxFloor}**\nMultiplier: **${multiplier(floor)}×**\n\nType \`climb\` to go higher or \`cashout\` to take your winnings!\nFall chance next floor: **${Math.round(fallChance(floor + 1) * 100)}%**${extra}`;

    const sent = await msg.channel.send({ embeds: [emb("🏰 Tower", sendFloor())] });
    const filter = m => m.author.id === msg.author.id && ["climb","cashout","c"].includes(m.content.toLowerCase());
    const coll   = msg.channel.createMessageCollector({ filter, time: 45000, max: 15 });

    coll.on("collect", async (m) => {
      const action = m.content.toLowerCase();
      if (action === "cashout") {
        coll.stop("cashout");
        const net = Math.floor(bet * multiplier(floor)) - bet;
        u.cash += net + bet; u.gamesPlayed++;
        if (net >= 0) u.totalWon += net; else u.totalLost += Math.abs(net);
        await u.save();
        sent.edit({ embeds: [emb("🏰 Tower — Cashed Out!",
          `You cashed out at floor **${floor}** (×${multiplier(floor)})!\n\n${CURRENCY} **+${fmt(Math.floor(bet * multiplier(floor)))}**\nBalance: **${fmt(u.cash)}**`, 0x23a559)] });
      } else {
        if (floor >= maxFloor) { coll.stop("top"); return; }
        floor++;
        if (Math.random() < fallChance(floor)) {
          coll.stop("fell");
          u.cash -= bet; u.gamesPlayed++; u.totalLost += bet; await u.save();
          sent.edit({ embeds: [emb("💥 You Fell!", `You fell on floor **${floor}**!\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(u.cash)}**`, 0xe24b4a)] });
        } else {
          sent.edit({ embeds: [emb("🏰 Tower", sendFloor())] });
        }
      }
    });

    coll.on("end", async (_, reason) => {
      if (reason === "top") {
        const net = Math.floor(bet * multiplier(maxFloor)) - bet;
        u.cash += net + bet; u.gamesPlayed++; u.totalWon += net; await u.save();
        sent.edit({ embeds: [emb("🏰 Tower — CONQUERED!", `You reached the TOP (×${multiplier(maxFloor)})!\n\n${CURRENCY} **+${fmt(Math.floor(bet * multiplier(maxFloor)))}**\nBalance: **${fmt(u.cash)}**`, 0xf5c518)] });
      } else if (reason === "time") {
        msg.channel.send(err("Tower timed out — you fell!"));
      }
    });
  },
});

reg("snakeeyes", {
  cat: "casino", desc: "Roll two dice — snake eyes pays 10x!",
  aliases: ["se"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10 || bet > 20000) return msg.reply(err("Bet: 10–20,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const d1 = randInt(1, 6), d2 = randInt(1, 6);
    const sum = d1 + d2;
    const faces = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
    let net, desc;
    if (d1 === 1 && d2 === 1) { net = bet * 10;  desc = `🎲 **SNAKE EYES!** ${faces[d1]} ${faces[d2]}\n\n${CURRENCY} **+${fmt(net)}** (×10)`; }
    else if (d1 === d2)        { net = bet;       desc = `🎲 **Doubles!** ${faces[d1]} ${faces[d2]}\n\n${CURRENCY} **+${fmt(net)}** (×2)`; }
    else if (sum >= 10)        { net = Math.floor(bet * 0.5); desc = `🎲 **High roll!** ${faces[d1]} ${faces[d2]} = ${sum}\n\n${CURRENCY} **+${fmt(net)}** (×1.5)`; }
    else                       { net = -bet;      desc = `🎲 ${faces[d1]} ${faces[d2]} = ${sum}\n\n${CURRENCY} **-${fmt(bet)}**`; }
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🎲 Snake Eyes").setDescription(`${desc}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

// ════════════════════════════════════════════════════════════
//  SOCIAL — MARRY / DIVORCE / ATTACK / SCAM
// ════════════════════════════════════════════════════════════
reg("marry", {
  cat: "social", desc: "Propose to another player",
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id || target.user.bot) return msg.reply(err("Mention a valid member."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const tv = await getUser(target.id, msg.guild.id);
    if (u.marriedTo)  return msg.reply(err(`You're already married to <@${u.marriedTo}>! Use \`~divorce\` first.`));
    if (tv.marriedTo) return msg.reply(err(`**${target.user.username}** is already married!`));
    await msg.channel.send({ embeds: [emb("💍 Marriage Proposal!", `**${msg.author.username}** is proposing to **${target.user.username}**!\n\n${target.user.username}, type \`accept\` or \`decline\` within 30s.`)] });
    const filter = m => m.author.id === target.id && ["accept","decline"].includes(m.content.toLowerCase());
    const collected = await msg.channel.awaitMessages({ filter, max: 1, time: 30000 }).catch(() => null);
    if (!collected?.size || collected.first().content.toLowerCase() === "decline")
      return msg.channel.send(err(`**${target.user.username}** declined the proposal. 💔`));
    u.marriedTo = target.id; u.marriedAt = new Date();
    tv.marriedTo = msg.author.id; tv.marriedAt = new Date();
    await u.save(); await tv.save();
    msg.channel.send({ embeds: [emb("💍 Just Married!", `🎉 **${msg.author.username}** and **${target.user.username}** are now married!\nMay your SpinBucks multiply together. 💑`, 0xf5c518)] });
  },
});

reg("divorce", {
  cat: "social", desc: "Divorce your partner",
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.marriedTo) return msg.reply(err("You're not married."));
    const partner = await User.findOne({ userId: u.marriedTo, guildId: msg.guild.id });
    if (partner) { partner.marriedTo = null; await partner.save(); }
    const fine = randInt(50, 200);
    u.cash = Math.max(0, u.cash - fine);
    u.marriedTo = null; u.marriedAt = null;
    await u.save();
    msg.reply({ embeds: [emb("💔 Divorced", `You paid ${CURRENCY} **${fmt(fine)}** in legal fees.\nYou are now single.`, 0xe24b4a)] });
  },
});

reg("partner", {
  cat: "social", desc: "Check who you're married to",
  aliases: ["spouse"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    if (!u.marriedTo) return msg.reply(err(`**${t.username}** is not married.`));
    const since = u.marriedAt ? `<t:${Math.floor(new Date(u.marriedAt).getTime()/1000)}:R>` : "Unknown";
    msg.reply({ embeds: [emb("💍 Partner", `**${t.username}** is married to <@${u.marriedTo}>\nSince: ${since}`)] });
  },
});

reg("attack", {
  cat: "social", desc: "Attack a player with your goose 🪿",
  aliases: ["honk"],
  cd: 3600000,
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id) return msg.reply(err("Mention a valid member."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const tv = await getUser(target.id, msg.guild.id);
    if (!u.goose.alive) return msg.reply(err("You don't have a goose! Adopt one with `~adopt`."));
    if (cdLeft(u.lastAttack, 3600000) > 0) return msg.reply(err(`Attack cooldown: **${fmtTime(cdLeft(u.lastAttack, 3600000))}**`));
    if (tv.stunUntil && new Date(tv.stunUntil) > new Date()) return msg.reply(err(`**${target.user.username}** is already stunned!`));
    const outcomes = [
      { chance: 0.4, result: "success",   label: "🪿 HONK HONK! Your goose attacks successfully!" },
      { chance: 0.3, result: "stun",      label: "😵 Your goose bites and the target is stunned!" },
      { chance: 0.2, result: "backfire",  label: "💨 Your goose got scared and ran away!" },
      { chance: 0.1, result: "both_stun", label: "🤪 Both of you got startled by the goose!" },
    ];
    let r = Math.random(), outcome;
    for (const o of outcomes) { r -= o.chance; if (r <= 0) { outcome = o; break; } }
    outcome = outcome || outcomes[0];
    const steal = randInt(30, 120);
    u.lastAttack = new Date();
    if (outcome.result === "success") {
      tv.cash = Math.max(0, tv.cash - steal); u.cash += steal;
    } else if (outcome.result === "stun") {
      tv.stunUntil = new Date(Date.now() + 120000);
      u.cash += Math.floor(steal / 2); tv.cash = Math.max(0, tv.cash - Math.floor(steal / 2));
    } else if (outcome.result === "backfire") {
      u.stunUntil = new Date(Date.now() + 60000);
    } else {
      u.stunUntil = new Date(Date.now() + 30000);
      tv.stunUntil = new Date(Date.now() + 30000);
    }
    await u.save(); await tv.save();
    const extra = outcome.result === "success" ? `\nStole ${CURRENCY} **${fmt(steal)}** from **${target.user.username}**!`
                : outcome.result === "stun"    ? `\nStunned **${target.user.username}** for 2 mins & stole ${CURRENCY} **${fmt(Math.floor(steal/2))}**!` : "";
    msg.reply({ embeds: [emb("🪿 Goose Attack!", `${outcome.label}${extra}`)] });
  },
});

reg("scam", {
  cat: "social", desc: "Try to scam another player",
  cd: 14400000,
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id) return msg.reply(err("Mention a valid member."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const tv = await getUser(target.id, msg.guild.id);
    if (cdLeft(u.lastRob, 14400000) > 0) return msg.reply(err(`Scam cooldown: **${fmtTime(cdLeft(u.lastRob, 14400000))}**`));
    if (tv.cash < 100) return msg.reply(err(`**${target.user.username}** is too broke to scam.`));
    const success = Math.random() < 0.35;
    if (success) {
      const stolen = randInt(100, Math.floor(tv.cash * 0.25));
      u.cash += stolen; tv.cash -= stolen;
      await u.save(); await tv.save();
      const schemes = ["sold them NFTs 🖼️","offered a Nigerian prince deal 👑","sold fake SpinBucks vouchers 🎟️","pretended to be their long lost uncle 👴"];
      msg.reply({ embeds: [emb("🎭 Scam Successful!", `You ${rand(schemes)} and stole ${CURRENCY} **${fmt(stolen)}** from **${target.user.username}**!`, 0x23a559)] });
    } else {
      const fine = randInt(100, 300);
      u.cash = Math.max(0, u.cash - fine);
      await u.save();
      msg.reply({ embeds: [emb("👮 Scam Failed!", `You got caught and fined ${CURRENCY} **${fmt(fine)}**!`, 0xe24b4a)] });
    }
  },
});

// ════════════════════════════════════════════════════════════
//  GOOSE — ADOPT / FEED / GOOSE / RENAME
// ════════════════════════════════════════════════════════════
reg("adopt", {
  cat: "goose", desc: "Adopt a goose 🪿",
  async run(msg, args) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (u.goose.alive) return msg.reply(err(`You already have a goose named **${u.goose.name}**!`));
    const name = args.join(" ").slice(0, 32) || rand(["Gary","Honkers","Goosifer","Beaky","Waddles","Sir Hiss","Feathers McGee","Chaos"]);
    u.goose = { name, hunger: 100, lastFed: new Date(), alive: true };
    await u.save();
    msg.reply({ embeds: [emb("🪿 Goose Adopted!", `You adopted **${name}** the goose!\n\nFeed it daily with \`~feed\` or it'll starve. 😬`, 0x23a559)] });
  },
});

reg("feed", {
  cat: "goose", desc: "Feed your goose",
  cd: 43200000,
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.goose.alive) return msg.reply(err("You don't have a goose. Adopt one with `~adopt`."));
    if (cdLeft(u.goose.lastFed, 43200000) > 0)
      return msg.reply(err(`Your goose isn't hungry yet. Feed again in **${fmtTime(cdLeft(u.goose.lastFed, 43200000))}**.`));
    u.goose.hunger = Math.min(100, u.goose.hunger + 40);
    u.goose.lastFed = new Date();
    await u.save();
    msg.reply({ embeds: [emb("🪿 Fed!", `**${u.goose.name}** munched happily! Hunger: **${u.goose.hunger}%**`)] });
  },
});

reg("goose", {
  cat: "goose", desc: "Check your goose's status",
  aliases: ["mygoose", "pet"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    if (!u.goose.alive) return msg.reply(err(`**${t.username}** has no goose. Use \`~adopt\`!`));
    const hoursSinceFed = u.goose.lastFed ? (Date.now() - new Date(u.goose.lastFed).getTime()) / 3600000 : 0;
    const currentHunger = Math.max(0, Math.round(u.goose.hunger - hoursSinceFed * 4));
    if (currentHunger === 0 && u.goose.alive) {
      u.goose.alive = false; await u.save();
      return msg.reply({ embeds: [emb("💀 Your goose died...", `**${u.goose.name}** starved to death! 😢\nAdopt a new one with \`~adopt\`.`, 0xe24b4a)] });
    }
    const bar = "█".repeat(Math.round(currentHunger/10)) + "░".repeat(10 - Math.round(currentHunger/10));
    msg.reply({ embeds: [emb(`🪿 ${u.goose.name}`)
      .addFields(
        { name: "Status", value: u.goose.alive ? "Alive 🟢" : "Dead 💀", inline: true },
        { name: "Hunger", value: `\`${bar}\` ${currentHunger}%`,          inline: false },
      )] });
  },
});

reg("renamegoose", {
  cat: "goose", desc: "Rename your goose",
  aliases: ["goosename"],
  async run(msg, args) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.goose.alive) return msg.reply(err("You don't have a goose to rename."));
    const name = args.join(" ").slice(0, 32);
    if (!name) return msg.reply(err("Provide a new name."));
    u.goose.name = name; await u.save();
    msg.reply(ok(`Your goose is now named **${name}**! 🪿`));
  },
});

// ════════════════════════════════════════════════════════════
//  WALLET DROP (random event in chat)
// ════════════════════════════════════════════════════════════
const walletCooldowns = new Map();

function maybeDropWallet(msg) {
  if (Math.random() > 0.015) return;
  const guildId = msg.guild.id;
  if (walletCooldowns.has(guildId)) return;
  walletCooldowns.set(guildId, true);
  setTimeout(() => walletCooldowns.delete(guildId), 300000);
  const cash = randInt(50, 500);
  msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xf5c518)
    .setTitle("👛 A wallet dropped!")
    .setDescription(`Someone dropped their wallet!\n\nType \`~grab\` to claim it!\n\n${CURRENCY} **${fmt(cash)}** inside!`)] });
  msg.channel._walletDrop = { cash, expires: Date.now() + 30000 };
}

reg("grab", {
  cat: "fun", desc: "Grab a dropped wallet",
  async run(msg) {
    const drop = msg.channel._walletDrop;
    if (!drop || Date.now() > drop.expires) return msg.reply(err("No wallet to grab here!"));
    delete msg.channel._walletDrop;
    const u = await getUser(msg.author.id, msg.guild.id);
    u.cash += drop.cash; await u.save();
    msg.reply({ embeds: [emb("👛 Wallet Grabbed!", `You snagged the wallet! ${CURRENCY} **+${fmt(drop.cash)}** added to your cash!`, 0x23a559)] });
  },
});

// ════════════════════════════════════════════════════════════
//  FUN / MISC
// ════════════════════════════════════════════════════════════
reg("profile", {
  cat: "fun", desc: "View your full SpinBot profile",
  aliases: ["me", "p"],
  async run(msg, args) {
    const t      = msg.mentions.users.first() || msg.author;
    const u      = await getUser(t.id, msg.guild.id);
    const member = msg.guild.members.cache.get(t.id);
    const e = new EmbedBuilder().setColor(member?.displayHexColor || 0x5865F2)
      .setAuthor({ name: t.tag, iconURL: t.displayAvatarURL() })
      .setThumbnail(t.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: `${CURRENCY} Cash`,    value: fmt(u.cash),                          inline: true },
        { name: "🏦 Bank",             value: fmt(u.bank),                          inline: true },
        { name: "📊 Net Worth",        value: fmt(u.cash + u.bank),                 inline: true },
        { name: "🎮 Games Played",     value: `${u.gamesPlayed}`,                   inline: true },
        { name: "⭐ Level",            value: `${u.level} (${u.xp} XP)`,            inline: true },
        { name: "💑 Partner",          value: u.marriedTo ? `<@${u.marriedTo}>` : "Single", inline: true },
        { name: "🪿 Goose",            value: u.goose.alive ? u.goose.name : "None", inline: true },
        { name: "🔥 Daily Streak",     value: `${u.streak} days`,                   inline: true },
        { name: "🎒 Items",            value: `${(u.inventory||[]).length}`,         inline: true },
      );
    msg.reply({ embeds: [e] });
  },
});

reg("8ball", {
  cat: "fun", desc: "Ask the magic 8-ball",
  async run(msg, args) {
    if (!args.length) return msg.reply(err("Ask a question!"));
    const ans = ["It is certain.", "Without a doubt.", "Yes, definitely.", "Signs point to yes.",
                 "Reply hazy, try again.", "Ask again later.", "Don't count on it.", "My reply is no.", "Very doubtful."];
    msg.reply({ embeds: [emb("🎱 Magic 8-Ball", `**Q:** ${args.join(" ")}\n\n**A:** *${rand(ans)}*`)] });
  },
});

reg("trivia", {
  cat: "fun", desc: "Answer a trivia question for SpinBucks",
  cd: 600000,
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    const questions = [
      { q: "What is 7 × 8?", a: "56" },
      { q: "How many sides does a hexagon have?", a: "6" },
      { q: "What planet is closest to the sun?", a: "mercury" },
      { q: "What is the capital of France?", a: "paris" },
      { q: "How many letters are in the alphabet?", a: "26" },
      { q: "What is the chemical symbol for water?", a: "h2o" },
      { q: "How many seconds are in a minute?", a: "60" },
      { q: "What is the square root of 144?", a: "12" },
      { q: "What gas do plants absorb?", a: "co2" },
      { q: "How many continents are there?", a: "7" },
    ];
    const { q, a } = rand(questions);
    await msg.reply({ embeds: [emb("🧠 Trivia!", `${q}\n\nYou have **15 seconds** to answer!`)] });
    const filter = m => m.author.id === msg.author.id;
    const coll   = await msg.channel.awaitMessages({ filter, max: 1, time: 15000 }).catch(() => null);
    if (!coll?.size) return msg.channel.send(err(`Time's up! The answer was **${a}**.`));
    if (coll.first().content.toLowerCase().trim() === a) {
      const prize = randInt(100, 300);
      u.cash += prize; await u.save();
      msg.channel.send({ embeds: [emb("🧠 Correct!", `The answer was **${a}**!\n\n${CURRENCY} **+${fmt(prize)}** added to your wallet!`, 0x23a559)] });
    } else {
      msg.channel.send({ embeds: [emb("❌ Wrong!", `The correct answer was **${a}**. Better luck next time!`, 0xe24b4a)] });
    }
  },
});

reg("rps", {
  cat: "fun", desc: "Rock Paper Scissors for SpinBucks",
  aliases: ["rockpaperscissors"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseInt(args[0]) || 50;
    const pick = args[1]?.toLowerCase();
    const opts = ["rock","paper","scissors","r","p","s"];
    if (!opts.includes(pick)) return msg.reply(err("Usage: `~rps <bet> <rock|paper|scissors>`"));
    if (bet < 10 || bet > 50000) return msg.reply(err("Bet: 10–50,000."));
    if (u.cash < bet)            return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const norm = pick === "r" ? "rock" : pick === "p" ? "paper" : pick === "s" ? "scissors" : pick;
    const choices = ["rock","paper","scissors"];
    const bot = rand(choices);
    const emojis = { rock: "🪨", paper: "📄", scissors: "✂️" };
    const wins   = { rock: "scissors", paper: "rock", scissors: "paper" };
    let net, result;
    if (norm === bot)              { net = 0;    result = "🤝 Tie! Bet returned."; }
    else if (wins[norm] === bot)   { net = bet;  result = `✅ You win! ${emojis[norm]} beats ${emojis[bot]}`; }
    else                           { net = -bet; result = `❌ You lose! ${emojis[bot]} beats ${emojis[norm]}`; }
    u.cash += net; u.gamesPlayed++;
    if (net > 0) u.totalWon += net; else if (net < 0) u.totalLost += Math.abs(net);
    await u.save();
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : net < 0 ? 0xe24b4a : 0xf0a500)
      .setTitle("✂️ Rock Paper Scissors")
      .setDescription(`You: ${emojis[norm]}  vs  Bot: ${emojis[bot]}\n\n${result}\n\n${net !== 0 ? (net > 0 ? `${CURRENCY} **+${fmt(bet)}**` : `${CURRENCY} **-${fmt(bet)}**`) : ""}\nBalance: **${fmt(u.cash)}**`)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🌾 FARM SYSTEM
//  ~plant <crop> <slot>  ~water  ~harvest <slot>  ~farm
//  ~buyplot  — expand your farm
// ════════════════════════════════════════════════════════════

const CROPS = {
  wheat:      { emoji: "🌾", cost: 80,   time: 1800000,  yield: [150, 250],  xp: 5  },
  carrot:     { emoji: "🥕", cost: 120,  time: 3600000,  yield: [250, 400],  xp: 8  },
  potato:     { emoji: "🥔", cost: 200,  time: 7200000,  yield: [500, 800],  xp: 12 },
  strawberry: { emoji: "🍓", cost: 350,  time: 14400000, yield: [900, 1400], xp: 18 },
  pumpkin:    { emoji: "🎃", cost: 600,  time: 28800000, yield: [1800, 2800],xp: 25 },
  mushroom:   { emoji: "🍄", cost: 1000, time: 43200000, yield: [3000, 5000],xp: 35 },
  golden:     { emoji: "✨", cost: 3000, time: 86400000, yield: [9000,15000],xp: 60 },
};

reg("farm", {
  cat: "farm", desc: "View your farm plots",
  aliases: ["myfarm", "plots"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    const now    = Date.now();
    const watered = u.farm.lastWatered && (now - new Date(u.farm.lastWatered).getTime()) < 3600000;
    const lines  = [];
    for (let i = 1; i <= u.farm.plots; i++) {
      const slot = u.farm.crops[i];
      if (!slot) { lines.push(`**Slot ${i}:** 🟫 Empty — use \`~plant <crop> ${i}\``); continue; }
      const cropInfo  = CROPS[slot.crop];
      const elapsed   = now - new Date(slot.plantedAt).getTime();
      const growTime  = watered ? cropInfo.time * 0.75 : cropInfo.time;
      const remaining = Math.max(0, growTime - elapsed);
      if (remaining === 0) lines.push(`**Slot ${i}:** ${cropInfo.emoji} **${slot.crop}** — ✅ Ready to harvest! (\`~harvest ${i}\`)`);
      else lines.push(`**Slot ${i}:** ${cropInfo.emoji} **${slot.crop}** — ⏳ ${fmtTime(remaining)} left`);
    }
    const waterLine = watered ? "💧 Watered! (crops grow 25% faster)" : "🪣 Not watered — use `~water` to speed up growth!";
    msg.reply({ embeds: [emb(`🌾 ${t.username}'s Farm`, `${waterLine}\n\n${lines.join("\n")}\n\n**Plots:** ${u.farm.plots} | Buy more with \`~buyplot\``)] });
  },
});

reg("plant", {
  cat: "farm", desc: "Plant a crop in a slot",
  async run(msg, args) {
    const cropName = args[0]?.toLowerCase();
    const slotNum  = parseInt(args[1]);
    if (!cropName || !CROPS[cropName]) return msg.reply(err(`Unknown crop. Available: ${Object.keys(CROPS).join(", ")}`));
    if (!slotNum) return msg.reply(err("Usage: `~plant <crop> <slot number>`"));
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    if (slotNum < 1 || slotNum > u.farm.plots) return msg.reply(err(`You only have **${u.farm.plots}** plot(s). Buy more with \`~buyplot\`.`));
    if (u.farm.crops[slotNum]) return msg.reply(err(`Slot **${slotNum}** already has a crop growing! Harvest it first.`));
    const crop = CROPS[cropName];
    if (u.cash < crop.cost) return msg.reply(err(`Seeds cost ${CURRENCY} **${fmt(crop.cost)}**. You have **${fmt(u.cash)}**.`));
    u.cash -= crop.cost;
    u.farm.crops = { ...u.farm.crops, [slotNum]: { crop: cropName, plantedAt: new Date() } };
    await u.save();
    msg.reply({ embeds: [emb("🌱 Planted!", `${crop.emoji} **${cropName}** planted in slot **${slotNum}**!\n\nReady in **${fmtTime(crop.time)}** (or faster if watered 💧)\nExpected yield: ${CURRENCY} **${fmt(crop.yield[0])}–${fmt(crop.yield[1])}**`, 0x23a559)] });
  },
});

reg("water", {
  cat: "farm", desc: "Water your crops — they grow 25% faster for 1 hour",
  cd: 3600000,
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    u.farm.lastWatered = new Date();
    await u.save();
    msg.reply({ embeds: [emb("💧 Watered!", "Your crops will grow **25% faster** for the next hour! 🌱", 0x3498db)] });
  },
});

reg("harvest", {
  cat: "farm", desc: "Harvest a ready crop",
  async run(msg, args) {
    const slotNum = parseInt(args[0]);
    if (!slotNum) return msg.reply(err("Usage: `~harvest <slot number>`"));
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    const slot = u.farm.crops[slotNum];
    if (!slot) return msg.reply(err(`Slot **${slotNum}** is empty.`));
    const crop     = CROPS[slot.crop];
    const watered  = u.farm.lastWatered && (Date.now() - new Date(u.farm.lastWatered).getTime()) < 3600000;
    const growTime = watered ? crop.time * 0.75 : crop.time;
    const elapsed  = Date.now() - new Date(slot.plantedAt).getTime();
    if (elapsed < growTime)
      return msg.reply(err(`**${slot.crop}** isn't ready yet! ${fmtTime(growTime - elapsed)} remaining.`));
    const earned = randInt(crop.yield[0], crop.yield[1]);
    u.cash += earned;
    const crops = { ...u.farm.crops };
    delete crops[slotNum];
    u.farm.crops = crops;
    const leveled = await addXP(u, crop.xp);
    await u.save();
    msg.reply({ embeds: [emb("🌾 Harvested!", `${crop.emoji} You harvested **${slot.crop}** and sold it for ${CURRENCY} **${fmt(earned)}**!${leveled ? `\n\n⬆️ **Level up! You're now level ${u.level}!**` : ""}`, 0x23a559)] });
  },
});

reg("harvestall", {
  cat: "farm", desc: "Harvest all ready crops at once",
  aliases: ["ha"],
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    const watered  = u.farm.lastWatered && (Date.now() - new Date(u.farm.lastWatered).getTime()) < 3600000;
    const crops    = { ...u.farm.crops };
    let total = 0, harvested = 0;
    for (const [slot, data] of Object.entries(crops)) {
      const crop    = CROPS[data.crop];
      const growTime = watered ? crop.time * 0.75 : crop.time;
      if (Date.now() - new Date(data.plantedAt).getTime() >= growTime) {
        total += randInt(crop.yield[0], crop.yield[1]);
        harvested++;
        delete crops[slot];
      }
    }
    if (!harvested) return msg.reply(err("No crops are ready to harvest yet!"));
    u.cash += total;
    u.farm.crops = crops;
    await u.save();
    msg.reply({ embeds: [emb("🌾 Harvest All!", `You harvested **${harvested}** crop(s) for a total of ${CURRENCY} **${fmt(total)}**!`, 0x23a559)] });
  },
});

reg("buyplot", {
  cat: "farm", desc: "Buy an extra farm plot",
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    if (u.farm.plots >= 8) return msg.reply(err("You have the maximum **8** plots!"));
    const plotCost = 1000 * u.farm.plots;
    if (u.cash < plotCost) return msg.reply(err(`Next plot costs ${CURRENCY} **${fmt(plotCost)}**. You have **${fmt(u.cash)}**.`));
    u.cash -= plotCost;
    u.farm.plots += 1;
    await u.save();
    msg.reply({ embeds: [emb("🌾 New Plot!", `You now have **${u.farm.plots}** plots! Next plot costs ${CURRENCY} **${fmt(1000 * u.farm.plots)}**.`, 0x23a559)] });
  },
});

reg("cropinfo", {
  cat: "farm", desc: "View all available crops and their stats",
  aliases: ["crops"],
  async run(msg) {
    const lines = Object.entries(CROPS).map(([name, c]) =>
      `${c.emoji} **${name}** — Seeds: ${CURRENCY} ${fmt(c.cost)} | Grows in: ${fmtTime(c.time)} | Yield: ${CURRENCY} ${fmt(c.yield[0])}–${fmt(c.yield[1])} | XP: +${c.xp}`
    ).join("\n");
    msg.reply({ embeds: [emb("🌾 Available Crops", lines)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🍺 PUB SYSTEM
//  ~pub  ~drink  ~pubwork  ~sober
// ════════════════════════════════════════════════════════════

const DRINKS = [
  { name: "🍺 Pint",       cost: 30,  buzzMult: 1.0, desc: "A humble pint. Mild buzz." },
  { name: "🍷 Wine",       cost: 60,  buzzMult: 1.5, desc: "Fancy. Gets you going faster." },
  { name: "🥃 Whiskey",    cost: 100, buzzMult: 2.5, desc: "Strong stuff. Big buzz." },
  { name: "🍹 Cocktail",   cost: 80,  buzzMult: 2.0, desc: "Sweet but sneaky." },
  { name: "💀 Skull Shot", cost: 200, buzzMult: 5.0, desc: "Absolutely unhinged. Maximum chaos." },
];

reg("pub", {
  cat: "pub", desc: "View the pub menu",
  aliases: ["bar", "menu"],
  async run(msg) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    if (!u.pub) u.pub = { drinkCount: 0, lastDrink: null, lastPubWork: null, drunkUntil: null };
    const drunk  = u.pub.drunkUntil && new Date(u.pub.drunkUntil) > new Date();
    const status = drunk ? `🥴 You're currently drunk! Sober up with \`~sober\` or wait.` : "🧍 Sober as a judge.";
    const menu   = DRINKS.map((d, i) => `**${i+1}.** ${d.name} — ${CURRENCY} **${fmt(d.cost)}**\n> ${d.desc}`).join("\n\n");
    msg.reply({ embeds: [emb("🍺 The Rusty Goose Pub", `${status}\n\n${menu}\n\nOrder with \`~drink <name>\` · Work the bar with \`~pubwork\``, 0x8B4513)] });
  },
});

reg("drink", {
  cat: "pub", desc: "Buy a drink at the pub",
  cd: 300000,
  async run(msg, args) {
    const name = args.join(" ").toLowerCase();
    const drink = DRINKS.find(d => d.name.toLowerCase().includes(name) || name.includes(d.name.split(" ")[1]?.toLowerCase()));
    if (!drink) return msg.reply(err(`Unknown drink! Options: ${DRINKS.map(d => d.name.split(" ")[1]).join(", ")}`));
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.pub) u.pub = { drinkCount: 0, lastDrink: null, lastPubWork: null, drunkUntil: null };
    if (u.cash < drink.cost) return msg.reply(err(`${drink.name} costs ${CURRENCY} **${fmt(drink.cost)}**.`));
    u.cash -= drink.cost;
    u.pub.drinkCount = (u.pub.drinkCount || 0) + 1;
    u.pub.lastDrink  = new Date();

    // Drunk mechanic — more drinks = longer drunk duration
    const drunkMs  = Math.floor(drink.buzzMult * 600000); // base 10 min × buzz multiplier
    const drunkEnd = Math.max(u.pub.drunkUntil ? new Date(u.pub.drunkUntil).getTime() : Date.now(), Date.now()) + drunkMs;
    u.pub.drunkUntil = new Date(drunkEnd);

    // Random drunk event
    const events = [
      () => { const win = randInt(50, 400); u.cash += win; return `You won ${CURRENCY} **${fmt(win)}** at the pub's arm wrestling contest! 💪`; },
      () => { const loss = randInt(30, 200); u.cash = Math.max(0, u.cash - loss); return `You knocked over someone's drink and paid ${CURRENCY} **${fmt(loss)}** for it. 😬`; },
      () => `You told an incredible joke and everyone laughed. Nothing happened to your wallet though. 😂`,
      () => { const win = randInt(200, 600); u.cash += win; return `A stranger bet you ${CURRENCY} **${fmt(win)}** you couldn't down it in one. You won. 🏆`; },
      () => `You passed out briefly and woke up face-down on the bar. Classic. 😴`,
      () => { const loss = randInt(100, 500); u.cash = Math.max(0, u.cash - loss); return `You tried to buy a round for everyone. Cost you ${CURRENCY} **${fmt(loss)}**. Hero or idiot?`; },
    ];
    const event = rand(events)();
    await u.save();
    msg.reply({ embeds: [emb(`${drink.name} — Bottoms Up! 🥴`,
      `**${event}**\n\nDrunk for: **${fmtTime(drunkMs)}** more\nTotal drinks tonight: **${u.pub.drinkCount}**`, 0x8B4513)] });
  },
});

reg("pubwork", {
  cat: "pub", desc: "Work a shift at the pub for SpinBucks",
  cd: 5400000,
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.pub) u.pub = { drinkCount: 0, lastDrink: null, lastPubWork: null, drunkUntil: null };
    const cd = cdLeft(u.pub.lastPubWork, 5400000);
    if (cd > 0) return msg.reply(err(`Pub shift cooldown: **${fmtTime(cd)}** remaining.`));
    const drunk  = u.pub.drunkUntil && new Date(u.pub.drunkUntil) > new Date();
    const base   = randInt(100, 250);
    const pay    = drunk ? Math.floor(base * 0.5) : base; // drunk workers earn half
    const drunkNote = drunk ? "\n\n🥴 *You were drunk on shift and only earned half pay.*" : "";
    u.cash += pay;
    u.pub.lastPubWork = new Date();
    await u.save();
    const shifts = ["pulled pints all night 🍺", "washed mountains of glasses 🫗", "threw out a rowdy customer 🚪",
                    "mixed cocktails for hours 🍹", "karaoke-hosted until 2am 🎤", "mopped up after closing 🧹"];
    msg.reply({ embeds: [emb("🍺 Pub Shift Done!", `You ${rand(shifts)} and earned ${CURRENCY} **${fmt(pay)}**!${drunkNote}`, 0x23a559)] });
  },
});

reg("sober", {
  cat: "pub", desc: "Sober up instantly (costs SpinBucks)",
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.pub) u.pub = { drinkCount: 0, lastDrink: null, lastPubWork: null, drunkUntil: null };
    const drunk = u.pub.drunkUntil && new Date(u.pub.drunkUntil) > new Date();
    if (!drunk) return msg.reply(err("You're not even drunk!"));
    const cost = 150;
    if (u.cash < cost) return msg.reply(err(`Sobering up costs ${CURRENCY} **${fmt(cost)}**. You can't afford it — sleep it off!`));
    u.cash -= cost;
    u.pub.drunkUntil = null;
    u.pub.drinkCount = 0;
    await u.save();
    msg.reply({ embeds: [emb("☕ Sober!", `You chugged some water and coffee and sobered up for ${CURRENCY} **${fmt(cost)}**. Back to normal.`, 0x3498db)] });
  },
});

reg("pubgame", {
  cat: "pub", desc: "Play a quick pub mini-game (darts, pool, or quiz)",
  cd: 1800000,
  async run(msg) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const drunk = u.pub?.drunkUntil && new Date(u.pub.drunkUntil) > new Date();
    const games = ["🎯 Darts", "🎱 Pool", "🧠 Pub Quiz"];
    const game  = rand(games);
    // Drunk players have lower win chance
    const winChance = drunk ? 0.3 : 0.55;
    const won   = Math.random() < winChance;
    const prize = randInt(80, 350);
    const fine  = randInt(40, 150);
    if (won) { u.cash += prize; await u.save(); }
    else     { u.cash = Math.max(0, u.cash - fine); await u.save(); }
    const drunkNote = drunk ? " *(drunk penalty applied)*" : "";
    msg.reply({ embeds: [emb(`${game} at The Rusty Goose`,
      won
        ? `You won at **${game}**!${drunkNote}\n\n${CURRENCY} **+${fmt(prize)}**\nBalance: **${fmt(u.cash)}**`
        : `You lost at **${game}**!${drunkNote}\n\n${CURRENCY} **-${fmt(fine)}**\nBalance: **${fmt(u.cash)}**`,
      won ? 0x23a559 : 0xe24b4a)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🕵️ BLACK MARKET SYSTEM
//  ~blackmarket  ~bmshop  ~bmbuy  ~smuggle  ~launder  ~bust
// ════════════════════════════════════════════════════════════

const BM_ITEMS = {
  "🔫 Dirty Gun":        { price: 800,  desc: "+30% rob success rate (one use).",     heatGain: 15 },
  "🎭 Fake ID":          { price: 500,  desc: "Reset your heat level to 0.",           heatGain: 5  },
  "💣 Smoke Bomb":       { price: 400,  desc: "Escape a bust attempt automatically.",  heatGain: 10 },
  "🧪 Heat Reducer":     { price: 600,  desc: "Reduce heat by 30 points.",            heatGain: 0  },
  "📦 Mystery Crate":    { price: 300,  desc: "Random item or cash — could be anything.", heatGain: 8 },
  "🗝️ Master Key":       { price: 1200, desc: "+50% bank robbery payout (one use).",  heatGain: 20 },
  "💊 Adrenaline Shot":  { price: 700,  desc: "Next casino bet has 1.5× multiplier.", heatGain: 12 },
};

reg("blackmarket", {
  cat: "blackmarket", desc: "Visit the black market",
  aliases: ["bm", "darkmarket"],
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const heat = u.bm.heatLevel || 0;
    const heatBar = "🔴".repeat(Math.floor(heat / 10)) + "⚫".repeat(10 - Math.floor(heat / 10));
    const risk    = heat >= 80 ? "⚠️ **DANGER ZONE** — You're extremely hot right now!" : heat >= 50 ? "⚠️ Getting risky..." : "✅ Relatively safe.";
    msg.reply({ embeds: [emb("🕵️ Black Market",
      `*The shady alley behind the casino...*\n\n${risk}\n**Heat Level:** \`${heatBar}\` ${heat}/100\n\nUse \`~bmshop\` to browse items.\nUse \`~smuggle\` to run a job.\nUse \`~launder\` to clean dirty money.\n\n⚠️ Heat over **80** risks a bust. Use \`~bmbuy Heat Reducer\` to cool down.`, 0x2c2f33)] });
  },
});

reg("bmshop", {
  cat: "blackmarket", desc: "Browse the black market shop",
  async run(msg) {
    const lines = Object.entries(BM_ITEMS).map(([name, d]) =>
      `**${name}** — ${CURRENCY} **${fmt(d.price)}**\n> ${d.desc} *(+${d.heatGain} heat)*`
    ).join("\n\n");
    msg.reply({ embeds: [emb("🕵️ Black Market Shop", `${lines}\n\nBuy with \`~bmbuy <item name>\``, 0x2c2f33)] });
  },
});

reg("bmbuy", {
  cat: "blackmarket", desc: "Buy an item from the black market",
  async run(msg, args) {
    const name = args.join(" ");
    const key  = Object.keys(BM_ITEMS).find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (!key) return msg.reply(err(`Item not found. Use \`~bmshop\` to see what's available.`));
    const u    = await getUser(msg.author.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const item = BM_ITEMS[key];
    if (u.cash < item.price) return msg.reply(err(`You need ${CURRENCY} **${fmt(item.price)}**.`));

    // Heat check before purchase
    const heat = u.bm.heatLevel || 0;
    if (heat >= 80 && Math.random() < 0.3) {
      const fine = randInt(300, 800);
      u.cash = Math.max(0, u.cash - fine);
      u.bm.heatLevel = Math.max(0, heat - 20);
      await u.save();
      return msg.reply({ embeds: [emb("👮 BUSTED!", `Cops were watching the alley! You got caught and fined ${CURRENCY} **${fmt(fine)}**.\nHeat reduced by 20.`, 0xe24b4a)] });
    }

    u.cash -= item.price;
    u.bm.heatLevel = Math.min(100, heat + item.heatGain);

    // Special item effects
    if (key.includes("Fake ID")) { u.bm.heatLevel = 0; }
    else if (key.includes("Heat Reducer")) { u.bm.heatLevel = Math.max(0, (u.bm.heatLevel || 0) - 30); }
    else if (key.includes("Mystery Crate")) {
      const roll = Math.random();
      if (roll < 0.2) {
        const bonus = randInt(500, 2000);
        u.cash += bonus;
        await u.save();
        return msg.reply({ embeds: [emb("📦 Mystery Crate — JACKPOT!", `The crate had ${CURRENCY} **${fmt(bonus)}** inside! 🎉`, 0x23a559)] });
      } else if (roll < 0.5) {
        const randomItem = rand(Object.keys(BM_ITEMS).filter(k => !k.includes("Mystery")));
        u.inventory.push(randomItem);
        await u.save();
        return msg.reply({ embeds: [emb("📦 Mystery Crate", `You got: **${randomItem}**!`, 0xf0a500)] });
      } else {
        await u.save();
        return msg.reply({ embeds: [emb("📦 Mystery Crate — Empty", "Just packing peanuts. Classic black market.", 0xe24b4a)] });
      }
    } else {
      u.inventory.push(key);
    }
    await u.save();
    msg.reply({ embeds: [emb("🕵️ Purchase Complete", `You bought **${key}** for ${CURRENCY} **${fmt(item.price)}**.\n\n**Heat level:** ${u.bm.heatLevel}/100`, 0x2c2f33)] });
  },
});

reg("smuggle", {
  cat: "blackmarket", desc: "Run a smuggling job for big cash (high risk)",
  cd: 10800000,
  async run(msg) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const heat = u.bm.heatLevel || 0;

    // Higher heat = higher bust risk
    const bustChance = 0.2 + (heat / 100) * 0.5;
    const busted     = Math.random() < bustChance;

    if (busted) {
      const fine = randInt(500, 2000);
      u.cash = Math.max(0, u.cash - fine);
      u.bm.heatLevel = Math.min(100, heat + 25);
      await u.save();
      return msg.reply({ embeds: [emb("👮 SMUGGLING BUST!", `The feds were waiting for you!\n\nFine: ${CURRENCY} **${fmt(fine)}**\nHeat: **+25** (now ${u.bm.heatLevel}/100)\n\nLay low for a while!`, 0xe24b4a)] });
    }

    const jobs = [
      "smuggled rare casino chips across the border 🎰",
      "drove a truck of untaxed goods through customs 🚛",
      "moved a crate of mystery electronics 📦",
      "ran an underground auction 🎭",
      "delivered a sealed package — no questions asked 🗃️",
    ];
    const payout = randInt(800, 2500);
    u.cash += payout;
    u.bm.heatLevel = Math.min(100, heat + randInt(10, 20));
    await u.save();
    msg.reply({ embeds: [emb("🕵️ Smuggling Job Done!", `You ${rand(jobs)} and earned ${CURRENCY} **${fmt(payout)}**!\n\n**Heat:** +${u.bm.heatLevel - heat} (now ${u.bm.heatLevel}/100)`, 0x23a559)] });
  },
});

reg("launder", {
  cat: "blackmarket", desc: "Launder cash through the casino to reduce heat",
  cd: 14400000,
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const cd   = cdLeft(u.bm.lastLaunder, 14400000);
    if (cd > 0) return msg.reply(err(`Laundering cooldown: **${fmtTime(cd)}** remaining.`));
    const amt  = parseInt(args[0]);
    if (!amt || amt < 200) return msg.reply(err("Minimum amount to launder is ${CURRENCY} **200**."));
    if (u.cash < amt)      return msg.reply(err(`You only have ${CURRENCY} **${fmt(u.cash)}**.`));

    // Laundering takes a 20% cut but reduces heat
    const fee      = Math.floor(amt * 0.2);
    const returned = amt - fee;
    const heatDrop = Math.min(u.bm.heatLevel, Math.floor(amt / 100));
    u.cash         = u.cash - amt + returned;
    u.bm.heatLevel = Math.max(0, (u.bm.heatLevel || 0) - heatDrop);
    u.bm.lastLaunder = new Date();
    await u.save();
    msg.reply({ embeds: [emb("🧼 Money Laundered", `You funnelled ${CURRENCY} **${fmt(amt)}** through the casino.\n\n**Fee (20%):** ${CURRENCY} -${fmt(fee)}\n**Returned:** ${CURRENCY} ${fmt(returned)}\n**Heat reduced:** -${heatDrop} (now ${u.bm.heatLevel}/100)`, 0x2c2f33)] });
  },
});

reg("heatlevel", {
  cat: "blackmarket", desc: "Check your current heat level",
  aliases: ["heat", "wanted"],
  async run(msg, args) {
    const t    = msg.mentions.users.first() || msg.author;
    const u    = await getUser(t.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const heat = u.bm.heatLevel || 0;
    const bar  = "🔴".repeat(Math.floor(heat / 10)) + "⚫".repeat(10 - Math.floor(heat / 10));
    const status = heat >= 80 ? "🚨 **EXTREMELY HOT** — Cops are closing in!" :
                   heat >= 60 ? "⚠️ **HOT** — Getting very risky." :
                   heat >= 40 ? "🟡 **WARM** — Watch your back." :
                   heat >= 20 ? "🟢 **COOL** — Flying under the radar." :
                                "✅ **ICE COLD** — Totally clean.";
    msg.reply({ embeds: [emb(`🕵️ ${t.username}'s Heat Level`, `\`${bar}\` **${heat}/100**\n\n${status}\n\nReduce heat with \`~launder\` or \`~bmbuy Heat Reducer\``)] });
  },
});

// ════════════════════════════════════════════════════════════
//  EVENTS
// ════════════════════════════════════════════════════════════
client.once("clientReady", async () => {
  console.log(`✅  SpinBot online as ${client.user.tag}`);
  const statuses = [
    { name: `~help | ${client.guilds.cache.size} servers`, type: 2 },
    { name: "not your average economy bot", type: 3 },
    { name: `~slots to lose everything`, type: 2 },
  ];
  let i = 0;
  client.user.setPresence({ activities: [statuses[0]], status: "online" });
  setInterval(() => {
    i = (i + 1) % statuses.length;
    client.user.setPresence({ activities: [statuses[i]], status: "online" });
  }, 20000);
});

// Global error handler so one bad message never crashes the process
client.on("error", (e) => console.error("[Discord error]", e));

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  maybeDropWallet(msg);

  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const name = args.shift().toLowerCase();
  const cmd  = cmds[name];
  if (!cmd) return;

  // Cooldown check using client.cooldowns (now properly initialised)
  if (cmd.cd) {
    const key = `${msg.author.id}:${name}`;
    if (client.cooldowns.has(key)) {
      const left = cdLeft(client.cooldowns.get(key), cmd.cd);
      if (left > 0) return msg.reply(err(`⏳ Cooldown: **${fmtTime(left)}** remaining.`));
    }
    client.cooldowns.set(key, new Date());
    setTimeout(() => client.cooldowns.delete(key), cmd.cd);
  }

  try { await cmd.run(msg, args, client); }
  catch (e) { console.error(e); msg.reply(err("Something went wrong. Try again.")); }
});

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅  MongoDB connected");
  await client.login(process.env.DISCORD_TOKEN);
})();

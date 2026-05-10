// ============================================================
//  VaultBot — SlotBot-inspired economy & casino bot
//  Prefix: ~  |  discord.js v14  |  MongoDB
//  Economy: starts in the MILLIONS, 300-digit cap
//  Admin panel: ~admin <cmd> — locked to ADMIN_USER_ID in .env
// ============================================================
require("dotenv").config();
const {
  Client, GatewayIntentBits, Partials,
  Collection, EmbedBuilder,
} = require("discord.js");
const mongoose = require("mongoose");
const express  = require("express");

// ── Keep-alive (Render / Railway free tier) ───────────────────
const app = express();
app.get("/", (_, res) => res.send("VaultBot is alive 💎"));
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
client.cooldowns = new Collection();

const PREFIX    = process.env.PREFIX   || "~";
const CURRENCY  = "💎";
const CURR_NAME = "Vault Coins";

// ── Admin user ID (set ADMIN_USER_ID in .env) ─────────────────
const ADMIN_ID  = process.env.ADMIN_USER_ID || null;

// ── Economy scale helpers ─────────────────────────────────────
// BigInt-safe display for 300-digit numbers
function fmtBig(n) {
  try {
    const s = BigInt(Math.round(Number(n))).toString();
    // insert commas
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } catch { return Number(n).toLocaleString(); }
}

// Cap at 10^300 (a googol-ish)
const MAX_CASH = BigInt("1" + "0".repeat(300));

function capCash(n) {
  const b = BigInt(Math.round(Math.max(0, Number(n))));
  return b > MAX_CASH ? MAX_CASH : b;
}

// ── Mongoose Schemas ──────────────────────────────────────────
const userSchema = new mongoose.Schema({
  userId        : { type: String, required: true },
  guildId       : { type: String, required: true },
  cash          : { type: String, default: "5000000" },      // stored as string for BigInt compat
  bank          : { type: String, default: "0" },
  xp            : { type: Number, default: 0 },
  level         : { type: Number, default: 1 },
  inventory     : { type: [String], default: [] },
  lastDaily     : { type: Date,   default: null },
  lastGrind     : { type: Date,   default: null },
  lastSnatch    : { type: Date,   default: null },
  lastRush      : { type: Date,   default: null },
  lastDrop      : { type: Date,   default: null },
  lastBusk      : { type: Date,   default: null },
  lastDig       : { type: Date,   default: null },
  lastFish      : { type: Date,   default: null },
  lastHunt      : { type: Date,   default: null },
  lastHeist     : { type: Date,   default: null },
  marriedTo     : { type: String, default: null },
  marriedAt     : { type: Date,   default: null },
  duck: {
    name   : { type: String,  default: null },
    hunger : { type: Number,  default: 100  },
    lastFed: { type: Date,    default: null },
    alive  : { type: Boolean, default: false },
  },
  stunUntil     : { type: Date,   default: null },
  totalWon      : { type: String, default: "0" },
  totalLost     : { type: String, default: "0" },
  gamesPlayed   : { type: Number, default: 0 },
  streak        : { type: Number, default: 0 },
  farm: {
    plots      : { type: Number, default: 2 },
    crops      : { type: mongoose.Schema.Types.Mixed, default: {} },
    lastWatered: { type: Date,   default: null },
  },
  pub: {
    drinkCount : { type: Number, default: 0 },
    lastDrink  : { type: Date,   default: null },
    lastPubGig : { type: Date,   default: null },
    drunkUntil : { type: Date,   default: null },
  },
  bm: {
    lastVisit  : { type: Date,   default: null },
    heatLevel  : { type: Number, default: 0 },
    lastLaunder: { type: Date,   default: null },
  },
});
userSchema.index({ guildId: 1, cash: -1 });
const User = mongoose.model("VaultUser", userSchema);

// ── Helpers ───────────────────────────────────────────────────
const rand    = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// Scaled random — returns numbers in millions range by default
const randMil = (minM, maxM) => randInt(minM * 1_000_000, maxM * 1_000_000);
const fmt     = fmtBig;
const cdLeft  = (date, ms) => Math.max(0, new Date(date).getTime() + ms - Date.now());
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

const ok  = (d) => ({ embeds: [{ color: 0x5865F2, description: `✅  ${d}` }] });
const err = (d) => ({ embeds: [{ color: 0xe24b4a, description: `❌  ${d}` }] });

const emb = (title, desc, color = 0x5865F2) => {
  const e = new EmbedBuilder().setColor(color).setTitle(title);
  if (desc && desc.trim().length > 0) e.setDescription(desc);
  return e;
};

// Cash helpers — read/write as BigInt through string storage
function getCash(u) { try { return BigInt(u.cash || "0"); } catch { return 0n; } }
function getBank(u) { try { return BigInt(u.bank || "0"); } catch { return 0n; } }
function getTotalWon(u) { try { return BigInt(u.totalWon || "0"); } catch { return 0n; } }
function getTotalLost(u) { try { return BigInt(u.totalLost || "0"); } catch { return 0n; } }

function setCash(u, n) { u.cash = capCash(n).toString(); }
function setBank(u, n) { u.bank = capCash(n).toString(); }
function addCash(u, n) { setCash(u, getCash(u) + BigInt(Math.round(Number(n)))); }
function subCash(u, n) {
  const amt = BigInt(Math.round(Math.abs(Number(n))));
  const cur  = getCash(u);
  u.cash = (cur > amt ? cur - amt : 0n).toString();
}
function addWon(u, n)  { u.totalWon  = (getTotalWon(u)  + BigInt(Math.round(Math.abs(Number(n))))).toString(); }
function addLost(u, n) { u.totalLost = (getTotalLost(u) + BigInt(Math.round(Math.abs(Number(n))))).toString(); }

async function getUser(userId, guildId) {
  let u = await User.findOne({ userId, guildId });
  if (!u) u = await User.create({ userId, guildId });
  return u;
}

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
  aliases: ["h", "commands", "cmds"],
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
    const icons = {
      info: "📋", economy: "💰", casino: "🎰", social: "💍",
      duck: "🦆", fun: "😂", shop: "🛒", farm: "🌾",
      pub: "🍺", blackmarket: "🕵️", admin: "🔐"
    };
    const e = emb("💎 VaultBot Commands",
      `Prefix: \`${PREFIX}\` · Use \`~help <cmd>\` for details\n\n**${CURR_NAME}** economy & casino — not your average economy bot.\nEconomy starts in the **millions**. Everything costs millions. Get it.`);
    for (const [cat, cs] of Object.entries(cats)) {
      if (cat === "admin") continue; // hide admin category from public help
      e.addFields({ name: `${icons[cat] || "📦"} ${cat}`, value: cs.map((c) => `\`${c}\``).join(" ") });
    }
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
  cat: "info", desc: "Info about VaultBot",
  async run(msg, _args, client) {
    const total = await User.countDocuments();
    msg.reply({ embeds: [emb("💎 VaultBot", "*Not your average economy bot.*")
      .addFields(
        { name: "Servers",  value: `${client.guilds.cache.size}`,  inline: true },
        { name: "Players",  value: `${total}`,                     inline: true },
        { name: "Prefix",   value: `\`${PREFIX}\``,                inline: true },
        { name: "Currency", value: `${CURRENCY} ${CURR_NAME}`,     inline: true },
        { name: "Start",    value: `${CURRENCY} 5,000,000`,        inline: true },
        { name: "Uptime",   value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
      )] });
  },
});

// ════════════════════════════════════════════════════════════
//  ECONOMY — BAL / BANK / DAILY / GRIND / SNATCH / BUSK / HEIST
// ════════════════════════════════════════════════════════════
reg("balance", {
  cat: "economy", desc: "Check your balance",
  aliases: ["bal", "vault", "funds"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    const net = getCash(u) + getBank(u);
    msg.reply({ embeds: [emb(`${CURRENCY} ${t.username}'s Vault`)
      .addFields(
        { name: "💵 Cash",      value: `${CURRENCY} ${fmt(getCash(u))}`,  inline: true },
        { name: "🏦 Bank",      value: `${CURRENCY} ${fmt(getBank(u))}`,  inline: true },
        { name: "📊 Net Worth", value: `${CURRENCY} ${fmt(net)}`,          inline: true },
        { name: "⭐ Level",     value: `${u.level} (${u.xp} XP)`,          inline: true },
      )] });
  },
});

reg("deposit", {
  cat: "economy", desc: "Deposit cash into your vault bank",
  aliases: ["dep", "bank"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const cur = getCash(u);
    let amt;
    if (args[0]?.toLowerCase() === "all") amt = cur;
    else {
      const parsed = BigInt(Math.round(Math.abs(parseFloat(args[0]) || 0)));
      amt = parsed;
    }
    if (!amt || amt <= 0n) return msg.reply(err("Provide a valid amount or `all`."));
    if (amt > cur)         return msg.reply(err(`You only have ${CURRENCY} **${fmt(cur)}** in cash.`));
    setCash(u, cur - amt);
    setBank(u, getBank(u) + amt);
    await u.save();
    msg.reply(ok(`Deposited ${CURRENCY} **${fmt(amt)}** → Bank: ${CURRENCY} **${fmt(getBank(u))}**`));
  },
});

reg("withdraw", {
  cat: "economy", desc: "Withdraw from your vault bank",
  aliases: ["with", "wd"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bnk  = getBank(u);
    let amt;
    if (args[0]?.toLowerCase() === "all") amt = bnk;
    else amt = BigInt(Math.round(Math.abs(parseFloat(args[0]) || 0)));
    if (!amt || amt <= 0n) return msg.reply(err("Provide a valid amount or `all`."));
    if (amt > bnk)         return msg.reply(err(`You only have ${CURRENCY} **${fmt(bnk)}** in your bank.`));
    setBank(u, bnk - amt);
    addCash(u, amt);
    await u.save();
    msg.reply(ok(`Withdrew ${CURRENCY} **${fmt(amt)}** → Cash: ${CURRENCY} **${fmt(getCash(u))}**`));
  },
});

reg("daily", {
  cat: "economy", desc: "Claim your daily Vault Coins",
  aliases: ["claim"],
  cd: 86400000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastDaily, 86400000);
    if (cd > 0) return msg.reply(err(`Daily resets in **${fmtTime(cd)}**.`));
    const base   = randMil(20, 50);          // 20M–50M base
    const streak = Math.min((u.streak || 0) + 1, 30);
    const bonus  = Math.floor(base * (streak * 0.05));
    const total  = base + bonus;
    addCash(u, total);
    u.lastDaily = new Date();
    u.streak    = streak;
    await u.save();
    msg.reply({ embeds: [emb("📅 Daily Claimed!", `${CURRENCY} **+${fmt(total)}** added to your vault!\n\n🔥 **Streak:** ${streak} day${streak > 1 ? "s" : ""} (+${fmt(bonus)} streak bonus)`, 0x23a559)] });
  },
});

reg("grind", {
  cat: "economy", desc: "Work the casino floor for Vault Coins",
  aliases: ["work", "hustle"],
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastGrind, 3600000);
    if (cd > 0) return msg.reply(err(`Grind cooldown: **${fmtTime(cd)}** remaining.`));
    const jobs = [
      "ran the VIP lounge all night 🥂",
      "counted chips behind the cage 💰",
      "drove the armored van 🚐",
      "fixed the house edge on the roulette wheel 🎡",
      "dealt cards at the high-rollers table 🃏",
      "secured the vault overnight 🔒",
      "laundered the week's earnings 🧼",
      "escorted a whale to his suite 🐋",
      "ran a private poker game 🎴",
      "greased the right pockets downtown 🤝",
    ];
    const pay = randMil(5, 15);   // 5M–15M per grind
    addCash(u, pay);
    u.lastGrind = new Date();
    const leveled = await addXP(u, 10);
    await u.save();
    msg.reply({ embeds: [emb("💼 Grind Complete",
      `You ${rand(jobs)} and earned ${CURRENCY} **${fmt(pay)}**!${leveled ? `\n\n⬆️ **Level up! You're now level ${u.level}!**` : ""}`, 0x23a559)] });
  },
});

reg("busk", {
  cat: "economy", desc: "Busk on the strip for loose millions",
  aliases: ["beg", "bustle"],
  cd: 1800000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastBusk, 1800000);
    if (cd > 0) return msg.reply(err(`Busk cooldown: **${fmtTime(cd)}** remaining.`));
    const success = Math.random() < 0.7;
    u.lastBusk = new Date();
    if (success) {
      const amt = randMil(1, 8);
      addCash(u, amt);
      await u.save();
      const lines = [
        `A drunk whale dropped ${CURRENCY} **${fmt(amt)}** in your hat.`,
        `You played the sax outside the casino and earned ${CURRENCY} **${fmt(amt)}**.`,
        `A celebrity tossed ${CURRENCY} **${fmt(amt)}** without looking.`,
        `You sold a "rare" vase to a tourist for ${CURRENCY} **${fmt(amt)}**.`,
      ];
      msg.reply({ embeds: [emb("🎷 Busking Successful", rand(lines), 0x23a559)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("🙅 Walked Past", "Everyone ignored you. Not even a look. Try again later.", 0xe24b4a)] });
    }
  },
});

reg("heist", {
  cat: "economy", desc: "Run a job for massive payouts (high risk)",
  aliases: ["crime", "job"],
  cd: 7200000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastHeist, 7200000);
    if (cd > 0) return msg.reply(err(`Heist cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastHeist = new Date();
    const success = Math.random() < 0.55;
    if (success) {
      const amt = randMil(15, 60);
      addCash(u, amt);
      const jobs = [
        "cracked an offshore vault 🔓",
        "pulled off a casino chip scam 🎰",
        "forged a bundle of vault notes 💵",
        "hacked the leaderboard backend 💻",
        "ran an underground card tournament 🃏",
      ];
      await u.save();
      msg.reply({ embeds: [emb("🦹 Heist Pays!", `You ${rand(jobs)} and walked away with ${CURRENCY} **${fmt(amt)}**!`, 0x23a559)] });
    } else {
      const fine = randMil(5, 20);
      subCash(u, fine);
      await u.save();
      msg.reply({ embeds: [emb("👮 Caught!", `You got pinched and paid ${CURRENCY} **${fmt(fine)}** in bribes.`, 0xe24b4a)] });
    }
  },
});

reg("snatch", {
  cat: "economy", desc: "Snatch another player's wallet",
  aliases: ["rob", "lift"],
  cd: 7200000,
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id) return msg.reply(err("Mention a valid member to snatch from."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastSnatch, 7200000);
    if (cd > 0) return msg.reply(err(`Snatch cooldown: **${fmtTime(cd)}** remaining.`));
    const tv    = await getUser(target.id, msg.guild.id);
    const tvCash = getCash(tv);
    if (tvCash < 1_000_000n) return msg.reply(err(`**${target.user.username}** is too broke to snatch from.`));
    const success = Math.random() < 0.45;
    u.lastSnatch = new Date();
    if (success) {
      const pct    = randInt(10, 30);
      const stolen = tvCash * BigInt(pct) / 100n;
      addCash(u, stolen);
      subCash(tv, stolen);
      await u.save(); await tv.save();
      msg.reply({ embeds: [emb("🥷 Clean Snatch!", `You lifted ${CURRENCY} **${fmt(stolen)}** (${pct}%) from **${target.user.username}**!`, 0x23a559)] });
    } else {
      const fine = randMil(3, 12);
      subCash(u, fine);
      await u.save();
      msg.reply({ embeds: [emb("🚔 Caught!", `You got caught and paid a ${CURRENCY} **${fmt(fine)}** fine!`, 0xe24b4a)] });
    }
  },
});

reg("send", {
  cat: "economy", desc: "Send Vault Coins to another player",
  aliases: ["pay", "give", "transfer"],
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id || target.user.bot) return msg.reply(err("Mention a valid member."));
    let amt;
    try { amt = BigInt(Math.round(Math.abs(parseFloat(args[1]) || 0))); } catch { amt = 0n; }
    if (!amt || amt <= 0n) return msg.reply(err("Provide a valid amount."));
    const u = await getUser(msg.author.id, msg.guild.id);
    if (getCash(u) < amt) return msg.reply(err(`You only have ${CURRENCY} **${fmt(getCash(u))}**.`));
    const tv = await getUser(target.id, msg.guild.id);
    subCash(u, amt);
    addCash(tv, amt);
    await u.save(); await tv.save();
    msg.reply(ok(`Sent ${CURRENCY} **${fmt(amt)}** to **${target.user.username}**!`));
  },
});

reg("leaderboard", {
  cat: "economy", desc: "Top 10 richest players",
  aliases: ["lb", "top", "rich"],
  async run(msg) {
    const top = await User.find({ guildId: msg.guild.id }).limit(200);
    const sorted = top.sort((a, b) => {
      try { const d = BigInt(b.cash||"0") - BigInt(a.cash||"0"); return d > 0n ? 1 : d < 0n ? -1 : 0; } catch { return 0; }
    }).slice(0, 10);
    if (!sorted.length) return msg.reply(err("No players yet."));
    const medals = ["🥇", "🥈", "🥉"];
    const rows   = await Promise.all(sorted.map(async (u, i) => {
      const member = await msg.guild.members.fetch(u.userId).catch(() => null);
      const name   = member?.user.username || `<@${u.userId}>`;
      return `${medals[i] || `**${i + 1}.**`} ${name} — ${CURRENCY} **${fmt(getCash(u))}**`;
    }));
    msg.reply({ embeds: [emb("🏆 Vault Leaderboard", rows.join("\n"))] });
  },
});

reg("networth", {
  cat: "economy", desc: "Net worth leaderboard (cash + bank)",
  aliases: ["nw"],
  async run(msg) {
    const top    = await User.find({ guildId: msg.guild.id }).limit(200);
    const sorted = top.sort((a, b) => {
      try {
        const bv = BigInt(b.cash||"0") + BigInt(b.bank||"0");
        const av = BigInt(a.cash||"0") + BigInt(a.bank||"0");
        const d  = bv - av; return d > 0n ? 1 : d < 0n ? -1 : 0;
      } catch { return 0; }
    }).slice(0, 10);
    if (!sorted.length) return msg.reply(err("No players yet."));
    const medals = ["🥇", "🥈", "🥉"];
    const rows   = await Promise.all(sorted.map(async (u, i) => {
      const member = await msg.guild.members.fetch(u.userId).catch(() => null);
      const name   = member?.user.username || `<@${u.userId}>`;
      return `${medals[i] || `**${i + 1}.**`} ${name} — ${CURRENCY} **${fmt(getCash(u) + getBank(u))}**`;
    }));
    msg.reply({ embeds: [emb("🏆 Net Worth Leaderboard", rows.join("\n"))] });
  },
});

reg("stats", {
  cat: "economy", desc: "View your gambling stats",
  async run(msg, args) {
    const t   = msg.mentions.users.first() || msg.author;
    const u   = await getUser(t.id, msg.guild.id);
    const won  = getTotalWon(u);
    const lost = getTotalLost(u);
    const net  = won >= lost ? won - lost : -(lost - won);
    const sign = won >= lost ? "+" : "-";
    msg.reply({ embeds: [emb(`📊 ${t.username}'s Stats`)
      .addFields(
        { name: "🎮 Games",    value: `${u.gamesPlayed}`,               inline: true },
        { name: "✅ Won",      value: `${CURRENCY} ${fmt(won)}`,         inline: true },
        { name: "❌ Lost",     value: `${CURRENCY} ${fmt(lost)}`,        inline: true },
        { name: "📈 Net",      value: `${CURRENCY} ${sign}${fmt(won >= lost ? net : -net)}`, inline: true },
        { name: "⭐ Level",    value: `${u.level}`,                      inline: true },
        { name: "✨ XP",       value: `${u.xp} / ${u.level * 100}`,     inline: true },
      )] });
  },
});

reg("inventory", {
  cat: "economy", desc: "View your inventory",
  aliases: ["inv", "bag", "stash"],
  async run(msg, args) {
    const t   = msg.mentions.users.first() || msg.author;
    const u   = await getUser(t.id, msg.guild.id);
    const inv = u.inventory || [];
    if (!inv.length) return msg.reply(err(`**${t.username}** has nothing in their stash.`));
    const counts = {};
    inv.forEach(i => counts[i] = (counts[i] || 0) + 1);
    const lines = Object.entries(counts).map(([item, n]) => `${item} ×${n}`).join("\n");
    msg.reply({ embeds: [emb(`🎒 ${t.username}'s Stash`, lines)] });
  },
});

// ════════════════════════════════════════════════════════════
//  ADVENTURE — DIG / FISH / HUNT (scaled to millions)
// ════════════════════════════════════════════════════════════
reg("dig", {
  cat: "economy", desc: "Dig for buried vault cash",
  aliases: ["shovel", "excavate"],
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastDig, 3600000);
    if (cd > 0) return msg.reply(err(`Dig cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastDig = new Date();
    const roll = Math.random();
    if (roll < 0.05) {
      const amt = randMil(50, 200);
      addCash(u, amt); await u.save();
      msg.reply({ embeds: [emb("⛏️ Jackpot Find!", `You cracked open an old vault buried in the dirt! ${CURRENCY} **+${fmt(amt)}**! 💎`, 0xf5c518)] });
    } else if (roll < 0.4) {
      const amt = randMil(2, 15);
      addCash(u, amt); await u.save();
      msg.reply({ embeds: [emb("⛏️ Digging...", `You found ${CURRENCY} **${fmt(amt)}** buried in a briefcase!`, 0x23a559)] });
    } else if (roll < 0.65) {
      const items = ["🪨 Old Rock", "🦴 Bone", "🪱 Worm", "🥫 Old Can", "🔩 Rusty Bolt"];
      const item = rand(items);
      u.inventory.push(item); await u.save();
      msg.reply({ embeds: [emb("⛏️ Digging...", `You found a **${item}**. Not exactly a fortune...`, 0xf0a500)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("⛏️ Nothing.", "Just dirt. You found literally nothing.", 0xe24b4a)] });
    }
  },
});

reg("fish", {
  cat: "economy", desc: "Go fishing — fish worth millions out here",
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastFish, 3600000);
    if (cd > 0) return msg.reply(err(`Fish cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastFish = new Date();
    const roll = Math.random();
    if (roll < 0.05) {
      const amt = randMil(80, 300);
      addCash(u, amt); await u.save();
      msg.reply({ embeds: [emb("🎣 Legendary Catch!", `You reeled in a **Vault Whale** and sold it for ${CURRENCY} **${fmt(amt)}**! 🐋`, 0xf5c518)] });
    } else if (roll < 0.45) {
      const fish = ["🐟 Diamond Trout", "🐠 Gold Tropical", "🦈 Casino Shark", "🦞 Platinum Lobster"];
      const amt  = randMil(3, 25);
      addCash(u, amt); await u.save();
      msg.reply({ embeds: [emb("🎣 Got One!", `You caught a **${rand(fish)}** and sold it for ${CURRENCY} **${fmt(amt)}**!`, 0x23a559)] });
    } else if (roll < 0.6) {
      const junk = ["👟 Old Boot", "🧦 Wet Sock", "🪣 Rusty Bucket", "📱 Broken Phone"];
      const item = rand(junk);
      u.inventory.push(item); await u.save();
      msg.reply({ embeds: [emb("🎣 Caught Junk", `You fished up a **${item}**. Classic.`, 0xf0a500)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("🎣 No Luck", "The fish weren't biting. Try again later.", 0xe24b4a)] });
    }
  },
});

reg("hunt", {
  cat: "economy", desc: "Go hunting — big game, big money",
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastHunt, 3600000);
    if (cd > 0) return msg.reply(err(`Hunt cooldown: **${fmtTime(cd)}** remaining.`));
    u.lastHunt = new Date();
    const roll = Math.random();
    if (roll < 0.05) {
      const amt = randMil(100, 400);
      addCash(u, amt); await u.save();
      msg.reply({ embeds: [emb("🏹 Trophy Kill!", `You bagged a **Diamond Bear** and its pelt sold for ${CURRENCY} **${fmt(amt)}**! 🐻`, 0xf5c518)] });
    } else if (roll < 0.5) {
      const animals = ["🐇 Golden Rabbit", "🦆 Platinum Duck", "🦌 Vault Deer", "🦊 Casino Fox"];
      const amt     = randMil(5, 30);
      addCash(u, amt); await u.save();
      msg.reply({ embeds: [emb("🏹 Nice Kill!", `You hunted a **${rand(animals)}** and sold it for ${CURRENCY} **${fmt(amt)}**!`, 0x23a559)] });
    } else {
      await u.save();
      msg.reply({ embeds: [emb("🏹 Empty Handed", "Nothing was around. Try again next time.", 0xe24b4a)] });
    }
  },
});

// ════════════════════════════════════════════════════════════
//  SHOP & ITEMS (everything 20M+)
// ════════════════════════════════════════════════════════════
const SHOP_ITEMS = {
  "🍀 Fortune Clover":    { price: 25_000_000,   desc: "Adds +5% win chance on your next casino game." },
  "🛡️ Vault Shield":      { price: 40_000_000,   desc: "Blocks the next snatch attempt against you." },
  "💊 Revival Pill":      { price: 20_000_000,   desc: "Revives your dead duck." },
  "🎩 High Roller Crown": { price: 100_000_000,  desc: "Doubles your next vault spin win." },
  "🧲 Pickpocket Kit":    { price: 35_000_000,   desc: "+20% steal rate on your next snatch." },
  "🔮 Oracle Orb":        { price: 60_000_000,   desc: "Reveals the crash point before you bet." },
  "💣 Vault Buster":      { price: 150_000_000,  desc: "Next heist always succeeds." },
  "🌟 VIP Pass":          { price: 500_000_000,  desc: "2× daily payout for 7 days." },
  "🐉 Dragon Scale":      { price: 1_000_000_000,desc: "Legendary item. Multiplies next jackpot by ×5." },
};

reg("shop", {
  cat: "shop", desc: "View the vault shop",
  aliases: ["store", "market"],
  async run(msg) {
    const lines = Object.entries(SHOP_ITEMS).map(([name, d]) =>
      `**${name}** — ${CURRENCY} **${fmt(d.price)}**\n> ${d.desc}`).join("\n\n");
    msg.reply({ embeds: [emb("🛒 VaultBot Shop", `${lines}\n\nUse \`~buy <item name>\` to purchase.`)] });
  },
});

reg("buy", {
  cat: "shop", desc: "Buy an item from the shop",
  async run(msg, args) {
    const name = args.join(" ");
    const item = Object.keys(SHOP_ITEMS).find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (!item) return msg.reply(err(`Item not found. Use \`~shop\` to see what's available.`));
    const u     = await getUser(msg.author.id, msg.guild.id);
    const price = BigInt(SHOP_ITEMS[item].price);
    if (getCash(u) < price) return msg.reply(err(`You need ${CURRENCY} **${fmt(price)}**. You have **${fmt(getCash(u))}**.`));
    subCash(u, price);
    u.inventory.push(item);
    await u.save();
    msg.reply(ok(`You bought **${item}** for ${CURRENCY} **${fmt(price)}**!`));
  },
});

reg("use", {
  cat: "shop", desc: "Use an item from your stash",
  async run(msg, args) {
    const name = args.join(" ");
    const u    = await getUser(msg.author.id, msg.guild.id);
    const inv  = u.inventory || [];
    const idx  = inv.findIndex(i => i.toLowerCase().includes(name.toLowerCase()));
    if (idx === -1) return msg.reply(err(`You don't have that item. Check \`~stash\`.`));
    const item = inv.splice(idx, 1)[0];
    await u.save();
    if (item.includes("Revival Pill")) {
      if (u.duck.alive) return msg.reply(err("Your duck is already alive!"));
      u.duck.alive = true; u.duck.hunger = 100; u.duck.lastFed = new Date();
      await u.save();
      return msg.reply({ embeds: [emb("💊 Duck Revived!", `Your duck **${u.duck.name || "Unnamed"}** is alive again! 🦆`, 0x23a559)] });
    }
    msg.reply(ok(`Used **${item}**! Effect applied to your next action.`));
  },
});

// ════════════════════════════════════════════════════════════
//  CASINO — all bets scaled to millions
//  VAULT SPIN / FLIP / ROLL / BLACKJACK / ROULETTE / CRASH
//  SCRATCH / LOTTERY / HORSE / HI-LO / TOWER / SNAKE EYES
// ════════════════════════════════════════════════════════════

// helper — parse bet, min 1M, max customisable
function parseBet(arg, minM = 1, maxM = 500) {
  const n = Math.round(Math.abs(parseFloat(arg) || 0));
  return n;
}

reg("spin", {
  cat: "casino", desc: "Spin the vault machine 🎰",
  aliases: ["slots", "slot", "vaultspin"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 5_000_000;
    const min = 1_000_000, max = 5_000_000_000;
    if (bet < min)          return msg.reply(err(`Minimum bet is ${CURRENCY} **${fmt(min)}**.`));
    if (bet > max)          return msg.reply(err(`Maximum bet is ${CURRENCY} **${fmt(max)}**.`));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`You need ${CURRENCY} **${fmt(bet)}** to bet.`));

    const symbols = ["💸", "💎", "🔮", "⭐", "🎰", "🔔", "🍒", "🃏"];
    const weights = [1,    1,    2,    4,    5,    8,    15,   20  ];
    const pick = () => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return symbols[i]; }
      return symbols[0];
    };

    const reels   = [pick(), pick(), pick()];
    const display = `[ ${reels.join("  |  ")} ]`;
    let mult = 0, label = "";

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      const jackpots = { "🎰": 100, "💎": 75, "🔮": 50, "⭐": 25, "💸": 200 };
      mult  = jackpots[reels[0]] || 10;
      label = mult >= 50 ? "💥 MEGA JACKPOT!!" : "🎉 Three of a kind!";
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      mult  = 2;
      label = "🎯 Two of a kind!";
    } else {
      label = "💨 No match.";
    }

    const payout = mult > 0 ? bet * mult : 0;
    const net    = payout - bet;
    if (net > 0) { addCash(u, net); addWon(u, net); }
    else { subCash(u, Math.abs(net)); addLost(u, Math.abs(net)); }
    u.gamesPlayed++;
    await u.save();

    const color  = net > 0 ? 0x23a559 : 0xe24b4a;
    const result = net > 0
      ? `${label}\n\n${CURRENCY} **+${fmt(payout)}** (×${mult})\nBalance: **${fmt(getCash(u))}**`
      : `${label}\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(getCash(u))}**`;

    msg.reply({ embeds: [new EmbedBuilder().setColor(color)
      .setTitle("🎰 Vault Spin")
      .setDescription(`\`\`\`\n${display}\n\`\`\`\n${result}`)] });
  },
});

reg("flip", {
  cat: "casino", desc: "Bet on a coin flip",
  aliases: ["coinflip", "cf"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseBet(args[0]) || 5_000_000;
    const side = (args[1] || rand(["heads", "tails"])).toLowerCase();
    if (!["heads","tails","h","t"].includes(side)) return msg.reply(err("Choose `heads` or `tails`."));
    if (bet < 1_000_000 || bet > 10_000_000_000) return msg.reply(err("Bet: 1M–10B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const pick   = ["heads","heads","heads","heads","tails","tails","tails","edge"];
    const result = rand(pick);
    const norm   = side === "h" ? "heads" : side === "t" ? "tails" : side;
    const edge   = result === "edge";
    let net;
    if (edge)                { net = bet * 5; addCash(u, net); addWon(u, net); }
    else if (norm === result){ net = bet;     addCash(u, net); addWon(u, net); }
    else                     { net = -bet;    subCash(u, bet); addLost(u, bet); }
    u.gamesPlayed++;
    await u.save();
    const emoji = result === "heads" ? "🪙 Heads" : result === "tails" ? "🌑 Tails" : "😱 EDGE";
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🪙 Vault Flip")
      .setDescription(`Result: **${emoji}**\nYou picked: **${norm}**\n\n${net > 0 ? `${CURRENCY} **+${fmt(Math.abs(net))}**` : `${CURRENCY} **-${fmt(Math.abs(net))}**`}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

reg("roll", {
  cat: "casino", desc: "Roll dice — predict high or low",
  aliases: ["dice"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 5_000_000;
    const dir = args[1]?.toLowerCase();
    if (!["high","low","h","l"].includes(dir)) return msg.reply(err("Usage: `~roll <bet> <high|low>`"));
    if (bet < 1_000_000 || bet > 5_000_000_000) return msg.reply(err("Bet: 1M–5B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const diceRoll = randInt(1, 12);
    const won      = (["high","h"].includes(dir) && diceRoll >= 7) || (["low","l"].includes(dir) && diceRoll <= 6);
    if (won) { addCash(u, bet); addWon(u, bet); }
    else     { subCash(u, bet); addLost(u, bet); }
    u.gamesPlayed++;
    await u.save();
    const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","🎲"];
    msg.reply({ embeds: [new EmbedBuilder().setColor(won ? 0x23a559 : 0xe24b4a)
      .setTitle("🎲 Vault Roll")
      .setDescription(`${nums[diceRoll - 1]} **Rolled ${diceRoll}** (predicted ${dir})\n\n${won ? `${CURRENCY} **+${fmt(bet)}**` : `${CURRENCY} **-${fmt(bet)}**`}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

reg("blackjack", {
  cat: "casino", desc: "Play blackjack against the house",
  aliases: ["bj"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 10_000_000;
    if (bet < 1_000_000 || bet > 50_000_000_000) return msg.reply(err("Bet: 1M–50B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));

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
      addCash(u, payout); addWon(u, payout); u.gamesPlayed++; await u.save();
      return msg.reply({ embeds: [emb("🃏 Blackjack — Natural 21! 🎉",
        `Your hand: ${show(player)} **(21)**\nDealer: ${show([dealer[0]])} **?**\n\n${CURRENCY} **+${fmt(payout)}** (3:2)\nBalance: **${fmt(getCash(u))}**`, 0x23a559)] });
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
      if (["hit","h"].includes(m.content.toLowerCase())) {
        player.push(deck.pop());
        const pv = val(player);
        if (pv > 21) {
          subCash(u, bet); addLost(u, bet); u.gamesPlayed++; await u.save(); coll.stop();
          return msg.channel.send({ embeds: [makeEmbed(player, dealer, `💥 Bust! **${pv}**\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(getCash(u))}**`, 0xe24b4a)] });
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
      if (dv > 21 || pv > dv)  { net2 = bet;  addCash(u, bet);  addWon(u, bet);  resultText = `🎉 You win! **(${pv} vs ${dv})**\n${CURRENCY} **+${fmt(bet)}**`; color = 0x23a559; }
      else if (pv === dv)       { net2 = 0;                                         resultText = `🤝 Push! **(${pv} vs ${dv})**\nBet returned.`;                    color = 0xf0a500; }
      else                      { net2 = -bet; subCash(u, bet); addLost(u, bet);  resultText = `😢 Dealer wins. **(${pv} vs ${dv})**\n${CURRENCY} **-${fmt(bet)}**`; color = 0xe24b4a; }
      u.gamesPlayed++;
      await u.save();
      msg.channel.send({ embeds: [makeEmbed(player, dealer, `${resultText}\nBalance: **${fmt(getCash(u))}**`, color)] });
    }
  },
});

reg("roulette", {
  cat: "casino", desc: "Bet on roulette (red/black/green/number)",
  aliases: ["rl"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseBet(args[0]) || 5_000_000;
    const pick = args[1]?.toLowerCase();
    if (!pick) return msg.reply(err("Usage: `~roulette <bet> <red|black|green|0-36>`"));
    if (bet < 1_000_000 || bet > 20_000_000_000) return msg.reply(err("Bet: 1M–20B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const spinNum = randInt(0, 36);
    const reds    = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const colour  = spinNum === 0 ? "green" : reds.includes(spinNum) ? "red" : "black";
    const emoji   = spinNum === 0 ? "💚" : colour === "red" ? "🔴" : "⚫";
    let mult = 0;
    if (pick === colour)                 mult = pick === "green" ? 14 : 2;
    else if (parseInt(pick) === spinNum) mult = 36;
    const net = mult > 0 ? bet * (mult - 1) : -bet;
    if (net > 0) { addCash(u, net); addWon(u, net); }
    else         { subCash(u, Math.abs(net)); addLost(u, Math.abs(net)); }
    u.gamesPlayed++;
    await u.save();
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🎡 Vault Roulette")
      .setDescription(`${emoji} Ball landed on **${spinNum} (${colour})**\nYou bet: **${pick}** (×${mult || 0})\n\n${net >= 0 ? `${CURRENCY} **+${fmt(net)}**` : `${CURRENCY} **-${fmt(Math.abs(net))}**`}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

reg("crash", {
  cat: "casino", desc: "Ride the multiplier — cash out before it crashes!",
  aliases: ["cr"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 10_000_000;
    if (bet < 1_000_000 || bet > 100_000_000_000) return msg.reply(err("Bet: 1M–100B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const crashAt = +(Math.max(1, (100 / (Math.random() * 100 + 1))).toFixed(2));
    let mult      = 1.00;
    const sent    = await msg.channel.send({ embeds: [emb("🚀 CRASH", `Multiplier: **${mult.toFixed(2)}×**\n\nType \`cashout\` to cash out!\nBet: ${CURRENCY} **${fmt(bet)}**`)] });
    const interval = setInterval(() => {
      mult = +(mult + (mult < 2 ? 0.07 : mult < 5 ? 0.15 : 0.3)).toFixed(2);
      if (mult >= crashAt) { clearInterval(interval); finish(null); return; }
      sent.edit({ embeds: [emb("🚀 CRASH", `Multiplier: **${mult.toFixed(2)}×** 🟢\n\nType \`cashout\` before it crashes!\nBet: ${CURRENCY} **${fmt(bet)}**`)] }).catch(() => {});
    }, 1200);
    const filter = m => m.author.id === msg.author.id && m.content.toLowerCase() === "cashout";
    const coll   = msg.channel.createMessageCollector({ filter, time: 30000, max: 1 });
    coll.on("collect", () => { clearInterval(interval); finish(mult); });
    coll.on("end", (_, reason) => { if (reason === "time") { clearInterval(interval); finish(null); } });
    async function finish(cashedAt) {
      const crashed = cashedAt === null;
      const net     = crashed ? -bet : Math.floor(bet * cashedAt) - bet;
      if (net > 0) { addCash(u, net); addWon(u, net); }
      else         { subCash(u, Math.abs(net)); addLost(u, Math.abs(net)); }
      u.gamesPlayed++;
      await u.save();
      const desc = crashed
        ? `💥 Crashed at **${crashAt.toFixed(2)}×**!\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(getCash(u))}**`
        : `✅ Cashed out at **${cashedAt.toFixed(2)}×** (crashed at ${crashAt.toFixed(2)}×)\n\n${CURRENCY} **+${fmt(net)}**\nBalance: **${fmt(getCash(u))}**`;
      sent.edit({ embeds: [new EmbedBuilder().setColor(crashed ? 0xe24b4a : 0x23a559).setTitle("🚀 CRASH Result").setDescription(desc)] });
    }
  },
});

reg("scratch", {
  cat: "casino", desc: "Buy and scratch a vault card",
  aliases: ["scratchcard", "sc"],
  async run(msg) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const cost = 5_000_000;
    if (getCash(u) < BigInt(cost)) return msg.reply(err(`Scratch cards cost ${CURRENCY} **${fmt(cost)}**.`));
    subCash(u, cost);
    const symbols = ["💎","💸","⭐","🔔","💰","❌"];
    const weights  = [1,   2,   5,   8,   10,  25];
    const pick = () => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return symbols[i]; }
      return symbols[5];
    };
    const grid = Array.from({ length: 9 }, pick);
    const payouts = { "💎": 500_000_000, "💸": 150_000_000, "⭐": 50_000_000, "🔔": 20_000_000, "💰": 10_000_000 };
    const counts  = {};
    grid.forEach(s => { if (s !== "❌") counts[s] = (counts[s] || 0) + 1; });
    let win = 0;
    for (const [sym, count] of Object.entries(counts)) {
      if (count >= 3) win = Math.max(win, (payouts[sym] || 0) * (count - 2));
    }
    if (win > 0) { addCash(u, win); addWon(u, win); }
    else addLost(u, cost);
    u.gamesPlayed++;
    await u.save();
    const rows = [0,3,6].map(i => grid.slice(i, i+3).join("  ")).join("\n");
    const desc = `\`\`\`\n${rows}\n\`\`\`\n${win > 0 ? `🎉 You won ${CURRENCY} **${fmt(win)}**!` : `No match. Better luck next time!`}\nBalance: **${fmt(getCash(u))}**`;
    msg.reply({ embeds: [new EmbedBuilder().setColor(win > 0 ? 0x23a559 : 0xe24b4a).setTitle("🎟️ Vault Card").setDescription(desc)] });
  },
});

// Lottery pool per guild stored in-memory
const lotteryPools = new Map();

reg("lottery", {
  cat: "casino", desc: "Buy lottery tickets — jackpot drawn when enough players join",
  aliases: ["lotto"],
  async run(msg, args) {
    const amt = parseInt(args[0]) || 1;
    if (amt < 1 || amt > 10) return msg.reply(err("Buy 1–10 tickets at a time."));
    const ticketPrice = 10_000_000;
    const u     = await getUser(msg.author.id, msg.guild.id);
    const total = ticketPrice * amt;
    if (getCash(u) < BigInt(total)) return msg.reply(err(`You need ${CURRENCY} **${fmt(total)}** for ${amt} ticket(s).`));
    subCash(u, total); await u.save();
    if (!lotteryPools.has(msg.guild.id)) lotteryPools.set(msg.guild.id, { pool: 0, tickets: new Map() });
    const lotto = lotteryPools.get(msg.guild.id);
    lotto.pool += total;
    lotto.tickets.set(msg.author.id, (lotto.tickets.get(msg.author.id) || 0) + amt);
    const totalTickets = [...lotto.tickets.values()].reduce((a, b) => a + b, 0);
    msg.reply({ embeds: [emb("🎟️ Tickets Bought!", `You bought **${amt}** ticket(s)!\n\nPool: ${CURRENCY} **${fmt(lotto.pool)}**\nTotal Tickets: **${totalTickets}**\n\nUse \`~drawlottery\` when ready!`)] });
  },
});

reg("drawlottery", {
  cat: "casino", desc: "Draw the lottery winner",
  aliases: ["drawlotto", "drawlot"],
  async run(msg) {
    const lotto = lotteryPools.get(msg.guild.id);
    if (!lotto || lotto.tickets.size < 2) return msg.reply(err("Need at least 2 players in the lottery."));
    const pool = [];
    for (const [uid, count] of lotto.tickets.entries()) {
      for (let i = 0; i < count; i++) pool.push(uid);
    }
    const winnerId = rand(pool);
    const prize    = Math.floor(lotto.pool * 0.9);
    lotteryPools.delete(msg.guild.id);
    const winner = await getUser(winnerId, msg.guild.id);
    addCash(winner, prize); addWon(winner, prize);
    await winner.save();
    msg.channel.send({ embeds: [emb("🎟️ Lottery Draw!", `🎉 <@${winnerId}> wins the vault lottery!\n\nPrize: ${CURRENCY} **${fmt(prize)}** (10% house cut)`, 0xf5c518)] });
  },
});

reg("hilo", {
  cat: "casino", desc: "Guess if the next card is higher or lower",
  aliases: ["highlow"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 5_000_000;
    if (bet < 1_000_000 || bet > 50_000_000_000) return msg.reply(err("Bet: 1M–50B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const rankVals = { A:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, J:11, Q:12, K:13 };
    const ranks    = Object.keys(rankVals);
    const suits    = ["♠","♥","♦","♣"];
    const randCard = () => ({ r: rand(ranks), s: rand(suits) });
    const first    = randCard();
    await msg.reply({ embeds: [emb("🃏 Hi-Lo", `Current card: **${first.r}${first.s}**\n\nType \`higher\` or \`lower\` within 15 seconds!`)] });
    const filter = m => m.author.id === msg.author.id && ["higher","lower","h","l"].includes(m.content.toLowerCase());
    const coll   = await msg.channel.awaitMessages({ filter, max: 1, time: 15000 }).catch(() => null);
    if (!coll?.size) return msg.channel.send(err("Hi-Lo timed out."));
    const guess  = coll.first().content.toLowerCase();
    const second = randCard();
    const fv     = rankVals[first.r], sv = rankVals[second.r];
    const won    = (["higher","h"].includes(guess) && sv > fv) || (["lower","l"].includes(guess) && sv < fv);
    const tie    = sv === fv;
    if (!tie && won)  { addCash(u, bet); addWon(u, bet); }
    else if (!tie)    { subCash(u, bet); addLost(u, bet); }
    u.gamesPlayed++;
    await u.save();
    const result = tie ? `🤝 Tie! **${second.r}${second.s}** — bet returned.`
      : won ? `✅ Correct! **${second.r}${second.s}**\n\n${CURRENCY} **+${fmt(bet)}**`
      : `❌ Wrong! **${second.r}${second.s}**\n\n${CURRENCY} **-${fmt(bet)}**`;
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(!tie && won ? 0x23a559 : 0xe24b4a)
      .setTitle("🃏 Hi-Lo Result").setDescription(`${result}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

reg("horse", {
  cat: "casino", desc: "Bet on a horse race",
  aliases: ["race", "horses"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseBet(args[0]) || 5_000_000;
    const pick = parseInt(args[1]);
    if (!pick || pick < 1 || pick > 4) return msg.reply(err("Usage: `~horse <bet> <1-4>` — pick horse 1, 2, 3, or 4."));
    if (bet < 1_000_000 || bet > 50_000_000_000) return msg.reply(err("Bet: 1M–50B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const names   = ["⚡ Thunder", "🌪️ Cyclone", "🔥 Inferno", "💧 Tsunami"];
    const odds    = [2, 3, 4, 5];
    const weights2= [40, 28, 20, 12];
    let r = Math.random() * 100, wonHorse = 1;
    for (let i = 0; i < weights2.length; i++) { r -= weights2[i]; if (r <= 0) { wonHorse = i + 1; break; } }
    const won = pick === wonHorse;
    const net = won ? bet * (odds[pick - 1] - 1) : -bet;
    if (net > 0) { addCash(u, net); addWon(u, net); }
    else         { subCash(u, Math.abs(net)); addLost(u, Math.abs(net)); }
    u.gamesPlayed++;
    await u.save();
    const raceLines = names.map((n, i) => `${n} ${i + 1 === wonHorse ? "🏆" : "  "}  (${odds[i]}:1)`).join("\n");
    const result    = won
      ? `🏆 **${names[pick-1]}** won! You picked correctly!\n\n${CURRENCY} **+${fmt(net)}**`
      : `**${names[wonHorse-1]}** won. You picked ${names[pick-1]}.\n\n${CURRENCY} **-${fmt(bet)}**`;
    msg.reply({ embeds: [new EmbedBuilder().setColor(won ? 0x23a559 : 0xe24b4a)
      .setTitle("🐎 Vault Race")
      .setDescription(`${raceLines}\n\n${result}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

reg("tower", {
  cat: "casino", desc: "Climb the tower — cash out before you fall!",
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 10_000_000;
    if (bet < 1_000_000 || bet > 50_000_000_000) return msg.reply(err("Bet: 1M–50B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    let floor = 0;
    const maxFloor = 10;
    const fallChance  = (f) => 0.1 + f * 0.08;
    const multiplier  = (f) => +(1 + f * 0.4).toFixed(2);
    const sendFloor   = (extra = "") =>
      `🏰 **Tower — Floor ${floor}/${maxFloor}**\nMultiplier: **${multiplier(floor)}×**\n\nType \`climb\` to go higher or \`cashout\` to cash out!\nFall chance next: **${Math.round(fallChance(floor + 1) * 100)}%**${extra}`;
    const sent = await msg.channel.send({ embeds: [emb("🏰 Vault Tower", sendFloor())] });
    const filter = m => m.author.id === msg.author.id && ["climb","cashout","c"].includes(m.content.toLowerCase());
    const coll   = msg.channel.createMessageCollector({ filter, time: 45000, max: 15 });
    coll.on("collect", async (m) => {
      const action = m.content.toLowerCase();
      if (action === "cashout") {
        coll.stop("cashout");
        const payout = Math.floor(bet * multiplier(floor));
        const net    = payout - bet;
        if (net >= 0) { addCash(u, payout); addWon(u, net); }
        else          { subCash(u, Math.abs(net)); addLost(u, Math.abs(net)); }
        u.gamesPlayed++; await u.save();
        sent.edit({ embeds: [emb("🏰 Tower — Cashed Out!", `Floor **${floor}** (×${multiplier(floor)})\n\n${CURRENCY} **+${fmt(payout)}**\nBalance: **${fmt(getCash(u))}**`, 0x23a559)] });
      } else {
        if (floor >= maxFloor) { coll.stop("top"); return; }
        floor++;
        if (Math.random() < fallChance(floor)) {
          coll.stop("fell");
          subCash(u, bet); addLost(u, bet); u.gamesPlayed++; await u.save();
          sent.edit({ embeds: [emb("💥 You Fell!", `Fell on floor **${floor}**!\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(getCash(u))}**`, 0xe24b4a)] });
        } else {
          sent.edit({ embeds: [emb("🏰 Vault Tower", sendFloor())] });
        }
      }
    });
    coll.on("end", async (_, reason) => {
      if (reason === "top") {
        const payout = Math.floor(bet * multiplier(maxFloor));
        const net    = payout - bet;
        addCash(u, payout); addWon(u, net); u.gamesPlayed++; await u.save();
        sent.edit({ embeds: [emb("🏰 Tower CONQUERED!", `Reached the TOP (×${multiplier(maxFloor)})!\n\n${CURRENCY} **+${fmt(payout)}**\nBalance: **${fmt(getCash(u))}**`, 0xf5c518)] });
      } else if (reason === "time") {
        msg.channel.send(err("Tower timed out — you fell!"));
      }
    });
  },
});

reg("snakeeyes", {
  cat: "casino", desc: "Roll two dice — snake eyes pays 10×!",
  aliases: ["se"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseBet(args[0]) || 5_000_000;
    if (bet < 1_000_000 || bet > 20_000_000_000) return msg.reply(err("Bet: 1M–20B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const d1 = randInt(1, 6), d2 = randInt(1, 6);
    const sum = d1 + d2;
    const faces = ["","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
    let net, desc;
    if (d1 === 1 && d2 === 1) { net = bet * 10;              desc = `🎲 **SNAKE EYES!** ${faces[d1]} ${faces[d2]}\n\n${CURRENCY} **+${fmt(net)}** (×10)`; addCash(u, net); addWon(u, net); }
    else if (d1 === d2)        { net = bet;                   desc = `🎲 **Doubles!** ${faces[d1]} ${faces[d2]}\n\n${CURRENCY} **+${fmt(net)}** (×2)`;       addCash(u, net); addWon(u, net); }
    else if (sum >= 10)        { net = Math.floor(bet * 0.5); desc = `🎲 **High roll!** ${faces[d1]} ${faces[d2]} = ${sum}\n\n${CURRENCY} **+${fmt(net)}** (×1.5)`; addCash(u, net); addWon(u, net); }
    else                       { net = -bet;                  desc = `🎲 ${faces[d1]} ${faces[d2]} = ${sum}\n\n${CURRENCY} **-${fmt(bet)}**`;                  subCash(u, bet); addLost(u, bet); }
    u.gamesPlayed++;
    await u.save();
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : 0xe24b4a)
      .setTitle("🎲 Snake Eyes").setDescription(`${desc}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

// ════════════════════════════════════════════════════════════
//  SOCIAL — BOND / SPLIT / RUSH / SCAM
// ════════════════════════════════════════════════════════════
reg("bond", {
  cat: "social", desc: "Bond with another player (VaultBot marriage)",
  aliases: ["marry", "propose"],
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id || target.user.bot) return msg.reply(err("Mention a valid member."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const tv = await getUser(target.id, msg.guild.id);
    if (u.marriedTo)  return msg.reply(err(`You're already bonded to <@${u.marriedTo}>! Use \`~split\` first.`));
    if (tv.marriedTo) return msg.reply(err(`**${target.user.username}** is already bonded!`));
    await msg.channel.send({ embeds: [emb("💍 Bond Proposal!", `**${msg.author.username}** is proposing to **${target.user.username}**!\n\n${target.user.username}, type \`accept\` or \`decline\` within 30s.`)] });
    const filter = m => m.author.id === target.id && ["accept","decline"].includes(m.content.toLowerCase());
    const collected = await msg.channel.awaitMessages({ filter, max: 1, time: 30000 }).catch(() => null);
    if (!collected?.size || collected.first().content.toLowerCase() === "decline")
      return msg.channel.send(err(`**${target.user.username}** declined. 💔`));
    u.marriedTo = target.id; u.marriedAt = new Date();
    tv.marriedTo = msg.author.id; tv.marriedAt = new Date();
    await u.save(); await tv.save();
    msg.channel.send({ embeds: [emb("💍 Bonded!", `🎉 **${msg.author.username}** & **${target.user.username}** are now bonded!\nMay your Vault Coins multiply. 💑`, 0xf5c518)] });
  },
});

reg("split", {
  cat: "social", desc: "Split from your bonded partner",
  aliases: ["divorce", "separate"],
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.marriedTo) return msg.reply(err("You're not bonded to anyone."));
    const partner = await User.findOne({ userId: u.marriedTo, guildId: msg.guild.id });
    if (partner) { partner.marriedTo = null; await partner.save(); }
    const fine = randMil(5, 25);
    subCash(u, fine); u.marriedTo = null; u.marriedAt = null;
    await u.save();
    msg.reply({ embeds: [emb("💔 Split", `You paid ${CURRENCY} **${fmt(fine)}** in separation fees.\nYou are now single.`, 0xe24b4a)] });
  },
});

reg("partner", {
  cat: "social", desc: "Check who you're bonded to",
  aliases: ["spouse", "bonded"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    if (!u.marriedTo) return msg.reply(err(`**${t.username}** is not bonded to anyone.`));
    const since = u.marriedAt ? `<t:${Math.floor(new Date(u.marriedAt).getTime()/1000)}:R>` : "Unknown";
    msg.reply({ embeds: [emb("💍 Bond", `**${t.username}** is bonded with <@${u.marriedTo}>\nSince: ${since}`)] });
  },
});

reg("rush", {
  cat: "social", desc: "Rush a player with your duck 🦆",
  aliases: ["attack", "honk"],
  cd: 3600000,
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id) return msg.reply(err("Mention a valid member."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const tv = await getUser(target.id, msg.guild.id);
    if (!u.duck.alive) return msg.reply(err("You don't have a duck! Adopt one with `~adopt`."));
    if (cdLeft(u.lastRush, 3600000) > 0) return msg.reply(err(`Rush cooldown: **${fmtTime(cdLeft(u.lastRush, 3600000))}**`));
    if (tv.stunUntil && new Date(tv.stunUntil) > new Date()) return msg.reply(err(`**${target.user.username}** is already stunned!`));
    const outcomes = [
      { chance: 0.4, result: "success",   label: "🦆 QUACK QUACK! Your duck rushes them successfully!" },
      { chance: 0.3, result: "stun",      label: "😵 Your duck bites! The target is stunned!" },
      { chance: 0.2, result: "backfire",  label: "💨 Your duck got spooked and ran!" },
      { chance: 0.1, result: "both_stun", label: "🤪 Both of you got startled by the duck!" },
    ];
    let r = Math.random(), outcome;
    for (const o of outcomes) { r -= o.chance; if (r <= 0) { outcome = o; break; } }
    outcome = outcome || outcomes[0];
    const steal = randMil(1, 5);
    u.lastRush = new Date();
    const tvCash = getCash(tv);
    const actualSteal = tvCash < BigInt(steal) ? tvCash : BigInt(steal);
    if (outcome.result === "success") {
      subCash(tv, actualSteal); addCash(u, actualSteal);
    } else if (outcome.result === "stun") {
      const half = actualSteal / 2n;
      tv.stunUntil = new Date(Date.now() + 120000);
      subCash(tv, half); addCash(u, half);
    } else if (outcome.result === "backfire") {
      u.stunUntil = new Date(Date.now() + 60000);
    } else {
      u.stunUntil = new Date(Date.now() + 30000);
      tv.stunUntil = new Date(Date.now() + 30000);
    }
    await u.save(); await tv.save();
    const extra = outcome.result === "success" ? `\nLifted ${CURRENCY} **${fmt(actualSteal)}** from **${target.user.username}**!`
                : outcome.result === "stun"    ? `\nStunned **${target.user.username}** 2 mins & lifted ${CURRENCY} **${fmt(actualSteal / 2n)}**!` : "";
    msg.reply({ embeds: [emb("🦆 Duck Rush!", `${outcome.label}${extra}`)] });
  },
});

reg("scam", {
  cat: "social", desc: "Try to run a scam on another player",
  aliases: ["con", "finesse"],
  cd: 14400000,
  async run(msg, args) {
    const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
    if (!target || target.id === msg.author.id) return msg.reply(err("Mention a valid member."));
    const u  = await getUser(msg.author.id, msg.guild.id);
    const tv = await getUser(target.id, msg.guild.id);
    const cd = cdLeft(u.lastSnatch, 14400000);
    if (cd > 0) return msg.reply(err(`Scam cooldown: **${fmtTime(cd)}**`));
    if (getCash(tv) < 1_000_000n) return msg.reply(err(`**${target.user.username}** is too broke to scam.`));
    const success = Math.random() < 0.35;
    if (success) {
      const pct    = randInt(10, 25);
      const stolen = getCash(tv) * BigInt(pct) / 100n;
      addCash(u, stolen); subCash(tv, stolen);
      await u.save(); await tv.save();
      const schemes = ["sold them fake vault keys 🔑","ran a Nigerian prince scheme 👑","sold bootleg Vault Coin vouchers 🎟️","faked a charity run 🏃"];
      msg.reply({ embeds: [emb("🎭 Scam Works!", `You ${rand(schemes)} — lifted ${CURRENCY} **${fmt(stolen)}** from **${target.user.username}**!`, 0x23a559)] });
    } else {
      const fine = randMil(3, 15);
      subCash(u, fine); await u.save();
      msg.reply({ embeds: [emb("👮 Scam Busted!", `You got caught and paid ${CURRENCY} **${fmt(fine)}** in fines!`, 0xe24b4a)] });
    }
  },
});

// ════════════════════════════════════════════════════════════
//  DUCK — ADOPT / FEED / DUCK / RENAME (rebranded from Goose)
// ════════════════════════════════════════════════════════════
reg("adopt", {
  cat: "duck", desc: "Adopt a duck 🦆",
  async run(msg, args) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (u.duck.alive) return msg.reply(err(`You already have a duck named **${u.duck.name}**!`));
    const name = args.join(" ").slice(0, 32) || rand(["Quackers","Waddle","Ducky","Sir Quack","Feathers","Coin","Vault Duck","Chonk"]);
    u.duck = { name, hunger: 100, lastFed: new Date(), alive: true };
    await u.save();
    msg.reply({ embeds: [emb("🦆 Duck Adopted!", `You adopted **${name}** the duck!\n\nFeed it daily with \`~feed\` or it'll starve. 😬`, 0x23a559)] });
  },
});

reg("feed", {
  cat: "duck", desc: "Feed your duck",
  cd: 43200000,
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.duck.alive) return msg.reply(err("You don't have a duck. Adopt one with `~adopt`."));
    if (cdLeft(u.duck.lastFed, 43200000) > 0)
      return msg.reply(err(`Your duck isn't hungry yet. Feed again in **${fmtTime(cdLeft(u.duck.lastFed, 43200000))}**.`));
    u.duck.hunger = Math.min(100, u.duck.hunger + 40);
    u.duck.lastFed = new Date();
    await u.save();
    msg.reply({ embeds: [emb("🦆 Fed!", `**${u.duck.name}** munched happily! Hunger: **${u.duck.hunger}%**`)] });
  },
});

reg("duck", {
  cat: "duck", desc: "Check your duck's status",
  aliases: ["myduck", "pet"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    if (!u.duck.alive) return msg.reply(err(`**${t.username}** has no duck. Use \`~adopt\`!`));
    const hoursSinceFed = u.duck.lastFed ? (Date.now() - new Date(u.duck.lastFed).getTime()) / 3600000 : 0;
    const currentHunger = Math.max(0, Math.round(u.duck.hunger - hoursSinceFed * 4));
    if (currentHunger === 0 && u.duck.alive) {
      u.duck.alive = false; await u.save();
      return msg.reply({ embeds: [emb("💀 Your duck died...", `**${u.duck.name}** starved! 😢\nAdopt a new one with \`~adopt\`.`, 0xe24b4a)] });
    }
    const bar = "█".repeat(Math.round(currentHunger/10)) + "░".repeat(10 - Math.round(currentHunger/10));
    msg.reply({ embeds: [emb(`🦆 ${u.duck.name}`)
      .addFields(
        { name: "Status", value: u.duck.alive ? "Alive 🟢" : "Dead 💀", inline: true },
        { name: "Hunger", value: `\`${bar}\` ${currentHunger}%`,         inline: false },
      )] });
  },
});

reg("renameduck", {
  cat: "duck", desc: "Rename your duck",
  aliases: ["duckname"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    if (!u.duck.alive) return msg.reply(err("You don't have a duck to rename."));
    const name = args.join(" ").slice(0, 32);
    if (!name) return msg.reply(err("Provide a new name."));
    u.duck.name = name; await u.save();
    msg.reply(ok(`Your duck is now named **${name}**! 🦆`));
  },
});

// ════════════════════════════════════════════════════════════
//  VAULT DROP (random event in chat — scaled to millions)
// ════════════════════════════════════════════════════════════
const dropCooldowns = new Map();

function maybeDropVault(msg) {
  if (Math.random() > 0.015) return;
  const guildId = msg.guild.id;
  if (dropCooldowns.has(guildId)) return;
  dropCooldowns.set(guildId, true);
  setTimeout(() => dropCooldowns.delete(guildId), 300000);
  const cash = randMil(5, 50);
  msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xf5c518)
    .setTitle("💼 A vault bag dropped!")
    .setDescription(`Someone dropped a bag of cash!\n\nType \`~snag\` to claim it!\n\n${CURRENCY} **${fmt(cash)}** inside!`)] });
  msg.channel._vaultDrop = { cash, expires: Date.now() + 30000 };
}

reg("snag", {
  cat: "fun", desc: "Snag a dropped vault bag",
  aliases: ["grab", "claim"],
  async run(msg) {
    const drop = msg.channel._vaultDrop;
    if (!drop || Date.now() > drop.expires) return msg.reply(err("No vault bag to snag here!"));
    delete msg.channel._vaultDrop;
    const u = await getUser(msg.author.id, msg.guild.id);
    addCash(u, drop.cash); await u.save();
    msg.reply({ embeds: [emb("💼 Bag Snagged!", `You grabbed the vault bag! ${CURRENCY} **+${fmt(drop.cash)}** added to your wallet!`, 0x23a559)] });
  },
});

// ════════════════════════════════════════════════════════════
//  FUN / MISC
// ════════════════════════════════════════════════════════════
reg("profile", {
  cat: "fun", desc: "View your full VaultBot profile",
  aliases: ["me", "p", "card"],
  async run(msg, args) {
    const t      = msg.mentions.users.first() || msg.author;
    const u      = await getUser(t.id, msg.guild.id);
    const member = msg.guild.members.cache.get(t.id);
    const e = new EmbedBuilder().setColor(member?.displayHexColor || 0x5865F2)
      .setAuthor({ name: t.tag, iconURL: t.displayAvatarURL() })
      .setThumbnail(t.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: `${CURRENCY} Cash`,    value: fmt(getCash(u)),                        inline: true },
        { name: "🏦 Bank",             value: fmt(getBank(u)),                        inline: true },
        { name: "📊 Net Worth",        value: fmt(getCash(u) + getBank(u)),           inline: true },
        { name: "🎮 Games",            value: `${u.gamesPlayed}`,                    inline: true },
        { name: "⭐ Level",            value: `${u.level} (${u.xp} XP)`,             inline: true },
        { name: "💑 Bonded",           value: u.marriedTo ? `<@${u.marriedTo}>` : "Single", inline: true },
        { name: "🦆 Duck",             value: u.duck.alive ? u.duck.name : "None",   inline: true },
        { name: "🔥 Streak",           value: `${u.streak} days`,                    inline: true },
        { name: "🎒 Items",            value: `${(u.inventory||[]).length}`,          inline: true },
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
    msg.reply({ embeds: [emb("🎱 Vault 8-Ball", `**Q:** ${args.join(" ")}\n\n**A:** *${rand(ans)}*`)] });
  },
});

reg("trivia", {
  cat: "fun", desc: "Answer a trivia question for Vault Coins",
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
      const prize = randMil(2, 8);
      addCash(u, prize); await u.save();
      msg.channel.send({ embeds: [emb("🧠 Correct!", `The answer was **${a}**!\n\n${CURRENCY} **+${fmt(prize)}** added to your vault!`, 0x23a559)] });
    } else {
      msg.channel.send({ embeds: [emb("❌ Wrong!", `The correct answer was **${a}**. Better luck next time!`, 0xe24b4a)] });
    }
  },
});

reg("rps", {
  cat: "fun", desc: "Rock Paper Scissors for Vault Coins",
  aliases: ["rockpaperscissors"],
  async run(msg, args) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    const bet  = parseBet(args[0]) || 5_000_000;
    const pick = args[1]?.toLowerCase();
    const opts = ["rock","paper","scissors","r","p","s"];
    if (!opts.includes(pick)) return msg.reply(err("Usage: `~rps <bet> <rock|paper|scissors>`"));
    if (bet < 1_000_000 || bet > 50_000_000_000) return msg.reply(err("Bet: 1M–50B."));
    if (getCash(u) < BigInt(bet)) return msg.reply(err(`Need ${CURRENCY} **${fmt(bet)}**.`));
    const norm    = pick === "r" ? "rock" : pick === "p" ? "paper" : pick === "s" ? "scissors" : pick;
    const choices = ["rock","paper","scissors"];
    const botPick = rand(choices);
    const emojis  = { rock: "🪨", paper: "📄", scissors: "✂️" };
    const wins    = { rock: "scissors", paper: "rock", scissors: "paper" };
    let net, result;
    if (norm === botPick)              { net = 0;    result = "🤝 Tie! Bet returned."; }
    else if (wins[norm] === botPick)   { net = bet;  addCash(u, bet);  addWon(u, bet);  result = `✅ You win! ${emojis[norm]} beats ${emojis[botPick]}`; }
    else                               { net = -bet; subCash(u, bet); addLost(u, bet); result = `❌ You lose! ${emojis[botPick]} beats ${emojis[norm]}`; }
    u.gamesPlayed++;
    await u.save();
    msg.reply({ embeds: [new EmbedBuilder().setColor(net > 0 ? 0x23a559 : net < 0 ? 0xe24b4a : 0xf0a500)
      .setTitle("✂️ Rock Paper Scissors")
      .setDescription(`You: ${emojis[norm]}  vs  Bot: ${emojis[botPick]}\n\n${result}\n\n${net !== 0 ? (net > 0 ? `${CURRENCY} **+${fmt(Math.abs(net))}**` : `${CURRENCY} **-${fmt(Math.abs(net))}**`) : ""}\nBalance: **${fmt(getCash(u))}**`)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🌾 FARM SYSTEM (yields scaled to millions)
// ════════════════════════════════════════════════════════════
const CROPS = {
  wheat:      { emoji: "🌾", cost: 5_000_000,   time: 1800000,   yield: [8_000_000,   20_000_000],  xp: 5  },
  carrot:     { emoji: "🥕", cost: 10_000_000,  time: 3600000,   yield: [18_000_000,  40_000_000],  xp: 8  },
  potato:     { emoji: "🥔", cost: 20_000_000,  time: 7200000,   yield: [40_000_000,  80_000_000],  xp: 12 },
  strawberry: { emoji: "🍓", cost: 40_000_000,  time: 14400000,  yield: [80_000_000,  150_000_000], xp: 18 },
  pumpkin:    { emoji: "🎃", cost: 80_000_000,  time: 28800000,  yield: [160_000_000, 300_000_000], xp: 25 },
  mushroom:   { emoji: "🍄", cost: 150_000_000, time: 43200000,  yield: [300_000_000, 600_000_000], xp: 35 },
  golden:     { emoji: "✨", cost: 500_000_000, time: 86400000,  yield: [1_000_000_000, 2_500_000_000], xp: 60 },
};

reg("farm", {
  cat: "farm", desc: "View your farm plots",
  aliases: ["myfarm", "plots"],
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    const now     = Date.now();
    const watered = u.farm.lastWatered && (now - new Date(u.farm.lastWatered).getTime()) < 3600000;
    const lines   = [];
    for (let i = 1; i <= u.farm.plots; i++) {
      const slot = u.farm.crops[i];
      if (!slot) { lines.push(`**Slot ${i}:** 🟫 Empty — use \`~plant <crop> ${i}\``); continue; }
      const cropInfo  = CROPS[slot.crop];
      const elapsed   = now - new Date(slot.plantedAt).getTime();
      const growTime  = watered ? cropInfo.time * 0.75 : cropInfo.time;
      const remaining = Math.max(0, growTime - elapsed);
      if (remaining === 0) lines.push(`**Slot ${i}:** ${cropInfo.emoji} **${slot.crop}** — ✅ Ready! (\`~harvest ${i}\`)`);
      else lines.push(`**Slot ${i}:** ${cropInfo.emoji} **${slot.crop}** — ⏳ ${fmtTime(remaining)} left`);
    }
    const waterLine = watered ? "💧 Watered! (crops grow 25% faster)" : "🪣 Not watered — use `~water` to speed up!";
    msg.reply({ embeds: [emb(`🌾 ${t.username}'s Farm`, `${waterLine}\n\n${lines.join("\n")}\n\n**Plots:** ${u.farm.plots} | Expand with \`~buyplot\``)] });
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
    if (u.farm.crops[slotNum]) return msg.reply(err(`Slot **${slotNum}** already has a crop growing!`));
    const crop = CROPS[cropName];
    if (getCash(u) < BigInt(crop.cost)) return msg.reply(err(`Seeds cost ${CURRENCY} **${fmt(crop.cost)}**.`));
    subCash(u, crop.cost);
    u.farm.crops = { ...u.farm.crops, [slotNum]: { crop: cropName, plantedAt: new Date() } };
    await u.save();
    msg.reply({ embeds: [emb("🌱 Planted!", `${crop.emoji} **${cropName}** planted in slot **${slotNum}**!\n\nReady in **${fmtTime(crop.time)}**\nExpected yield: ${CURRENCY} **${fmt(crop.yield[0])}–${fmt(crop.yield[1])}**`, 0x23a559)] });
  },
});

reg("water", {
  cat: "farm", desc: "Water your crops — 25% faster growth for 1h",
  cd: 3600000,
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    u.farm.lastWatered = new Date();
    await u.save();
    msg.reply({ embeds: [emb("💧 Watered!", "Your crops grow **25% faster** for the next hour! 🌱", 0x3498db)] });
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
    const crop    = CROPS[slot.crop];
    const watered = u.farm.lastWatered && (Date.now() - new Date(u.farm.lastWatered).getTime()) < 3600000;
    const growTime = watered ? crop.time * 0.75 : crop.time;
    const elapsed  = Date.now() - new Date(slot.plantedAt).getTime();
    if (elapsed < growTime) return msg.reply(err(`**${slot.crop}** isn't ready yet! ${fmtTime(growTime - elapsed)} remaining.`));
    const earned = randInt(crop.yield[0], crop.yield[1]);
    addCash(u, earned);
    const crops = { ...u.farm.crops };
    delete crops[slotNum];
    u.farm.crops = crops;
    const leveled = await addXP(u, crop.xp);
    await u.save();
    msg.reply({ embeds: [emb("🌾 Harvested!", `${crop.emoji} **${slot.crop}** → ${CURRENCY} **${fmt(earned)}**!${leveled ? `\n\n⬆️ **Level up! You're now level ${u.level}!**` : ""}`, 0x23a559)] });
  },
});

reg("harvestall", {
  cat: "farm", desc: "Harvest all ready crops at once",
  aliases: ["ha"],
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    const watered = u.farm.lastWatered && (Date.now() - new Date(u.farm.lastWatered).getTime()) < 3600000;
    const crops   = { ...u.farm.crops };
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
    addCash(u, total);
    u.farm.crops = crops;
    await u.save();
    msg.reply({ embeds: [emb("🌾 Harvest All!", `Harvested **${harvested}** crop(s) for ${CURRENCY} **${fmt(total)}**!`, 0x23a559)] });
  },
});

reg("buyplot", {
  cat: "farm", desc: "Buy an extra farm plot",
  async run(msg) {
    const u = await getUser(msg.author.id, msg.guild.id);
    if (!u.farm) u.farm = { plots: 2, crops: {}, lastWatered: null };
    if (u.farm.plots >= 8) return msg.reply(err("Maximum **8** plots!"));
    const plotCost = BigInt(100_000_000 * u.farm.plots);
    if (getCash(u) < plotCost) return msg.reply(err(`Next plot costs ${CURRENCY} **${fmt(plotCost)}**.`));
    subCash(u, plotCost);
    u.farm.plots += 1;
    await u.save();
    msg.reply({ embeds: [emb("🌾 New Plot!", `You now have **${u.farm.plots}** plots! Next: ${CURRENCY} **${fmt(BigInt(100_000_000) * BigInt(u.farm.plots))}**.`, 0x23a559)] });
  },
});

reg("cropinfo", {
  cat: "farm", desc: "View all available crops and stats",
  aliases: ["crops"],
  async run(msg) {
    const lines = Object.entries(CROPS).map(([name, c]) =>
      `${c.emoji} **${name}** — Seeds: ${CURRENCY} ${fmt(c.cost)} | Time: ${fmtTime(c.time)} | Yield: ${CURRENCY} ${fmt(c.yield[0])}–${fmt(c.yield[1])} | XP: +${c.xp}`
    ).join("\n");
    msg.reply({ embeds: [emb("🌾 Crop Info", lines)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🍺 PUB SYSTEM (scaled payouts)
// ════════════════════════════════════════════════════════════
reg("pub", {
  cat: "pub", desc: "Visit the pub — drink and work for cash",
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    if (!u.pub) u.pub = { drinkCount: 0, lastDrink: null, lastPubGig: null, drunkUntil: null };
    const cd = cdLeft(u.pub.lastDrink, 1800000);
    if (cd > 0) return msg.reply(err(`You need to sober up. Come back in **${fmtTime(cd)}**.`));
    const drinkCost = 2_000_000;
    if (getCash(u) < BigInt(drinkCost)) return msg.reply(err(`A drink costs ${CURRENCY} **${fmt(drinkCost)}**.`));
    subCash(u, drinkCost);
    u.pub.drinkCount = (u.pub.drinkCount || 0) + 1;
    u.pub.lastDrink  = new Date();
    u.pub.drunkUntil = new Date(Date.now() + 1800000);
    await u.save();
    const lines = [
      "You knocked back a Vault Lager. 🍺 Feeling loose.",
      "You downed a Casino Shot. 🥃 Head's spinning.",
      "You sipped a High-Roller Cocktail. 🍹 Smooth.",
      "You chugged a Dealer's Brew. 🍻 The boys are vibing.",
    ];
    msg.reply({ embeds: [emb("🍺 The Pub", `${rand(lines)}\n\nCost: ${CURRENCY} **${fmt(drinkCost)}**\nDrinks tonight: **${u.pub.drinkCount}**\n\nWork the bar with \`~pubgig\``)] });
  },
});

reg("pubgig", {
  cat: "pub", desc: "Work a gig at the pub for cash (must be drunk)",
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    if (!u.pub) u.pub = { drinkCount: 0, lastDrink: null, lastPubGig: null, drunkUntil: null };
    if (!u.pub.drunkUntil || new Date(u.pub.drunkUntil) < new Date()) return msg.reply(err("You need to be drunk first! Use `~pub` to drink."));
    const cd = cdLeft(u.pub.lastPubGig, 3600000);
    if (cd > 0) return msg.reply(err(`Pub gig cooldown: **${fmtTime(cd)}** remaining.`));
    const pay = randMil(8, 30);
    addCash(u, pay);
    u.pub.lastPubGig = new Date();
    await u.save();
    const gigs = ["played pool and hustled the locals 🎱", "karaoke'd for tips 🎤", "won a pub quiz 🧠", "bartended all night 🍹", "arm-wrestled everyone and won 💪"];
    msg.reply({ embeds: [emb("🍺 Pub Gig!", `(Drunk) You ${rand(gigs)} and earned ${CURRENCY} **${fmt(pay)}**!`, 0x23a559)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🕵️ BLACK MARKET (scaled to millions)
// ════════════════════════════════════════════════════════════
const BM_ITEMS = {
  "🔫 Street Iron":      { price: 30_000_000,  desc: "+15% heist success chance",  heatGain: 15 },
  "🎭 Fake ID":          { price: 50_000_000,  desc: "Resets your heat to 0",      heatGain: 0  },
  "🧊 Heat Reducer":     { price: 20_000_000,  desc: "Reduces heat by 30",         heatGain: 0  },
  "💻 Hacking Rig":      { price: 80_000_000,  desc: "Boosts next heist payout ×2",heatGain: 20 },
  "📦 Mystery Crate":    { price: 25_000_000,  desc: "Random prize — could be huge", heatGain: 5 },
  "🏎️ Fast Wheels":      { price: 60_000_000,  desc: "Guarantees escape from next snatch bust", heatGain: 10 },
  "💊 Casino Pills":     { price: 40_000_000,  desc: "+10% win rate on next 3 casino games",    heatGain: 8  },
};

reg("bmshop", {
  cat: "blackmarket", desc: "Browse the black market",
  aliases: ["blackmarket", "bm"],
  async run(msg) {
    const lines = Object.entries(BM_ITEMS).map(([name, d]) =>
      `**${name}** — ${CURRENCY} **${fmt(d.price)}**\n> ${d.desc} *(+${d.heatGain} heat)*`
    ).join("\n\n");
    msg.reply({ embeds: [emb("🕵️ Black Market", `${lines}\n\nBuy with \`~bmbuy <item name>\``, 0x2c2f33)] });
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
    if (getCash(u) < BigInt(item.price)) return msg.reply(err(`You need ${CURRENCY} **${fmt(item.price)}**.`));
    const heat = u.bm.heatLevel || 0;
    if (heat >= 80 && Math.random() < 0.3) {
      const fine = randMil(10, 40);
      subCash(u, fine); u.bm.heatLevel = Math.max(0, heat - 20);
      await u.save();
      return msg.reply({ embeds: [emb("👮 BUSTED!", `Cops were watching! Fined ${CURRENCY} **${fmt(fine)}**.\nHeat -20.`, 0xe24b4a)] });
    }
    subCash(u, item.price);
    u.bm.heatLevel = Math.min(100, heat + item.heatGain);
    if (key.includes("Fake ID"))       { u.bm.heatLevel = 0; }
    else if (key.includes("Heat Reducer")) { u.bm.heatLevel = Math.max(0, (u.bm.heatLevel || 0) - 30); }
    else if (key.includes("Mystery Crate")) {
      const roll = Math.random();
      if (roll < 0.2) {
        const bonus = randMil(50, 200);
        addCash(u, bonus); await u.save();
        return msg.reply({ embeds: [emb("📦 Mystery Crate — JACKPOT!", `The crate had ${CURRENCY} **${fmt(bonus)}** inside! 🎉`, 0x23a559)] });
      } else if (roll < 0.5) {
        const rItem = rand(Object.keys(BM_ITEMS).filter(k => !k.includes("Mystery")));
        u.inventory.push(rItem); await u.save();
        return msg.reply({ embeds: [emb("📦 Mystery Crate", `You got: **${rItem}**!`, 0xf0a500)] });
      } else {
        await u.save();
        return msg.reply({ embeds: [emb("📦 Mystery Crate — Empty", "Just packing peanuts. Classic black market.", 0xe24b4a)] });
      }
    } else { u.inventory.push(key); }
    await u.save();
    msg.reply({ embeds: [emb("🕵️ Purchase Complete", `You bought **${key}** for ${CURRENCY} **${fmt(item.price)}**.\n\n**Heat:** ${u.bm.heatLevel}/100`, 0x2c2f33)] });
  },
});

reg("smuggle", {
  cat: "blackmarket", desc: "Run a smuggling job for massive cash (high risk)",
  cd: 10800000,
  async run(msg) {
    const u    = await getUser(msg.author.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const heat = u.bm.heatLevel || 0;
    const bustChance = 0.2 + (heat / 100) * 0.5;
    if (Math.random() < bustChance) {
      const fine = randMil(20, 80);
      subCash(u, fine); u.bm.heatLevel = Math.min(100, heat + 25);
      await u.save();
      return msg.reply({ embeds: [emb("👮 SMUGGLING BUST!", `Feds were waiting!\n\nFine: ${CURRENCY} **${fmt(fine)}**\nHeat: **+25** (now ${u.bm.heatLevel}/100)`, 0xe24b4a)] });
    }
    const jobs = [
      "smuggled vault chips across the border 🎰",
      "ran a midnight cash convoy 🚛",
      "moved a crate of ghost money 📦",
      "ran an underground auction 🎭",
      "delivered a sealed vault — no questions asked 🗃️",
    ];
    const payout = randMil(50, 200);
    addCash(u, payout); u.bm.heatLevel = Math.min(100, heat + randInt(10, 20));
    await u.save();
    msg.reply({ embeds: [emb("🕵️ Smuggling Done!", `You ${rand(jobs)} and earned ${CURRENCY} **${fmt(payout)}**!\n\n**Heat:** ${u.bm.heatLevel}/100`, 0x23a559)] });
  },
});

reg("launder", {
  cat: "blackmarket", desc: "Launder cash through the vault to reduce heat",
  cd: 14400000,
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    if (!u.bm) u.bm = { lastVisit: null, heatLevel: 0, lastLaunder: null };
    const cd  = cdLeft(u.bm.lastLaunder, 14400000);
    if (cd > 0) return msg.reply(err(`Launder cooldown: **${fmtTime(cd)}** remaining.`));
    let amt;
    try { amt = BigInt(Math.round(Math.abs(parseFloat(args[0]) || 0))); } catch { amt = 0n; }
    if (!amt || amt < 1_000_000n) return msg.reply(err(`Minimum launder amount is ${CURRENCY} **1,000,000**.`));
    if (getCash(u) < amt) return msg.reply(err(`You only have ${CURRENCY} **${fmt(getCash(u))}**.`));
    const fee      = amt * 20n / 100n;
    const returned = amt - fee;
    const heatDrop = Math.min(u.bm.heatLevel, Number(amt / 10_000_000n));
    subCash(u, fee);
    u.bm.heatLevel   = Math.max(0, (u.bm.heatLevel || 0) - heatDrop);
    u.bm.lastLaunder = new Date();
    await u.save();
    msg.reply({ embeds: [emb("🧼 Laundered", `You funnelled ${CURRENCY} **${fmt(amt)}** through the vault.\n\n**Fee (20%):** -${fmt(fee)}\n**Returned:** ${fmt(returned)}\n**Heat reduced:** -${heatDrop} (now ${u.bm.heatLevel}/100)`, 0x2c2f33)] });
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
    const status = heat >= 80 ? "🚨 **EXTREMELY HOT** — Cops are closing in!"
                 : heat >= 60 ? "⚠️ **HOT** — Getting very risky."
                 : heat >= 40 ? "🟡 **WARM** — Watch your back."
                 : heat >= 20 ? "🟢 **COOL** — Flying under the radar."
                 :              "✅ **ICE COLD** — Totally clean.";
    msg.reply({ embeds: [emb(`🕵️ ${t.username}'s Heat`, `\`${bar}\` **${heat}/100**\n\n${status}\n\nReduce heat: \`~launder\` or \`~bmbuy Heat Reducer\``)] });
  },
});

// ════════════════════════════════════════════════════════════
//  🔐 ADMIN PANEL
//  Only works if msg.author.id === ADMIN_ID (set in .env)
//  Commands:
//    ~admin add @user <amount>       — give cash
//    ~admin set @user <amount>       — set cash exactly
//    ~admin reset @user              — reset user to fresh start
//    ~admin wipe @user               — delete user document
//    ~admin inspect @user            — dump raw balance & stats
//    ~admin topup <amount>           — add cash to yourself
//    ~admin setlevel @user <level>   — set player level
// ════════════════════════════════════════════════════════════
reg("admin", {
  cat: "admin", desc: "Admin panel — restricted to bot owner",
  aliases: ["adm", "god"],
  async run(msg, args) {
    if (!ADMIN_ID || msg.author.id !== ADMIN_ID)
      return msg.reply(err("Access denied. Nice try 😈"));

    const sub    = args[0]?.toLowerCase();
    const target = msg.mentions.members.first() || (args[1] ? msg.guild.members.cache.get(args[1]) : null);

    if (sub === "add" || sub === "give") {
      if (!target) return msg.reply(err("Mention a user."));
      const amt = BigInt(Math.round(Math.abs(parseFloat(args[2]) || 0)));
      if (!amt) return msg.reply(err("Provide an amount."));
      const u = await getUser(target.id, msg.guild.id);
      addCash(u, amt); await u.save();
      return msg.reply({ embeds: [emb("🔐 Admin — Add", `Gave ${CURRENCY} **${fmt(amt)}** to **${target.user.username}**.\nNew balance: **${fmt(getCash(u))}**`, 0xf5c518)] });
    }

    if (sub === "set") {
      if (!target) return msg.reply(err("Mention a user."));
      const amt = BigInt(Math.round(Math.abs(parseFloat(args[2]) || 0)));
      const u   = await getUser(target.id, msg.guild.id);
      setCash(u, amt); await u.save();
      return msg.reply({ embeds: [emb("🔐 Admin — Set", `Set **${target.user.username}**'s cash to ${CURRENCY} **${fmt(amt)}**.`, 0xf5c518)] });
    }

    if (sub === "reset") {
      if (!target) return msg.reply(err("Mention a user."));
      const u    = await getUser(target.id, msg.guild.id);
      u.cash     = "5000000"; u.bank = "0"; u.totalWon = "0"; u.totalLost = "0";
      u.gamesPlayed = 0; u.level = 1; u.xp = 0; u.streak = 0;
      u.inventory   = []; u.marriedTo = null; u.marriedAt = null;
      u.duck        = { name: null, hunger: 100, lastFed: null, alive: false };
      await u.save();
      return msg.reply({ embeds: [emb("🔐 Admin — Reset", `Reset **${target.user.username}** to fresh start.`, 0xf5c518)] });
    }

    if (sub === "wipe") {
      if (!target) return msg.reply(err("Mention a user."));
      await User.deleteOne({ userId: target.id, guildId: msg.guild.id });
      return msg.reply({ embeds: [emb("🔐 Admin — Wipe", `Deleted all data for **${target.user.username}**.`, 0xe24b4a)] });
    }

    if (sub === "inspect") {
      if (!target) return msg.reply(err("Mention a user."));
      const u = await getUser(target.id, msg.guild.id);
      return msg.reply({ embeds: [emb(`🔐 Inspect — ${target.user.username}`)
        .addFields(
          { name: "💵 Cash",    value: fmt(getCash(u)),            inline: true },
          { name: "🏦 Bank",    value: fmt(getBank(u)),            inline: true },
          { name: "🎮 Games",   value: `${u.gamesPlayed}`,         inline: true },
          { name: "⭐ Level",   value: `${u.level}`,               inline: true },
          { name: "🔥 Streak",  value: `${u.streak}`,              inline: true },
          { name: "🔥 Heat",    value: `${u.bm?.heatLevel || 0}`,  inline: true },
          { name: "🎒 Items",   value: `${(u.inventory||[]).length}`, inline: true },
        )] });
    }

    if (sub === "topup") {
      const amt = BigInt(Math.round(Math.abs(parseFloat(args[1]) || 0)));
      if (!amt) return msg.reply(err("Provide an amount: `~admin topup <amount>`"));
      const u = await getUser(msg.author.id, msg.guild.id);
      addCash(u, amt); await u.save();
      return msg.reply({ embeds: [emb("🔐 Admin — Top Up", `Added ${CURRENCY} **${fmt(amt)}** to your vault.\nNew balance: **${fmt(getCash(u))}**`, 0xf5c518)] });
    }

    if (sub === "setlevel") {
      if (!target) return msg.reply(err("Mention a user."));
      const lvl = parseInt(args[2]);
      if (!lvl || lvl < 1) return msg.reply(err("Provide a valid level."));
      const u   = await getUser(target.id, msg.guild.id);
      u.level   = lvl; u.xp = 0; await u.save();
      return msg.reply({ embeds: [emb("🔐 Admin — Level Set", `Set **${target.user.username}** to level **${lvl}**.`, 0xf5c518)] });
    }

    // Default: show admin help
    msg.reply({ embeds: [emb("🔐 Admin Panel", [
      "`~admin add @user <amount>` — give cash",
      "`~admin set @user <amount>` — set cash to exact amount",
      "`~admin reset @user` — reset to fresh start",
      "`~admin wipe @user` — delete user data",
      "`~admin inspect @user` — view raw stats",
      "`~admin topup <amount>` — add cash to yourself",
      "`~admin setlevel @user <level>` — set player level",
    ].join("\n"), 0xf5c518)] });
  },
});

// ════════════════════════════════════════════════════════════
//  EVENTS
// ════════════════════════════════════════════════════════════
client.once("clientReady", async () => {
  console.log(`✅  VaultBot online as ${client.user.tag}`);
  const statuses = [
    { name: `~help | ${client.guilds.cache.size} servers`, type: 2 },
    { name: "not your average economy bot", type: 3 },
    { name: `~spin to lose everything`, type: 2 },
    { name: `millions in the vault`, type: 3 },
  ];
  let i = 0;
  client.user.setPresence({ activities: [statuses[0]], status: "online" });
  setInterval(() => {
    i = (i + 1) % statuses.length;
    client.user.setPresence({ activities: [statuses[i]], status: "online" });
  }, 20000);
});

// Global error handler — one bad message never crashes the process
process.on("unhandledRejection", (e) => console.error("[Unhandled Rejection]", e));
process.on("uncaughtException",  (e) => console.error("[Uncaught Exception]",  e));
client.on("error", (e) => console.error("[Discord error]", e));

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  maybeDropVault(msg);

  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const name = args.shift().toLowerCase();
  const cmd  = cmds[name];
  if (!cmd) return;

  // Cooldown check
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
  catch (e) { console.error(e); msg.reply(err("Something went wrong. Try again.")).catch(() => {}); }
});

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅  MongoDB connected");
  await client.login(process.env.DISCORD_TOKEN);
})();

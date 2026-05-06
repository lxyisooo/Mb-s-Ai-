// ============================================================
//  SpinBot — Original SlotBot-inspired economy & casino bot
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

const PREFIX   = process.env.PREFIX   || "~";
const CURRENCY = "💎";               // SpinBucks
const CURR_NAME = "SpinBucks";

// ── Mongoose Schemas ──────────────────────────────────────────
const userSchema = new mongoose.Schema({
  userId      : { type: String, required: true },
  guildId     : { type: String, required: true },
  cash        : { type: Number, default: 500 },
  bank        : { type: Number, default: 0 },
  lastDaily   : { type: Date,   default: null },
  lastWork    : { type: Date,   default: null },
  lastRob     : { type: Date,   default: null },
  lastAttack  : { type: Date,   default: null },
  lastWalletDrop: { type: Date, default: null },
  marriedTo   : { type: String, default: null },
  marriedAt   : { type: Date,   default: null },
  goose       : {
    name      : { type: String, default: null },
    hunger    : { type: Number, default: 100 },
    lastFed   : { type: Date,   default: null },
    alive     : { type: Boolean, default: false },
  },
  stunUntil   : { type: Date,   default: null },
  totalWon    : { type: Number, default: 0 },
  totalLost   : { type: Number, default: 0 },
  gamesPlayed : { type: Number, default: 0 },
  streak      : { type: Number, default: 0 },
});
userSchema.index({ guildId: 1, cash: -1 });
const User = mongoose.model("SpinUser", userSchema);

// ── Helpers ───────────────────────────────────────────────────
const rand     = (a) => a[Math.floor(Math.random() * a.length)];
const randInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const fmt      = (n) => Number(n).toLocaleString();
const cdLeft   = (date, ms) => Math.max(0, new Date(date).getTime() + ms - Date.now());
const fmtTime  = (ms) => {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

const ok  = (d) => ({ embeds: [{ color: 0x5865F2, description: `✅  ${d}` }] });
const err = (d) => ({ embeds: [{ color: 0xe24b4a, description: `❌  ${d}` }] });
const emb = (title, desc, color = 0x5865F2) =>
  new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc || "");

async function getUser(userId, guildId) {
  let u = await User.findOne({ userId, guildId });
  if (!u) u = await User.create({ userId, guildId });
  return u;
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
    const icons = { info: "📋", economy: "💰", casino: "🎰", social: "💍", goose: "🪿", fun: "😂" };
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
    msg.reply({ embeds: [emb("🎰 SpinBot", `*Not your average economy bot.*`)
      .addFields(
        { name: "Servers",   value: `${client.guilds.cache.size}`,         inline: true },
        { name: "Players",   value: `${total}`,                            inline: true },
        { name: "Prefix",    value: `\`${PREFIX}\``,                       inline: true },
        { name: "Currency",  value: `${CURRENCY} ${CURR_NAME}`,            inline: true },
        { name: "Uptime",    value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
      )] });
  },
});

// ════════════════════════════════════════════════════════════
//  ECONOMY — BALANCE / BANK / DAILY / WORK / ROB
// ════════════════════════════════════════════════════════════
reg("balance", {
  cat: "economy", desc: "Check your balance",
  aliases: ["bal", "wallet", "cash"],
  async run(msg, args) {
    const t   = msg.mentions.users.first() || msg.author;
    const u   = await getUser(t.id, msg.guild.id);
    msg.reply({ embeds: [emb(`${CURRENCY} ${t.username}'s Balance`)
      .addFields(
        { name: "💵 Cash",     value: `${CURRENCY} ${fmt(u.cash)}`,   inline: true },
        { name: "🏦 Bank",     value: `${CURRENCY} ${fmt(u.bank)}`,   inline: true },
        { name: "📊 Net Worth", value: `${CURRENCY} ${fmt(u.cash + u.bank)}`, inline: true },
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
    msg.reply(ok(`Deposited ${CURRENCY} **${fmt(amt)}** → Bank balance: ${CURRENCY} **${fmt(u.bank)}**`));
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
    msg.reply(ok(`Withdrew ${CURRENCY} **${fmt(amt)}** → Cash balance: ${CURRENCY} **${fmt(u.cash)}**`));
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
  cat: "economy", desc: "Work for some SpinBucks",
  aliases: ["grind"],
  cd: 3600000,
  async run(msg) {
    const u  = await getUser(msg.author.id, msg.guild.id);
    const cd = cdLeft(u.lastWork, 3600000);
    if (cd > 0) return msg.reply(err(`Work cooldown: **${fmtTime(cd)}** remaining.`));
    const jobs  = ["dealt cards at the casino 🃏", "cleaned the slot machines 🎰", "fixed a broken roulette wheel 🎡",
                   "served drinks at the casino bar 🍹", "counted chips for the house 💰", "drove the getaway car 🚗",
                   "secured the vault 🔒", "ran a quick errand for the boss 🧳"];
    const pay   = randInt(80, 180);
    u.cash += pay; u.lastWork = new Date(); await u.save();
    msg.reply({ embeds: [emb("💼 Work Complete", `You ${rand(jobs)} and earned ${CURRENCY} **${fmt(pay)}**!`, 0x23a559)] });
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
      u.cash  += stolen; tv.cash -= stolen;
      await u.save(); await tv.save();
      msg.reply({ embeds: [emb("🥷 Successful Heist!", `You swiped ${CURRENCY} **${fmt(stolen)}** from **${target.user.username}**!`, 0x23a559)] });
    } else {
      const fine = randInt(50, 150);
      u.cash = Math.max(0, u.cash - fine);
      await u.save();
      msg.reply({ embeds: [emb("🚔 Caught!", `You got caught robbing **${target.user.username}** and paid a ${CURRENCY} **${fmt(fine)}** fine!`, 0xe24b4a)] });
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

reg("stats", {
  cat: "economy", desc: "View your gambling stats",
  async run(msg, args) {
    const t = msg.mentions.users.first() || msg.author;
    const u = await getUser(t.id, msg.guild.id);
    const net = u.totalWon - u.totalLost;
    msg.reply({ embeds: [emb(`📊 ${t.username}'s Stats`)
      .addFields(
        { name: "🎮 Games Played", value: `${u.gamesPlayed}`,            inline: true },
        { name: "✅ Total Won",    value: `${CURRENCY} ${fmt(u.totalWon)}`, inline: true },
        { name: "❌ Total Lost",   value: `${CURRENCY} ${fmt(u.totalLost)}`, inline: true },
        { name: "📈 Net",          value: `${CURRENCY} ${fmt(net)} ${net >= 0 ? "📈" : "📉"}`, inline: true },
      )] });
  },
});

// ════════════════════════════════════════════════════════════
//  CASINO — SLOTS / FLIP / DICE / BLACKJACK / ROULETTE / CRASH
// ════════════════════════════════════════════════════════════
reg("slots", {
  cat: "casino", desc: "Spin the slot machine",
  aliases: ["slot", "spin"],
  async run(msg, args) {
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
    if (bet < 10)           return msg.reply(err("Minimum bet is ${CURRENCY} **10**."));
    if (bet > 100000)       return msg.reply(err("Maximum bet is ${CURRENCY} **100,000**."));
    if (u.cash < bet)       return msg.reply(err(`You need ${CURRENCY} **${fmt(bet)}** to bet. You have **${fmt(u.cash)}**.`));

    const symbols = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "🔔", "🎰"];
    const weights = [30,    25,   20,   12,   7,    3,    2,    1  ]; // rarer = higher value
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
    u.cash += net;
    u.gamesPlayed++;
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
    const pick   = ["heads", "heads", "heads", "heads", "tails", "tails", "tails", "edge"];
    const result = rand(pick);
    const norm   = side === "h" ? "heads" : side === "t" ? "tails" : side;
    const won    = norm === result || (result === "edge" && false);
    const edge   = result === "edge";
    let net;
    if (edge)     { net = bet * 5; u.cash += net; }
    else if (won) { net = bet;     u.cash += net; }
    else          { net = -bet;    u.cash += net; }
    u.gamesPlayed++; if (net > 0) u.totalWon += net; else u.totalLost += Math.abs(net);
    await u.save();
    const emoji  = result === "heads" ? "🪙 Heads" : result === "tails" ? "🌑 Tails" : "😱 EDGE";
    const color  = net > 0 ? 0x23a559 : 0xe24b4a;
    msg.reply({ embeds: [new EmbedBuilder().setColor(color)
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
    const num = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","🎲"];
    msg.reply({ embeds: [new EmbedBuilder().setColor(won ? 0x23a559 : 0xe24b4a)
      .setTitle("🎲 Dice Roll")
      .setDescription(`${num[roll - 1]} **Rolled ${roll}** (predicted ${dir})\n\n${won ? `${CURRENCY} **+${fmt(bet)}**` : `${CURRENCY} **-${fmt(bet)}**`}\nBalance: **${fmt(u.cash)}**`)] });
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
    const deck  = suits.flatMap(s => ranks.map(r => ({ r, s, red: s==="♥"||s==="♦" })))
                       .sort(() => Math.random() - 0.5);
    const val   = (hand) => {
      let v = 0, aces = 0;
      hand.forEach(c => { v += ["J","Q","K"].includes(c.r) ? 10 : c.r==="A" ? 11 : parseInt(c.r); if (c.r==="A") aces++; });
      while (v > 21 && aces-- > 0) v -= 10;
      return v;
    };
    const show = (hand) => hand.map(c => `\`${c.r}${c.s}\``).join(" ");

    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    const pv = val(player);

    if (pv === 21) {
      const payout = Math.floor(bet * 1.5);
      u.cash += payout; u.gamesPlayed++; u.totalWon += payout;
      await u.save();
      return msg.reply({ embeds: [emb("🃏 Blackjack — Natural 21! 🎉",
        `Your hand: ${show(player)} **(21)**\nDealer: ${show([dealer[0]])} **?**\n\n${CURRENCY} **+${fmt(payout)}** (3:2)\nBalance: **${fmt(u.cash)}**`, 0x23a559)] });
    }

    // Offer hit/stand via message-based prompt
    const makeEmbed = (ph, dh, result = null, color = 0x5865F2) => {
      let desc = `**Your hand:** ${show(ph)} **(${val(ph)})**\n**Dealer shows:** ${result ? show(dh) + ` **(${val(dh)})**` : show([dh[0]]) + " **?**"}`;
      if (result) desc += `\n\n${result}`;
      else        desc += "\n\nType `hit` or `stand`";
      return new EmbedBuilder().setColor(color).setTitle("🃏 Blackjack").setDescription(desc);
    };

    await msg.reply({ embeds: [makeEmbed(player, dealer)] });

    const filter = m => m.author.id === msg.author.id && ["hit","stand","h","s","double","d"].includes(m.content.toLowerCase());
    const coll   = msg.channel.createMessageCollector({ filter, time: 30000, max: 10 });

    coll.on("collect", async (m) => {
      const action = m.content.toLowerCase();
      if (action === "hit" || action === "h") {
        player.push(deck.pop());
        const pv2 = val(player);
        if (pv2 > 21) {
          u.cash -= bet; u.gamesPlayed++; u.totalLost += bet; await u.save();
          coll.stop();
          return msg.channel.send({ embeds: [makeEmbed(player, dealer, `💥 Bust! **${pv2}**\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(u.cash)}**`, 0xe24b4a)] });
        }
        if (pv2 === 21) { coll.stop(); settle(); }
        else msg.channel.send({ embeds: [makeEmbed(player, dealer)] });
      } else {
        coll.stop(); settle();
      }
    });

    coll.on("end", (_, reason) => { if (reason === "time") msg.channel.send(err("Blackjack timed out — hand cancelled.")); });

    async function settle() {
      while (val(dealer) < 17) dealer.push(deck.pop());
      const pv2 = val(player), dv = val(dealer);
      let net2, resultText, color;
      if (dv > 21 || pv2 > dv)      { net2 = bet;   resultText = `🎉 You win! **(${pv2} vs ${dv})**\n${CURRENCY} **+${fmt(bet)}**`; color = 0x23a559; }
      else if (pv2 === dv)           { net2 = 0;     resultText = `🤝 Push! **(${pv2} vs ${dv})**\nBet returned.`;                  color = 0xf0a500; }
      else                           { net2 = -bet;  resultText = `😢 Dealer wins. **(${pv2} vs ${dv})**\n${CURRENCY} **-${fmt(bet)}**`; color = 0xe24b4a; }
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
    const u   = await getUser(msg.author.id, msg.guild.id);
    const bet = parseInt(args[0]) || 50;
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

    const color = net > 0 ? 0x23a559 : 0xe24b4a;
    msg.reply({ embeds: [new EmbedBuilder().setColor(color)
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

    // Generate crash point (house edge baked in)
    const crash = +(Math.max(1, (100 / (Math.random() * 100 + 1))).toFixed(2));
    let mult  = 1.00;

    const sent = await msg.channel.send({ embeds: [emb("🚀 CRASH", `Multiplier: **${mult.toFixed(2)}×**\n\nType \`cashout\` to cash out!\nBet: ${CURRENCY} **${fmt(bet)}**`)] });
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
      const color = crashed ? 0xe24b4a : 0x23a559;
      const desc  = crashed
        ? `💥 Crashed at **${crash.toFixed(2)}×**!\n\n${CURRENCY} **-${fmt(bet)}**\nBalance: **${fmt(u.cash)}**`
        : `✅ Cashed out at **${cashedAt.toFixed(2)}×** (crashed at ${crash.toFixed(2)}×)\n\n${CURRENCY} **+${fmt(net)}**\nBalance: **${fmt(u.cash)}**`;
      sent.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle("🚀 CRASH Result").setDescription(desc)] });
    }
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
      return msg.channel.send(err(`**${target.user.username}** declined the proposal. Ouch. 💔`));

    u.marriedTo = target.id; u.marriedAt = new Date();
    tv.marriedTo = msg.author.id; tv.marriedAt = new Date();
    await u.save(); await tv.save();
    msg.channel.send({ embeds: [emb("💍 Just Married!", `🎉 **${msg.author.username}** and **${target.user.username}** are now married!\n\nMay your SpinBucks multiply together. 💑`, 0xf5c518)] });
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
    u.cash     = Math.max(0, u.cash - fine);
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

    // Check if target is stunned
    if (tv.stunUntil && new Date(tv.stunUntil) > new Date()) {
      return msg.reply(err(`**${target.user.username}** is already stunned!`));
    }

    const outcomes = [
      { chance: 0.4,  result: "success",  label: "🪿 HONK HONK! Your goose attacks successfully!" },
      { chance: 0.3,  result: "stun",     label: "😵 Your goose bites and the target is stunned!" },
      { chance: 0.2,  result: "backfire", label: "💨 Your goose got scared and ran away!" },
      { chance: 0.1,  result: "both_stun",label: "🤪 Both of you got startled by the goose!" },
    ];
    let r = Math.random(), outcome;
    for (const o of outcomes) { r -= o.chance; if (r <= 0) { outcome = o; break; } }
    outcome = outcome || outcomes[0];

    const steal = randInt(30, 120);
    u.lastAttack = new Date();

    if (outcome.result === "success") {
      tv.cash = Math.max(0, tv.cash - steal); u.cash += steal;
    } else if (outcome.result === "stun") {
      tv.stunUntil = new Date(Date.now() + 120000); // 2 min stun
      u.cash += Math.floor(steal / 2);
      tv.cash = Math.max(0, tv.cash - Math.floor(steal / 2));
    } else if (outcome.result === "backfire") {
      u.stunUntil = new Date(Date.now() + 60000);
    } else {
      u.stunUntil = new Date(Date.now() + 30000);
      tv.stunUntil = new Date(Date.now() + 30000);
    }

    await u.save(); await tv.save();
    const extra = outcome.result === "success" ? `\nStole ${CURRENCY} **${fmt(steal)}** from **${target.user.username}**!`
                : outcome.result === "stun"    ? `\nStunned **${target.user.username}** for 2 mins & stole ${CURRENCY} **${fmt(Math.floor(steal/2))}**!`
                : "";
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
//  GOOSE — ADOPT / FEED / GOOSEINFO
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

    // Hunger decay
    const hoursSinceFed = u.goose.lastFed ? (Date.now() - new Date(u.goose.lastFed).getTime()) / 3600000 : 0;
    const currentHunger = Math.max(0, Math.round(u.goose.hunger - hoursSinceFed * 4));
    if (currentHunger === 0 && u.goose.alive) {
      u.goose.alive = false; await u.save();
      return msg.reply({ embeds: [emb("💀 Your goose died...", `**${u.goose.name}** starved to death! 😢\nAdopt a new one with \`~adopt\`.`, 0xe24b4a)] });
    }
    const hungerBar = "█".repeat(Math.round(currentHunger/10)) + "░".repeat(10-Math.round(currentHunger/10));
    msg.reply({ embeds: [emb(`🪿 ${u.goose.name}`)
      .addFields(
        { name: "Status",  value: u.goose.alive ? "Alive 🟢" : "Dead 💀", inline: true },
        { name: "Hunger",  value: `\`${hungerBar}\` ${currentHunger}%`,    inline: false },
      )] });
  },
});

// ════════════════════════════════════════════════════════════
//  WALLET DROP (random event in chat)
// ════════════════════════════════════════════════════════════
const walletCooldowns = new Map();

function maybeDropWallet(msg) {
  if (Math.random() > 0.015) return; // ~1.5% chance per message
  const guildId = msg.guild.id;
  if (walletCooldowns.has(guildId)) return;
  walletCooldowns.set(guildId, true);
  setTimeout(() => walletCooldowns.delete(guildId), 300000); // 5 min cooldown per guild

  const cash  = randInt(50, 500);
  const pills = randInt(1, 5);
  msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xf5c518)
    .setTitle("👛 A wallet dropped!")
    .setDescription(`Someone dropped their wallet!\n\nType \`~grab\` to claim it!\n\n${CURRENCY} **${fmt(cash)}** + **${pills}x** 🐦 Goose Pills inside!`)] });

  // Store for claiming
  msg.channel._walletDrop = { cash, pills, expires: Date.now() + 30000 };
}

reg("grab", {
  cat: "fun", desc: "Grab a dropped wallet",
  async run(msg) {
    const drop = msg.channel._walletDrop;
    if (!drop || Date.now() > drop.expires) return msg.reply(err("No wallet to grab here!"));
    delete msg.channel._walletDrop;
    const u = await getUser(msg.author.id, msg.guild.id);
    u.cash += drop.cash; await u.save();
    msg.reply({ embeds: [emb("👛 Wallet Grabbed!", `You snagged the wallet!\n\n${CURRENCY} **+${fmt(drop.cash)}** added to your cash!\n(${drop.pills}x 🐦 Goose Pills were inside too!)`, 0x23a559)] });
  },
});

// ════════════════════════════════════════════════════════════
//  FUN / MISC
// ════════════════════════════════════════════════════════════
reg("profile", {
  cat: "fun", desc: "View your full SpinBot profile",
  aliases: ["me", "p"],
  async run(msg, args) {
    const t  = msg.mentions.users.first() || msg.author;
    const u  = await getUser(t.id, msg.guild.id);
    const member = msg.guild.members.cache.get(t.id);
    const e = new EmbedBuilder().setColor(member?.displayHexColor || 0x5865F2)
      .setAuthor({ name: t.tag, iconURL: t.displayAvatarURL() })
      .setThumbnail(t.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: `${CURRENCY} Cash`,    value: fmt(u.cash),                       inline: true },
        { name: "🏦 Bank",             value: fmt(u.bank),                       inline: true },
        { name: "🎮 Games Played",     value: `${u.gamesPlayed}`,                inline: true },
        { name: "💑 Partner",          value: u.marriedTo ? `<@${u.marriedTo}>` : "Single", inline: true },
        { name: "🪿 Goose",            value: u.goose.alive ? u.goose.name : "None", inline: true },
        { name: "🔥 Daily Streak",     value: `${u.streak} days`,                inline: true },
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

// ════════════════════════════════════════════════════════════
//  EVENTS
// ════════════════════════════════════════════════════════════
client.once("ready", async () => {
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

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  // Wallet drops
  maybeDropWallet(msg);

  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const name = args.shift().toLowerCase();
  const cmd  = cmds[name];
  if (!cmd) return;

  // Cooldown
  if (cmd.cd) {
    const key = `${msg.author.id}:${name}`;
    if (client.cooldowns.has(key)) {
      const left = cdLeft(client.cooldowns.get(key), cmd.cd);
      if (left > 0) return msg.reply(err(`Cooldown: **${fmtTime(left)}** remaining.`));
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

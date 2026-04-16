/************************************************
 * HOUSE OF MB — ABSOLUTE EDITION
 * PREFIX: mb
 * ALL SYSTEMS • ONE FILE • NO SLASH COMMANDS
 ************************************************/

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

/* ───── CONFIG ───── */
const cfg = {
  prefix: "mb",
  admins: ["1451533934130364467"],
  economy: {
    startCash: 1000,
    daily: 500
  },
  casino: {
    slotsMulti: 2,
    jackpotChance: 0.05
  },
  raids: {
    baseBank: 25000,
    failPenalty: 5000
  },
  pets: {
    list: {
      cat: { id: "cat", name: "🐱 Cat", cost: 500, multi: 0.1 },
      wolf: { id: "wolf", name: "🐺 Wolf", cost: 1500, multi: 0.25 },
      dragon: { id: "dragon", name: "🐉 Dragon", cost: 5000, multi: 0.75 }
    }
  }
};

/* ───── CLIENT ───── */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ───── DATABASE ───── */
mongoose.connect(process.env.MONGO_URI);

const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  cash: { type: Number, default: 0 },
  pet: { type: Object, default: null },
  pets: { type: Array, default: [] },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  cooldowns: { type: Object, default: {} },
  accepted: { type: Boolean, default: false }
}));

const Raid = mongoose.model("Raid", new mongoose.Schema({
  guildId: String,
  bank: { type: Number, default: cfg.raids.baseBank }
}));

const Season = mongoose.model("Season", new mongoose.Schema({
  start: Number,
  end: Number
}));

/* ───── NPC FLAVOR SYSTEM ───── */
const npc = [
  "🎲 Luck shifts in the room...",
  "💰 Coins clatter somewhere unseen...",
  "🐾 Your pet senses opportunity...",
  "🏦 Security systems hesitate...",
  "👁️ The House is watching..."
];
const say = () => npc[Math.floor(Math.random() * npc.length)];

/* ───── HELPERS ───── */
const E = (t, d, c = "#ff3355") =>
  new EmbedBuilder()
    .setTitle(t)
    .setDescription(d)
    .setColor(c)
    .setFooter({ text: "House of MB • Reality Engine" });

const cd = (u, k, t) => {
  if (!u.cooldowns[k] || Date.now() > u.cooldowns[k]) {
    u.cooldowns[k] = Date.now() + t;
    return 0;
  }
  return Math.ceil((u.cooldowns[k] - Date.now()) / 1000);
};

const multi = u => 1 + (u.pet?.multi || 0);

/* ───── READY ───── */
client.once("ready", async () => {
  console.log("🔥 HOUSE OF MB — ABSOLUTE EDITION ONLINE");

  let s = await Season.findOne();
  if (!s)
    await Season.create({
      start: Date.now(),
      end: Date.now() + 1000 * 60 * 60 * 24 * 30
    });
});

/* ───── BUTTON UI ───── */
client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  const map = {
    casino: "🎰 **Casino**\n`mb slots <bet>`\n`mb blackjack <bet>`\n`mb jackpot <bet>`",
    pets: "🐾 **Pets**\n`mb pets`\n`mb buypet <name>`\n`mb fuse`",
    raid: "🏦 **Raid**\n`mb raid` — high risk"
  };

  return i.reply({ ephemeral: true, content: map[i.customId] });
});

/* ───── COMMAND ROUTER ───── */
client.on("messageCreate", async m => {
  if (!m.content.startsWith(cfg.prefix) || m.author.bot) return;

  const args = m.content.slice(cfg.prefix.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  const flavor = say();

  let u = await User.findOne({ userId: m.author.id });
  if (!u)
    u = await User.create({
      userId: m.author.id,
      cash: cfg.economy.startCash
    });

  /* ───── ACCEPT ───── */
  if (cmd === "accept") {
    u.accepted = true;
    await u.save();
    return m.reply("✨ **Welcome to the House of MB.**");
  }

  /* ───── HELP ───── */
  if (cmd === "help") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("casino").setLabel("🎰 Casino").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("pets").setLabel("🐾 Pets").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("raid").setLabel("🏦 Raids").setStyle(ButtonStyle.Secondary)
    );

    return m.reply({
      embeds: [
        E(
          "🏠 House of MB",
          `A living economy. Real risk.\n\n${flavor}\n\n👉 **mb accept** to begin`
        )
      ],
      components: [row]
    });
  }

  if (!u.accepted) return m.reply("⚠️ Use **mb help** first.");

  /* ───── BALANCE ───── */
  if (cmd === "bal") {
    return m.reply(
      E(
        "💼 Your Wallet",
        `💰 Cash: **$${u.cash}**\n🐾 Pet: **${u.pet?.name || "None"}**`
      )
    );
  }

  /* ───── DAILY ───── */
  if (cmd === "daily") {
    const w = cd(u, "daily", 86400000);
    if (w) {
      await u.save();
      return m.reply(`⏳ Come back in **${w}s**`);
    }

    const earned = Math.floor(cfg.economy.daily * multi(u));
    u.cash += earned;
    await u.save();

    return m.reply(E("🎁 Daily Reward", `+ **$${earned}**\n\n${flavor}`));
  }

  /* ───── BET VALIDATION ───── */
  const bet = parseInt(args[0]);
  if (["slots", "blackjack", "jackpot"].includes(cmd)) {
    if (!bet || bet <= 0 || bet > u.cash)
      return m.reply("❌ Invalid bet.");
  }

  /* ───── SLOTS ───── */
  if (cmd === "slots") {
    const roll = Math.random();
    let delta = -bet;
    let result = "💀 LOSS";

    if (roll < 0.05) {
      delta = bet * 5;
      result = "💥 JACKPOT";
    } else if (roll < 0.45) {
      delta = bet * cfg.casino.slotsMulti;
      result = "🎉 WIN";
    }

    u.cash += delta;
    u.wins += delta > 0 ? 1 : 0;
    u.losses += delta < 0 ? 1 : 0;
    await u.save();

    return m.reply(E("🎰 Slots", `${result}\n💵 ${delta}`));
  }

  /* ───── BLACKJACK ───── */
  if (cmd === "blackjack") {
    const p = Math.floor(Math.random() * 21) + 1;
    const d = Math.floor(Math.random() * 21) + 1;
    const win = p <= 21 && (d > 21 || p > d);

    u.cash += win ? bet * 2 : -bet;
    u.wins += win ? 1 : 0;
    u.losses += win ? 0 : 1;
    await u.save();

    return m.reply(
      E(
        "🃏 Blackjack",
        `You: **${p}** | Dealer: **${d}**\n\n${win ? "🎉 WIN" : "💀 LOSS"}`
      )
    );
  }

  /* ───── JACKPOT ───── */
  if (cmd === "jackpot") {
    const win = Math.random() < cfg.casino.jackpotChance;
    u.cash += win ? bet * 10 : -bet;
    await u.save();

    return m.reply(
      E("🎲 Jackpot", win ? "💎 **MEGA WIN**" : "😬 No luck this time")
    );
  }

  /* ───── PETS ───── */
  if (cmd === "pets") {
    return m.reply(
      E(
        "🐾 Pet Market",
        Object.values(cfg.pets.list)
          .map(p => `${p.name} — **$${p.cost}** | x${1 + p.multi}`)
          .join("\n")
      )
    );
  }

  if (cmd === "buypet") {
    const p = cfg.pets.list[args[0]];
    if (!p || u.cash < p.cost) return m.reply("❌ Not available");

    u.cash -= p.cost;
    u.pets.push(p);
    u.pet = p;
    await u.save();

    return m.reply(E("🐾 New Companion", `${p.name} joins you!`));
  }

  if (cmd === "fuse") {
    if (u.pets.length < 2) return m.reply("❌ Need 2 pets");

    const a = u.pets.pop();
    const b = u.pets.pop();

    u.pet = {
      name: `🧬 ${a.name}-${b.name}`,
      multi: (a.multi + b.multi) * 1.8
    };

    await u.save();
    return m.reply(E("🧬 Fusion Success", "A powerful new pet emerges!"));
  }

  /* ───── RAID ───── */
  if (cmd === "raid") {
    let r = await Raid.findOne({ guildId: m.guild.id });
    if (!r) r = await Raid.create({ guildId: m.guild.id });

    const win = Math.random() < 0.5;
    u.cash += win ? r.bank : -cfg.raids.failPenalty;
    r.bank = win ? cfg.raids.baseBank : r.bank + cfg.raids.failPenalty;

    await r.save();
    await u.save();

    return m.reply(
      E("🏦 Bank Raid", win ? "💥 VAULT BREACHED!" : "🚨 RAID FAILED")
    );
  }

  /* ───── LEADERBOARD ───── */
  if (cmd === "top") {
    const top = await User.find().sort({ cash: -1 }).limit(5);
    return m.reply(
      E(
        "🏆 Richest Players",
        top.map((x, i) => `#${i + 1} <@${x.userId}> — $${x.cash}`).join("\n")
      )
    );
  }

  /* ───── ADMIN ───── */
  if (cmd === "inject" && cfg.admins.includes(m.author.id)) {
    u.cash += parseInt(args[0]) || 0;
    await u.save();
    return m.reply("💉 Reality altered.");
  }

  if (cmd === "wipe" && cfg.admins.includes(m.author.id)) {
    await User.deleteMany({});
    return m.reply("☢️ World reset.");
  }
});

/* ───── LOGIN ───── */
client.login(process.env.TOKEN);

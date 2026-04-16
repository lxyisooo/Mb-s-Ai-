// ===============================
// HOUSE OF MB — SUPREME ECONOMY
// Prefix: mb
// One file. No dead systems.
// ===============================

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

const PREFIX = "mb";

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  userId: String,
  cash: { type: Number, default: 1000 },
  bank: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },

  pets: { type: Array, default: [] },
  pet: { type: Object, default: null },

  skills: {
    luck: { type: Number, default: 0 },
    combat: { type: Number, default: 0 },
    defense: { type: Number, default: 0 }
  },

  items: { type: Array, default: [] },

  prestige: { type: Number, default: 0 },
  cooldowns: { type: Object, default: {} }
});

const raidSchema = new mongoose.Schema({
  guildId: String,
  bossHP: { type: Number, default: 50000 },
  level: { type: Number, default: 1 }
});

const User = mongoose.model("User", userSchema);
const Raid = mongoose.model("Raid", raidSchema);

/* ================= DATA ================= */
const PETS = {
  cat: { name: "Cat", cost: 500, multi: 0.1, ability: "dodge" },
  wolf: { name: "Wolf", cost: 2000, multi: 0.25, ability: "crit" },
  dragon: { name: "Dragon", cost: 7000, multi: 0.75, ability: "burn" }
};

const ITEMS = {
  charm: { name: "Lucky Charm", cost: 3000 },
  armor: { name: "Armor Plating", cost: 5000 },
  blade: { name: "Sharp Blade", cost: 4000 }
};

/* ================= HELPERS ================= */
const E = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor("#2f3136");

function cooldown(u, key, time) {
  if (!u.cooldowns[key] || Date.now() > u.cooldowns[key]) {
    u.cooldowns[key] = Date.now() + time;
    return 0;
  }
  return Math.ceil((u.cooldowns[key] - Date.now()) / 1000);
}

function totalMultiplier(u) {
  return (
    1 +
    (u.pet?.multi || 0) +
    u.skills.luck * 0.05 +
    u.items.length * 0.05 +
    u.prestige * 0.15
  );
}

/* ================= READY ================= */
client.once("ready", () => {
  console.log("HOUSE OF MB — SUPREME ONLINE");
});

/* ================= COMMAND HANDLER ================= */
client.on("messageCreate", async m => {
  if (!m.content.toLowerCase().startsWith(PREFIX + " ") || m.author.bot) return;

  const args = m.content.slice(PREFIX.length + 1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  let u = await User.findOne({ userId: m.author.id });
  if (!u) u = await User.create({ userId: m.author.id });

/* ================= ECONOMY ================= */
  if (cmd === "bal") {
    return m.reply(E("Wallet",
      `Cash: $${u.cash}\nBank: $${u.bank}\nPrestige: ${u.prestige}`
    ));
  }

  if (cmd === "daily") {
    const w = cooldown(u, "daily", 86400000);
    if (w) return m.reply(`⏳ ${w}s remaining`);

    const gain = Math.floor(800 * totalMultiplier(u));
    u.cash += gain;
    await u.save();

    return m.reply(E("Daily", `+$${gain}`));
  }

/* ================= CASINO ================= */
  if (cmd === "slots") {
    const bet = parseInt(args[0]);
    if (!bet || bet <= 0 || bet > u.cash) return m.reply("Invalid bet.");

    const chance = 0.45 + u.skills.luck * 0.02;
    const win = Math.random() < chance;

    u.cash += win ? bet * 2 : -bet;
    win ? u.wins++ : u.losses++;
    await u.save();

    return m.reply(E("Slots", win ? "🎰 WIN" : "❌ LOSS"));
  }

  if (cmd === "blackjack") {
    const bet = parseInt(args[0]);
    if (!bet || bet > u.cash) return m.reply("Invalid bet.");

    const p = Math.floor(Math.random() * 21) + 1;
    const d = Math.floor(Math.random() * 21) + 1;
    const win = p <= 21 && (d > 21 || p > d);

    u.cash += win ? bet * 2 : -bet;
    await u.save();

    return m.reply(E("Blackjack", `You: ${p} | Dealer: ${d}`));
  }

/* ================= PETS ================= */
  if (cmd === "pets") {
    return m.reply(E("Pets",
      Object.entries(PETS)
        .map(([k, p]) => `${k} — $${p.cost} (${p.ability})`)
        .join("\n")
    ));
  }

  if (cmd === "buypet") {
    const p = PETS[args[0]];
    if (!p || u.cash < p.cost) return m.reply("Unavailable.");

    u.cash -= p.cost;
    u.pet = p;
    u.pets.push(p);
    await u.save();

    return m.reply(E("Pet Acquired", p.name));
  }

/* ================= SKILLS ================= */
  if (cmd === "skills") {
    return m.reply(E("Skills",
      `Luck: ${u.skills.luck}\nCombat: ${u.skills.combat}\nDefense: ${u.skills.defense}`
    ));
  }

  if (cmd === "train") {
    const skill = args[0];
    if (!u.skills[skill]) return m.reply("Invalid skill.");
    if (u.cash < 1000) return m.reply("Need $1000.");

    u.cash -= 1000;
    u.skills[skill]++;
    await u.save();

    return m.reply(E("Training", `${skill} increased.`));
  }

/* ================= SHOP ================= */
  if (cmd === "shop") {
    return m.reply(E("Shop",
      Object.entries(ITEMS)
        .map(([k, i]) => `${k} — $${i.cost}`)
        .join("\n")
    ));
  }

  if (cmd === "buy") {
    const i = ITEMS[args[0]];
    if (!i || u.cash < i.cost) return m.reply("Unavailable.");

    u.cash -= i.cost;
    u.items.push(i.name);
    await u.save();

    return m.reply(E("Purchased", i.name));
  }

/* ================= DUEL ================= */
  if (cmd === "duel") {
    const target = m.mentions.users.first();
    const bet = parseInt(args[1]);
    if (!target || !bet || bet > u.cash) return m.reply("Invalid duel.");

    const o = await User.findOne({ userId: target.id });
    if (!o || o.cash < bet) return m.reply("Opponent invalid.");

    const atk = Math.random() + u.skills.combat * 0.1;
    const def = Math.random() + o.skills.defense * 0.1;
    const win = atk > def;

    u.cash += win ? bet : -bet;
    o.cash += win ? -bet : bet;

    await u.save(); await o.save();
    return m.reply(E("Duel", win ? "You won." : "You lost."));
  }

/* ================= RAID BOSS ================= */
  if (cmd === "raid") {
    let r = await Raid.findOne({ guildId: m.guild.id });
    if (!r) r = await Raid.create({ guildId: m.guild.id });

    const dmg = Math.floor(500 + Math.random() * u.skills.combat * 300);
    r.bossHP -= dmg;

    if (r.bossHP <= 0) {
      const reward = 10000 * r.level;
      u.cash += reward;
      r.level++;
      r.bossHP = 50000 * r.level;
      await r.save(); await u.save();
      return m.reply(E("BOSS DOWN", `You dealt final blow. +$${reward}`));
    }

    await r.save();
    return m.reply(E("Raid", `You dealt ${dmg} damage.`));
  }

/* ================= PRESTIGE ================= */
  if (cmd === "prestige") {
    if (u.cash < 150000) return m.reply("Need $150k.");

    u.cash = 1000;
    u.skills = { luck: 0, combat: 0, defense: 0 };
    u.items = [];
    u.pets = [];
    u.pet = null;
    u.prestige++;
    await u.save();

    return m.reply(E("Prestige", `Now prestige ${u.prestige}`));
  }

/* ================= LEADERBOARD ================= */
  if (cmd === "top") {
    const top = await User.find().sort({ cash: -1 }).limit(5);
    return m.reply(E("Top Players",
      top.map((x, i) => `#${i+1} <@${x.userId}> $${x.cash}`).join("\n")
    ));
  }

});

/* ================= LOGIN ================= */
client.login(process.env.TOKEN);

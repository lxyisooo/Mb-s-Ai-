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

/* ───── DATABASE ───── */
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  userId: String,

  cash: { type: Number, default: 1000 },
  bank: { type: Number, default: 0 },

  gems: { type: Number, default: 0 }, // 💎 PAY TO WIN
  vip: { type: Boolean, default: false },

  boost: {
    multiplier: { type: Number, default: 1 },
    expires: { type: Number, default: 0 }
  },

  insurance: { type: Boolean, default: false },

  prestige: { type: Number, default: 0 },
  baseMultiplier: { type: Number, default: 1 },

  cooldowns: {
    daily: { type: Number, default: 0 },
    crime: { type: Number, default: 0 },
    work: { type: Number, default: 0 }
  },

  accepted: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

/* ───── UTIL ───── */
function cd(u, type, ms) {
  const now = Date.now();
  if (now < u.cooldowns[type]) return Math.ceil((u.cooldowns[type] - now) / 1000);
  u.cooldowns[type] = now + ms;
  return false;
}

function getMultiplier(u) {
  let m = u.baseMultiplier;
  if (u.vip) m += 0.5;
  if (Date.now() < u.boost.expires) m *= u.boost.multiplier;
  return m;
}

/* ───── READY ───── */
client.once("ready", () => console.log("💸 HOUSE OF MB — PAY TO WIN ONLINE"));

/* ───── HELP ───── */
const helpEmbed = new EmbedBuilder()
  .setTitle("🏠 House of MB — Pay To Win")
  .setDescription(
    "**💰 Economy**\n`mb bal` `mb daily`\n\n" +
    "**🎰 Gambling**\n`mb slots <bet>`\n\n" +
    "**💀 Crime**\n`mb crime`\n\n" +
    "**💎 Premium**\n`mb shop` `mb boost`\n\n" +
    "**📈 Prestige**\n`mb prestige`\n"
  )
  .setColor("#ff0066");

const helpRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("accept")
    .setLabel("Accept Rules")
    .setStyle(ButtonStyle.Success)
);

/* ───── MESSAGE HANDLER ───── */
client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  let u = await User.findOne({ userId: msg.author.id });
  if (!u) u = await User.create({ userId: msg.author.id });

  if (cmd === "help")
    return msg.reply({ embeds: [helpEmbed], components: [helpRow] });

  if (!u.accepted)
    return msg.reply("⚠️ Accept rules using `mb help`");

  const mult = getMultiplier(u);

  /* ───── BAL ───── */
  if (cmd === "bal") {
    return msg.reply(
      `💰 Cash: ${u.cash}\n💎 Gems: ${u.gems}\n👑 VIP: ${u.vip}\n📈 Prestige: ${u.prestige}\n⚡ Multiplier: x${mult.toFixed(2)}`
    );
  }

  /* ───── DAILY ───── */
  if (cmd === "daily") {
    const wait = cd(u, "daily", u.vip ? 43200000 : 86400000);
    if (wait) return msg.reply(`⏳ ${wait}s left`);

    const reward = Math.floor(2000 * mult);
    u.cash += reward;
    await u.save();

    return msg.reply(`🎁 Daily claimed: **+${reward} MB Cash**`);
  }
  /* ───── CRIME ───── */
  if (cmd === "crime") {
    const wait = cd(u, "crime", 60000);
    if (wait) return msg.reply(`⏳ ${wait}s`);

    const success = Math.random() < (u.vip ? 0.75 : 0.55);

    if (success) {
      const win = Math.floor(1500 * mult);
      u.cash += win;
      await u.save();
      return msg.reply(`💀 Crime SUCCESS! +${win}`);
    } else {
      if (u.insurance) {
        u.insurance = false;
        await u.save();
        return msg.reply("🛡️ Insurance saved you from losing cash!");
      }
      const loss = Math.floor(700 * mult);
      u.cash -= loss;
      await u.save();
      return msg.reply(`🚨 Caught! -${loss}`);
    }
  }

  /* ───── SLOTS ───── */
  if (cmd === "slots") {
    const bet = parseInt(args[0]);
    if (!bet || bet < 10 || bet > u.cash)
      return msg.reply("❌ `mb slots <amount>`");

    const icons = ["🍒", "💎", "🔥"];
    const roll = icons.map(() => icons[Math.floor(Math.random() * icons.length)]);
    const win = roll.every(v => v === roll[0]);

    let result = win ? bet * 6 : -bet;
    if (!win && u.insurance) {
      u.insurance = false;
      result = 0;
    }

    u.cash += result;
    await u.save();

    return msg.reply(
      `🎰 [ ${roll.join(" | ")} ]\n` +
      (win ? `🔥 WIN +${result}` : result === 0 ? "🛡️ Insurance saved you!" : `💸 LOSS ${result}`)
    );
  }

  /* ───── SHOP ───── */
  if (cmd === "shop") {
    return msg.reply(
      "**💎 MB SHOP**\n" +
      "`mb boost` → 5 gems (2× for 1h)\n" +
      "`mb insurance` → 3 gems (1 use)\n" +
      "`mb vip` → Admin only"
    );
  }

  if (cmd === "boost") {
    if (u.gems < 5) return msg.reply("❌ Need 5 gems");

    u.gems -= 5;
    u.boost.multiplier = 2;
    u.boost.expires = Date.now() + 3600000;
    await u.save();

    return msg.reply("⚡ 2× Boost activated for 1 hour!");
  }

  if (cmd === "insurance") {
    if (u.gems < 3) return msg.reply("❌ Need 3 gems");

    u.gems -= 3;
    u.insurance = true;
    await u.save();

    return msg.reply("🛡️ Insurance purchased!");
  }

  /* ───── PRESTIGE ───── */
  if (cmd === "prestige") {
    if (u.cash < 300000)
      return msg.reply("❌ Need 300,000 cash");

    u.cash = 1000;
    u.bank = 0;
    u.prestige++;
    u.baseMultiplier += 0.3;

    await u.save();

    return msg.reply(`📈 PRESTIGE UP! Total: ${u.prestige}`);
  }
});

/* ───── BUTTON ───── */
client.on("interactionCreate", async i => {
  if (!i.isButton()) return;
  if (i.customId === "accept") {
    await User.findOneAndUpdate({ userId: i.user.id }, { accepted: true });
    return i.update({
      content: "✅ Rules accepted. Welcome to House of MB 💸",
      embeds: [],
      components: []
    });
  }
});

client.login(process.env.TOKEN);

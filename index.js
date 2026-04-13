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

/* ───── DB ───── */
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  userId: String,
  cash: { type: Number, default: 1000 },
  bank: { type: Number, default: 0 },

  multiplier: { type: Number, default: 1 },

  prestige: { type: Number, default: 0 },

  lastDaily: { type: Number, default: 0 },
  lastCrime: { type: Number, default: 0 },

  accepted: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

/* ───── COOLDOWN ENGINE ───── */
function cd(user, field, time) {
  const now = Date.now();
  if (now < user[field]) return Math.ceil((user[field] - now) / 1000);
  user[field] = now + time;
  return false;
}

/* ───── READY ───── */
client.once("ready", () => {
  console.log("🏠 House of MB ONLINE");
});

/* ───── HELP (CLEAN UI) ───── */
const help = new EmbedBuilder()
  .setTitle("🏠 House of MB")
  .setDescription(
    "**💰 Economy**\n`mb bal` `mb daily`\n\n" +
    "**💀 Risk**\n`mb crime`\n\n" +
    "**🎰 Gambling**\n`mb slots <bet>`\n\n" +
    "**📈 Progression**\n`mb prestige`\n"
  )
  .setColor("#ff7a18");

/* ───── MESSAGE HANDLER ───── */
client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  let u = await User.findOne({ userId: msg.author.id });
  if (!u) u = await User.create({ userId: msg.author.id });

  const mult = u.multiplier;

  /* ───── BALANCE ───── */
  if (cmd === "bal" || cmd === "balance") {
    return msg.reply(
      `💰 **Balance:** ${u.cash} MB Cash\n🏦 Bank: ${u.bank}\n📈 Prestige: ${u.prestige}`
    );
  }

  /* ───── DAILY ───── */
  if (cmd === "daily") {
    const wait = cd(u, "lastDaily", 86400000);
    if (wait) return msg.reply(`⏳ Come back in ${wait}s`);

    const reward = Math.floor(1000 * mult);
    u.cash += reward;
    await u.save();

    return msg.reply(`🎁 Daily claimed: **+${reward} MB Cash**`);
  }

  /* ───── CRIME ───── */
  if (cmd === "crime") {
    const wait = cd(u, "lastCrime", 60000);
    if (wait) return msg.reply(`⏳ Wait ${wait}s`);

    const success = Math.random() < 0.55;

    if (success) {
      const win = Math.floor(800 * mult);
      u.cash += win;
      await u.save();
      return msg.reply(`💀 Crime SUCCESS! +${win} MB Cash`);
    } else {
      const loss = Math.floor(400 * mult);
      u.cash -= loss;
      await u.save();
      return msg.reply(`🚨 You got caught! -${loss} MB Cash`);
    }
  }

  /* ───── SLOTS (GAMBLING CORE) ───── */
  if (cmd === "slots") {
    const bet = parseInt(args[0]);
    if (!bet || bet < 10 || bet > u.cash)
      return msg.reply("❌ `mb slots <amount>`");

    const icons = ["🍒", "💎", "🔥"];
    const roll = icons.map(() => icons[Math.floor(Math.random() * icons.length)]);
    const win = roll.every(v => v === roll[0]);

    const payout = win ? bet * 4 : -bet;

    u.cash += payout;
    await u.save();

    return msg.reply(
      `🎰 **[ ${roll.join(" | ")} ]**\n` +
      (win ? `🔥 JACKPOT +${payout}` : `💸 LOSS ${payout}`)
    );
  }

  /* ───── PRESTIGE ───── */
  if (cmd === "prestige") {
    if (u.cash < 100000) {
      return msg.reply("❌ You need 100,000 MB Cash to prestige!");
    }

    u.cash = 1000;
    u.bank = 0;
    u.multiplier += 0.25;
    u.prestige += 1;

    await u.save();

    return msg.reply(
      `📈 **PRESTIGE COMPLETE!**\n` +
      `🔥 Multiplier increased!\n` +
      `🏆 Total Prestige: ${u.prestige}`
    );
  }

  /* ───── HELP ───── */
  if (cmd === "help") {
    return msg.reply({ embeds: [help] });
  }
});

client.login(process.env.TOKEN);

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require("discord.js");
require("dotenv").config();

const PREFIX = "?";
const token = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ===================== DATA ===================== */

const businesses = {};

const getBiz = id => businesses[id] ||= {
  money: 1000,
  level: 1,
  locations: 0,
  employees: 0,
  lastWork: 0
};

/* ===================== EMBEDS ===================== */

const helpEmbed = () =>
  new EmbedBuilder()
    .setTitle("🍔 Fast Food Tycoon — Help")
    .setDescription("Prefix **?** and **slash commands** both work!")
    .addFields(
      { name: "?start /start", value: "Create your business" },
      { name: "?status /status", value: "View your business stats" },
      { name: "?work /work", value: "Earn money (cooldown)" },
      { name: "?open /open", value: "Open a new location" },
      { name: "?hire /hire", value: "Hire an employee" },
      { name: "?leaderboard /leaderboard", value: "Top businesses" }
    )
    .setColor(0xffc72c);

const statusEmbed = (u, b) =>
  new EmbedBuilder()
    .setTitle(`🏪 ${u.username}'s Business`)
    .addFields(
      { name: "💰 Money", value: `$${b.money}`, inline: true },
      { name: "⭐ Level", value: String(b.level), inline: true },
      { name: "📍 Locations", value: String(b.locations), inline: true },
      { name: "👥 Employees", value: String(b.employees), inline: true }
    )
    .setColor(0x00ff99);

/* ===================== GAME LOGIC ===================== */

function cmdStart(user) {
  const b = getBiz(user.id);
  return `✅ Business created! You start with **$${b.money}**.`;
}

function cmdWork(user) {
  const b = getBiz(user.id);
  const now = Date.now();
  if (now - b.lastWork < 60000)
    return "⏳ You must wait 1 minute before working again.";

  const earned = 100 + b.employees * 25;
  b.money += earned;
  b.lastWork = now;
  return `💼 You worked and earned **$${earned}**.`;
}

function cmdOpen(user) {
  const b = getBiz(user.id);
  const cost = 500 * (b.locations + 1);
  if (b.money < cost)
    return `❌ You need $${cost} to open a new location.`;

  b.money -= cost;
  b.locations++;
  b.level++;
  return `🏪 New location opened! Level up to **${b.level}**.`;
}

function cmdHire(user) {
  const b = getBiz(user.id);
  if (b.money < 300) return "❌ Hiring costs $300.";

  b.money -= 300;
  b.employees++;
  return "👔 Employee hired!";
}

/* ===================== PREFIX HANDLER ===================== */

client.on("messageCreate", async msg => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const cmd = msg.content.slice(1).toLowerCase();
  const b = getBiz(msg.author.id);

  if (cmd === "help") return msg.reply({ embeds: [helpEmbed()] });
  if (cmd === "start") return msg.reply(cmdStart(msg.author));
  if (cmd === "status") return msg.reply({ embeds: [statusEmbed(msg.author, b)] });
  if (cmd === "work") return msg.reply(cmdWork(msg.author));
  if (cmd === "open") return msg.reply(cmdOpen(msg.author));
  if (cmd === "hire") return msg.reply(cmdHire(msg.author));

  if (cmd === "leaderboard") {
    const lb = Object.entries(businesses)
      .sort((a, b) => b[1].money - a[1].money)
      .slice(0, 5)
      .map(([id, x], i) => `${i + 1}. <@${id}> — $${x.money}`)
      .join("\n");

    return msg.reply(`🏆 **Leaderboard**\n${lb || "No data yet."}`);
  }
});

/* ===================== SLASH COMMANDS ===================== */

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [
      new SlashCommandBuilder().setName("help").setDescription("Show help"),
      new SlashCommandBuilder().setName("start").setDescription("Start your business"),
      new SlashCommandBuilder().setName("status").setDescription("View business"),
      new SlashCommandBuilder().setName("work").setDescription("Work for money"),
      new SlashCommandBuilder().setName("open").setDescription("Open a new location"),
      new SlashCommandBuilder().setName("hire").setDescription("Hire employee"),
      new SlashCommandBuilder().setName("leaderboard").setDescription("View leaderboard")
    ]
  });
  console.log("✅ Bot online");
});

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const b = getBiz(i.user.id);

  if (i.commandName === "help") return i.reply({ embeds: [helpEmbed()] });
  if (i.commandName === "start") return i.reply(cmdStart(i.user));
  if (i.commandName === "status") return i.reply({ embeds: [statusEmbed(i.user, b)] });
  if (i.commandName === "work") return i.reply(cmdWork(i.user));
  if (i.commandName === "open") return i.reply(cmdOpen(i.user));
  if (i.commandName === "hire") return i.reply(cmdHire(i.user));

  if (i.commandName === "leaderboard") {
    const lb = Object.entries(businesses)
      .sort((a, b) => b[1].money - a[1].money)
      .slice(0, 5)
      .map(([id, x], i) => `${i + 1}. <@${id}> — $${x.money}`)
      .join("\n");

    return i.reply(`🏆 **Leaderboard**\n${lb || "No data yet."}`);
  }
});

client.login(token);

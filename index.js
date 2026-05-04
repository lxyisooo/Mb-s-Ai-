const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

// =============== DATA MODELS ===============
class Staff {
  constructor(name, role, speed, quality, wage) {
    this.name = name;
    this.role = role;
    this.speed = speed;
    this.quality = quality;
    this.wage = wage;
  }
}

class Restaurant {
  constructor() {
    this.level = 1;
    this.balance = 500;
    this.supply = 100;
    this.base_demand = 10;
    this.staff = [];
    this.last_tick = new Date();
    this.reputation = 50;
  }
}

const players = {};

// =============== HELPERS ===============
function getRestaurant(userId) {
  if (!players[userId]) {
    players[userId] = new Restaurant();
  }
  return players[userId];
}

function marketMultiplier() {
  return parseFloat((Math.random() * 0.4 + 0.8).toFixed(2));
}

function staffEfficiency(res) {
  if (res.staff.length === 0) {
    return [1.0, 1.0];
  }
  const speedSum = res.staff.reduce((sum, s) => sum + s.speed, 0);
  const qualitySum = res.staff.reduce((sum, s) => sum + s.quality, 0);
  const speed = Math.max(0.5, speedSum / (10 * res.staff.length));
  const quality = Math.max(0.5, qualitySum / (10 * res.staff.length));
  return [speed, quality];
}

function generateCustomer(res) {
  const names = ["Alex", "Taylor", "Jordan", "Sam", "Casey", "Morgan", "Jamie", "Riley", "Chris", "Drew", "Parker", "Skyler", "Quinn", "Avery", "Harper", "Reese"];
  const personalities = ["chill", "in a hurry", "picky", "foodie", "budget-conscious", "generous", "grumpy"];

  return {
    name: names[Math.floor(Math.random() * names.length)],
    hunger: Math.floor(Math.random() * 60) + 40,
    patience: Math.floor(Math.random() * 90) + 30,
    tip_chance: Math.floor(Math.random() * 60) + 20,
    spend_min: 5 * res.level,
    spend_max: 10 * res.level + Math.floor(res.reputation / 5),
    personality: personalities[Math.floor(Math.random() * personalities.length)],
  };
}

function simulateTick(res) {
  const now = new Date();
  const elapsed = (now - res.last_tick) / 1000;
  
  if (elapsed < 30) return;
  
  const ticks = Math.floor(elapsed / 30);
  res.last_tick = now;

  for (let t = 0; t < ticks; t++) {
    // Pay wages
    const wages = res.staff.reduce((sum, s) => sum + s.wage, 0);
    res.balance -= wages;

    const [speedEff, qualityEff] = staffEfficiency(res);
    const mm = marketMultiplier();
    const effectiveDemand = Math.floor(res.base_demand * (0.8 + qualityEff) * mm);
    let customersServed = 0;

    for (let i = 0; i < effectiveDemand; i++) {
      if (res.supply <= 0) break;

      const cust = generateCustomer(res);
      const serveChance = Math.min(1.0, (cust.patience / 60) * speedEff);

      if (Math.random() > serveChance) {
        res.reputation = Math.max(0, res.reputation - 1);
        continue;
      }

      const spent = Math.floor(Math.random() * (cust.spend_max - cust.spend_min + 1)) + cust.spend_min;
      const cost = Math.floor(spent * (Math.random() * 0.15 + 0.35));
      const profit = spent - cost;

      res.balance += profit;
      res.supply -= 1;
      customersServed += 1;

      // Tips
      const tipMult = 1 + (qualityEff - 1) * 0.5;
      if (Math.random() * 100 < cust.tip_chance * tipMult) {
        const tip = Math.floor(Math.random() * 5 + 1) * res.level;
        res.balance += tip;
      }
    }

    if (customersServed > 0) {
      res.reputation = Math.min(100, res.reputation + 1);
    }
  }
}

function buildStatusEmbed(user, res) {
  const [speedEff, qualityEff] = staffEfficiency(res);

  const staffText = res.staff.length === 0
    ? "No staff hired yet."
    : res.staff.map(s => `• ${s.name} (${s.role}) – SPD ${s.speed}, QLT ${s.quality}, Wage $${s.wage}`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`🍔 ${user.username}'s Fast Food Empire`)
    .setColor(0xFFD700)
    .addFields(
      { name: "Level", value: String(res.level), inline: true },
      { name: "Balance", value: `$${res.balance}`, inline: true },
      { name: "Supply", value: String(res.supply), inline: true },
      { name: "Base demand", value: String(res.base_demand), inline: true },
      { name: "Reputation", value: `${res.reputation}/100`, inline: true },
      {
        name: "Staff Efficiency",
        value: `Speed: x${speedEff.toFixed(2)}\nQuality: x${qualityEff.toFixed(2)}`,
        inline: true,
      },
      { name: "Staff", value: staffText, inline: false }
    );

  return embed;
}

function buildHelpEmbed(prefix) {
  const embed = new EmbedBuilder()
    .setTitle("🍟 Fast Food Tycoon Help")
    .setDescription("Manage your fast food empire with both slash commands and prefix commands.")
    .setColor(0xFFA500)
    .addFields(
      {
        name: "Core Commands",
        value: `Slash / Prefix\n• \`/start\` / \`${prefix}start\` – create or view your empire\n• \`/status\` / \`${prefix}status\` – detailed stats\n• \`/buy_supply <amount>\` / \`${prefix}buy_supply <amount>\` – buy ingredients\n• \`/upgrade\` / \`${prefix}upgrade\` – upgrade restaurant\n• \`/hire_staff <role>\` / \`${prefix}hire_staff <role>\` – hire staff\n• \`/customers\` / \`${prefix}customers\` – preview NPC customers`,
        inline: false,
      },
      {
        name: "Staff Roles",
        value: "cashier – fast service, average food\ncook – slower service, better quality & tips\nmanager – balanced, boosts both slightly",
        inline: false,
      },
      {
        name: "Economy",
        value: "• Wages are paid automatically over time\n• Market prices & demand fluctuate\n• Reputation affects how much customers spend",
        inline: false,
      }
    )
    .setFooter({ text: "Tip: Keep enough supply and balance to survive bad markets!" });

  return embed;
}

// =============== SHARED LOGIC ===============
async function cmdStart(user, respond) {
  const res = getRestaurant(user.id);
  simulateTick(res);
  const embed = buildStatusEmbed(user, res);
  embed.setDescription("Welcome to Fast Food Tycoon!");
  await respond({ embeds: [embed] });
}

async function cmdStatus(user, respond) {
  const res = getRestaurant(user.id);
  simulateTick(res);
  const embed = buildStatusEmbed(user, res);
  await respond({ embeds: [embed] });
}

async function cmdBuySupply(user, amount, respond) {
  if (amount <= 0) {
    await respond({ content: "Amount must be positive." });
    return;
  }

  const res = getRestaurant(user.id);
  simulateTick(res);

  const basePrice = 5;
  const mm = marketMultiplier();
  const costPer = Math.floor(basePrice * mm);
  const totalCost = costPer * amount;

  if (res.balance < totalCost) {
    await respond({ content: `Not enough balance. Need $${totalCost}.` });
    return;
  }

  res.balance -= totalCost;
  res.supply += amount;

  const embed = new EmbedBuilder()
    .setTitle("📦 Supply Purchased")
    .setDescription(`You bought ${amount} units of supply.`)
    .setColor(0x00AA00)
    .addFields(
      { name: "Price per unit", value: `$${costPer}`, inline: true },
      { name: "Total cost", value: `$${totalCost}`, inline: true },
      { name: "New balance", value: `$${res.balance}`, inline: true },
      { name: "Total supply", value: String(res.supply), inline: true }
    );

  await respond({ embeds: [embed] });
}

async function cmdUpgrade(user, respond) {
  const res = getRestaurant(user.id);
  simulateTick(res);

  const cost = 300 * res.level;
  if (res.balance < cost) {
    await respond({ content: `You need $${cost} to upgrade (current balance: $${res.balance}).` });
    return;
  }

  res.balance -= cost;
  res.level += 1;
  res.base_demand += 5;

  const embed = new EmbedBuilder()
    .setTitle("🏗️ Restaurant Upgraded!")
    .setDescription(`Your restaurant is now Level ${res.level}.`)
    .setColor(0x0000FF)
    .addFields(
      { name: "New base demand", value: String(res.base_demand), inline: true },
      { name: "Remaining balance", value: `$${res.balance}`, inline: true }
    );

  await respond({ embeds: [embed] });
}

async function cmdHireStaff(user, role, respond) {
  role = role.toLowerCase();
  if (!["cashier", "cook", "manager"].includes(role)) {
    await respond({ content: "Role must be `cashier`, `cook` or `manager`." });
    return;
  }

  const res = getRestaurant(user.id);
  simulateTick(res);

  let speed, quality, wage;

  if (role === "cashier") {
    speed = Math.floor(Math.random() * 5) + 6;
    quality = Math.floor(Math.random() * 5) + 4;
    wage = Math.floor(Math.random() * 11) + 10;
  } else if (role === "cook") {
    speed = Math.floor(Math.random() * 5) + 4;
    quality = Math.floor(Math.random() * 4) + 7;
    wage = Math.floor(Math.random() * 11) + 15;
  } else { // manager
    speed = Math.floor(Math.random() * 5) + 5;
    quality = Math.floor(Math.random() * 5) + 5;
    wage = Math.floor(Math.random() * 16) + 20;
  }

  const costToHire = wage * 10;
  if (res.balance < costToHire) {
    await respond({ content: `Not enough balance. Need $${costToHire} to hire.` });
    return;
  }

  res.balance -= costToHire;
  const staffNames = ["Chris", "Drew", "Parker", "Skyler", "Quinn", "Avery", "Harper", "Reese"];
  const name = staffNames[Math.floor(Math.random() * staffNames.length)];

  const newStaff = new Staff(name, role, speed, quality, wage);
  res.staff.push(newStaff);

  const embed = new EmbedBuilder()
    .setTitle("👔 Staff Hired")
    .setDescription(`You hired ${name} as a ${role}.`)
    .setColor(0xAA00AA)
    .addFields(
      { name: "Speed", value: String(speed), inline: true },
      { name: "Quality", value: String(quality), inline: true },
      { name: "Wage / tick", value: `$${wage}`, inline: true },
      { name: "Hire cost", value: `$${costToHire}`, inline: true },
      { name: "New balance", value: `$${res.balance}`, inline: true }
    );

  await respond({ embeds: [embed] });
}

async function cmdCustomers(user, respond) {
  const res = getRestaurant(user.id);
  simulateTick(res);

  const customers = Array.from({ length: 5 }, () => generateCustomer(res));
  const orders = ["Burger Meal", "Fries & Shake", "Family Bucket", "Veggie Combo", "Deluxe Box"];
  const moods = ["looks happy", "seems annoyed", "is very hungry", "is just browsing", "is already complaining"];

  let desc = "";
  for (const c of customers) {
    const order = orders[Math.floor(Math.random() * orders.length)];
    const mood = moods[Math.floor(Math.random() * moods.length)];
    desc += `${c.name} – Personality: ${c.personality}, ${mood}\n`;
    desc += `Hunger: ${c.hunger}/100 • Patience: ${c.patience}s\n`;
    desc += `Order: ${order} • Spend: $${c.spend_min}-$${c.spend_max} • Tip chance: ${c.tip_chance}%\n\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle("👥 Incoming Customers")
    .setDescription(desc)
    .setColor(0x008080);

  await respond({ embeds: [embed] });
}

// =============== EVENTS ===============
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show Fast Food Tycoon help."),
    new SlashCommandBuilder()
      .setName("start")
      .setDescription("Start or view your fast food empire."),
    new SlashCommandBuilder()
      .setName("status")
      .setDescription("View your empire status."),
    new SlashCommandBuilder()
      .setName("buy_supply")
      .setDescription("Buy food supplies.")
      .addIntegerOption(option => option.setName("amount").setDescription("Units of supply to buy.").setRequired(true)),
    new SlashCommandBuilder()
      .setName("upgrade")
      .setDescription("Upgrade your restaurant."),
    new SlashCommandBuilder()
      .setName("hire_staff")
      .setDescription("Hire staff (cashier, cook, manager).")
      .addStringOption(option => option.setName("role").setDescription("cashier, cook, or manager").setRequired(true)),
    new SlashCommandBuilder()
      .setName("customers")
      .setDescription("Preview NPC customers."),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  const respond = (options) => interaction.reply(options);

  try {
    if (commandName === "help") {
      const embed = buildHelpEmbed("?");
      await respond({ embeds: [embed], ephemeral: true });
    } else if (commandName === "start") {
      await cmdStart(interaction.user, respond);
    } else if (commandName === "status") {
      await cmdStatus(interaction.user, respond);
    } else if (commandName === "buy_supply") {
      const amount = interaction.options.getInteger("amount");
      await cmdBuySupply(interaction.user, amount, respond);
    } else if (commandName === "upgrade") {
      await cmdUpgrade(interaction.user, respond);
    } else if (commandName === "hire_staff") {
      const role = interaction.options.getString("role");
      await cmdHireStaff(interaction.user, role, respond);
    } else if (commandName === "customers") {
      await cmdCustomers(interaction.user, respond);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    await respond({ content: "❌ An error occurred!", ephemeral: true });
  }
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("?") || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const respond = (options) => message.reply(options);

  try {
    if (command === "help") {
      const embed = buildHelpEmbed("?");
      await respond({ embeds: [embed] });
    } else if (command === "start") {
      await cmdStart(message.author, respond);
    } else if (command === "status") {
      await cmdStatus(message.author, respond);
    } else if (command === "buy_supply") {
      const amount = parseInt(args[0]);
      if (isNaN(amount)) {
        await respond({ content: "Please provide a valid number." });
        return;
      }
      await cmdBuySupply(message.author, amount, respond);
    } else if (command === "upgrade") {
      await cmdUpgrade(message.author, respond);
    } else if (command === "hire_staff") {
      const role = args[0];
      if (!role) {
        await respond({ content: "Please specify a role: cashier, cook, or manager." });
        return;
      }
      await cmdHireStaff(message.author, role, respond);
    } else if (command === "customers") {
      await cmdCustomers(message.author, respond);
    }
  } catch (error) {
    console.error("Error handling prefix command:", error);
    await respond({ content: "❌ An error occurred!" });
  }
});

client.login(token);
const discordToken = process.env.DISCORD_TOKEN;
// Update all references to use discordToken instead of token
const botToken = process.env.DISCORD_TOKEN;  // Different name

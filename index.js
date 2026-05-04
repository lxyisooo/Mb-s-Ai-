const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const PREFIX = '?';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

// =============== REAL RESTAURANT BRANDS ===============
const BRANDS = {
  mcdonalds: {
    name: "🍟 McDonald's",
    emoji: '🍟',
    color: 0xFFC72C,
    description: 'The world\'s largest fast food chain',
    menu: { 'Big Mac': 5.99, 'Quarter Pounder': 4.99, 'Chicken McNuggets': 4.49, 'French Fries': 2.49, 'McFlurry': 3.49 },
    base_salary: 12
  },
  popeyes: {
    name: "🍗 Popeyes Louisiana Kitchen",
    emoji: '🍗',
    color: 0xD71E28,
    description: 'Famous for authentic Louisiana chicken',
    menu: { 'Spicy Chicken Sandwich': 3.99, 'Cajun Fries': 2.99, 'Fried Shrimp': 4.99, 'Mac & Cheese': 2.49, 'Cajun Rice': 2.99 },
    base_salary: 13
  },
  wendys: {
    name: "🌶️ Wendy's",
    emoji: '🌶️',
    color: 0xD62300,
    description: 'Fresh, never frozen beef burgers',
    menu: { 'Dave\'s Single': 3.99, 'Dave\'s Double': 5.99, 'Spicy Chicken Sandwich': 4.49, 'Frosty': 2.99, 'Natural Cut Fries': 2.49 },
    base_salary: 12
  },
  kfc: {
    name: "🍗 KFC",
    emoji: '🍗',
    color: 0xFF0000,
    description: 'Finger-lickin\' good fried chicken',
    menu: { 'Original Recipe Chicken': 7.99, 'Extra Crispy': 8.49, 'Popcorn Chicken': 3.99, 'Mac & Cheese': 2.49, 'Mashed Potatoes': 1.99 },
    base_salary: 14
  },
  chipotle: {
    name: "🌯 Chipotle Mexican Grill",
    emoji: '🌯',
    color: 0xE4002B,
    description: 'Customizable bowls and burritos',
    menu: { 'Chicken Bowl': 8.95, 'Steak Burrito': 9.25, 'Carnitas Bowl': 10.95, 'Barbacoa Burrito': 9.75, 'Sofritas Bowl': 9.75 },
    base_salary: 13
  },
  subway: {
    name: "🥪 Subway",
    emoji: '🥪',
    color: 0x009E3A,
    description: 'Eat fresh, build your own sub',
    menu: { 'Footlong Italian': 7.99, 'Footlong Steak & Cheese': 8.99, '6\" Veggie Delite': 5.99, 'Meatball Marinara': 6.99, 'Cookies': 1.99 },
    base_salary: 11
  },
  tacobell: {
    name: "🌮 Taco Bell",
    emoji: '🌮',
    color: 0x702C7F,
    description: 'Think outside the bun',
    menu: { 'Crunchwrap Supreme': 4.99, 'Burrito Supreme': 4.99, 'Crunchy Tacos': 1.99, 'Baja Blast': 2.49, 'Cheesy Bean and Rice Burrito': 1.49 },
    base_salary: 10
  },
  innout: {
    name: "🍔 In-N-Out Burger",
    emoji: '🍔',
    color: 0xFFC600,
    description: 'Quality, Fresh, Fast West Coast favorite',
    menu: { 'Double-Double': 5.45, 'Hamburger': 3.45, 'Cheeseburger': 4.15, 'French Fries': 1.65, 'Milkshake': 3.45 },
    base_salary: 14
  }
};

class Employee {
  constructor(name, role) {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.role = role;
    this.level = 1;
    this.salary = role === 'cashier' ? 12 : role === 'cook' ? 16 : 20;
    this.morale = 100;
    this.performance = 0.8;
  }
}

class Location {
  constructor(name, city, brand_key) {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.city = city;
    this.brand_key = brand_key;
    this.brand = BRANDS[brand_key];
    this.level = 1;
    this.balance = 5000;
    this.revenue_today = 0;
    this.reputation = 75;
    this.employees = [];
    this.inventory = {};
    this.last_tick = new Date();
    this.customer_count = 0;
    this.avg_satisfaction = 80;
  }

  addRevenue(amount) {
    this.balance += amount;
    this.revenue_today += amount;
  }

  payEmployees() {
    let total = 0;
    this.employees.forEach(emp => {
      this.balance -= emp.salary;
      total += emp.salary;
    });
    return total;
  }
}

class Business {
  constructor(userId) {
    this.user_id = userId;
    this.business_name = "My Empire";
    this.locations = [];
    this.total_balance = 15000;
    this.prestige = 0;
    this.level = 1;
    this.setup_complete = false;
    this.achievements = [];
  }

  getTotalBalance() {
    return this.total_balance + this.locations.reduce((sum, loc) => sum + loc.balance, 0);
  }

  getTotalRevenue() {
    return this.locations.reduce((sum, loc) => sum + loc.revenue_today, 0);
  }

  getTotalEmployees() {
    return this.locations.reduce((sum, loc) => sum + loc.employees.length, 0);
  }
}

const NAMES = {
  first: ["Marcus", "Jessica", "David", "Sarah", "James", "Emma", "Michael", "Olivia", "Chris", "Sophia"],
  last: ["Johnson", "Smith", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
};

const CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Miami", "Boston", "Seattle", "Austin", "Denver"];

const businesses = {};

function getOrCreateBusiness(userId) {
  if (!businesses[userId]) {
    businesses[userId] = new Business(userId);
  }
  return businesses[userId];
}

function generateEmployeeName() {
  return `${NAMES.first[Math.floor(Math.random() * NAMES.first.length)]} ${NAMES.last[Math.floor(Math.random() * NAMES.last.length)]}`;
}

function simulateLocationTick(location) {
  const now = new Date();
  const elapsed = (now - location.last_tick) / 1000;
  if (elapsed < 30) return;
  location.last_tick = now;

  location.balance -= location.payEmployees();

  const hour = now.getHours();
  if (hour < 6 || hour > 23) return;

  const avgPerformance = location.employees.length ? location.employees.reduce((sum, e) => sum + e.performance, 0) / location.employees.length : 0.5;
  const customers = Math.floor((location.level * location.reputation / 100) * (8 + avgPerformance * 4));

  for (let i = 0; i < customers; i++) {
    const menu = Object.entries(location.brand.menu);
    const [item, price] = menu[Math.floor(Math.random() * menu.length)];
    const cost = price * 0.35;
    const profit = price - cost;

    location.addRevenue(profit);
    location.customer_count++;

    if (Math.random() > 0.3) {
      location.reputation = Math.min(100, location.reputation + 0.5);
      location.avg_satisfaction = Math.min(100, location.avg_satisfaction + 1);
    }
  }
}

function buildProgressBar(current, max, length = 15) {
  const percentage = current / max;
  const filled = Math.floor(percentage * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function buildBusinessEmbed(user, business) {
  const balance = business.getTotalBalance();
  const revenue = business.getTotalRevenue();
  const employees = business.getTotalEmployees();

  return new EmbedBuilder()
    .setTitle(`${business.locations.length > 0 ? business.locations[0].brand.emoji : '🏪'} ${business.business_name}`)
    .setColor(business.locations.length > 0 ? business.locations[0].brand.color : 0xFF6B35)
    .setThumbnail('https://media.discordapp.net/attachments/1194280900903579649/1299564048898510960/image-removebg-preview.png?ex=671bf4c0&is=671aa340&size=large')
    .addFields(
      { name: "💰 Balance", value: `$${balance.toLocaleString()}`, inline: true },
      { name: "📈 Today's Revenue", value: `$${revenue.toLocaleString()}`, inline: true },
      { name: "🏆 Level", value: String(business.level), inline: true },
      { name: "⭐ Prestige", value: String(business.prestige), inline: true },
      { name: "🏪 Locations", value: String(business.locations.length), inline: true },
      { name: "👥 Employees", value: String(employees), inline: true },
      { name: "📍 Locations", value: business.locations.length === 0 ? "None yet" : business.locations.map(l => `**${l.name}** (${l.city}) - Lvl ${l.level} - $${l.balance}`).join('\n'), inline: false }
    )
    .setFooter({ text: "🚀 Keep building your empire!" });
}

function buildLocationEmbed(location) {
  const employees = location.employees.length === 0 ? "No employees" : location.employees.map(e => `• ${e.name} (${e.role}) Lvl${e.level}`).join('\n');
  
  return new EmbedBuilder()
    .setTitle(`${location.brand.emoji} ${location.name} - ${location.city}`)
    .setColor(location.brand.color)
    .addFields(
      { name: "Brand", value: location.brand.name, inline: true },
      { name: "Level", value: String(location.level), inline: true },
      { name: "💰 Balance", value: `$${location.balance.toLocaleString()}`, inline: true },
      { name: "📊 Today Revenue", value: `$${location.revenue_today.toLocaleString()}`, inline: true },
      { name: "⭐ Reputation", value: `${buildProgressBar(location.reputation, 100)} ${location.reputation}/100`, inline: true },
      { name: "😊 Satisfaction", value: `${location.avg_satisfaction.toFixed(0)}%`, inline: true },
      { name: "👥 Customers Today", value: String(location.customer_count), inline: true },
      { name: "Staff", value: employees, inline: false }
    )
    .setFooter({ text: `${location.brand.description}` });
}

async function cmdStart(user, respond) {
  const business = getOrCreateBusiness(user.id);

  if (business.setup_complete) {
    const embed = buildBusinessEmbed(user, business);
    return respond({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setTitle("🎮 Welcome to Fast Food Tycoon!")
    .setDescription("Choose a real restaurant brand to start your empire or create your own!")
    .setColor(0xFF6B35)
    .setThumbnail('https://media.discordapp.net/attachments/1194280900903579649/1299564048898510960/image-removebg-preview.png?ex=671bf4c0&is=671aa340&size=large');

  const select = new StringSelectMenuBuilder()
    .setCustomId('select_brand')
    .setPlaceholder('🔻 Choose your restaurant')
    .addOptions([
      { label: '🍟 McDonald\'s', value: 'mcdonalds', emoji: '🍟' },
      { label: '🍗 Popeyes', value: 'popeyes', emoji: '🍗' },
      { label: '🌶️ Wendy\'s', value: 'wendys', emoji: '🌶️' },
      { label: '🍗 KFC', value: 'kfc', emoji: '🍗' },
      { label: '🌯 Chipotle', value: 'chipotle', emoji: '🌯' },
      { label: '🥪 Subway', value: 'subway', emoji: '🥪' },
      { label: '🌮 Taco Bell', value: 'tacobell', emoji: '🌮' },
      { label: '🍔 In-N-Out', value: 'innout', emoji: '🍔' },
      { label: '✏️ Custom', value: 'custom', emoji: '✏️' }
    ]);

  const row = new ActionRowBuilder().addComponents(select);
  await respond({ embeds: [embed], components: [row] });
}

async function cmdLocations(user, respond) {
  const business = getOrCreateBusiness(user.id);

  if (business.locations.length === 0) {
    return respond({ content: "❌ No locations yet!" });
  }

  business.locations.forEach(loc => simulateLocationTick(loc));

  const embeds = business.locations.map(loc => buildLocationEmbed(loc));

  const select = new StringSelectMenuBuilder()
    .setCustomId('select_location')
    .setPlaceholder('📍 Select a location')
    .addOptions(business.locations.map(loc => ({
      label: `${loc.name}`,
      value: loc.id,
      description: `${loc.city} | Lvl ${loc.level} | $${loc.balance}`
    })));

  const row = new ActionRowBuilder().addComponents(select);
  await respond({ embeds, components: [row] });
}

async function cmdHire(user, locationId, role, respond) {
  const business = getOrCreateBusiness(user.id);
  const location = business.locations.find(l => l.id === locationId);

  if (!location) return respond({ content: "❌ Location not found" });

  const employee = new Employee(generateEmployeeName(), role);
  const cost = employee.salary * 15;

  if (location.balance < cost) {
    return respond({ content: `❌ Need $${cost}, you have $${location.balance}` });
  }

  location.balance -= cost;
  location.employees.push(employee);

  const embed = new EmbedBuilder()
    .setTitle("✅ Employee Hired!")
    .setColor(0x00FF00)
    .addFields(
      { name: "Name", value: employee.name, inline: true },
      { name: "Role", value: employee.role, inline: true },
      { name: "Salary", value: `$${employee.salary}`, inline: true },
      { name: "Cost", value: `$${cost}`, inline: false },
      { name: "New Balance", value: `$${location.balance}`, inline: false }
    );

  await respond({ embeds: [embed] });
}

async function cmdSupplies(user, locationId, respond) {
  const business = getOrCreateBusiness(user.id);
  const location = business.locations.find(l => l.id === locationId);

  if (!location) return respond({ content: "❌ Location not found" });

  const cost = 800;
  if (location.balance < cost) {
    return respond({ content: `❌ Need $${cost}` });
  }

  location.balance -= cost;

  const embed = new EmbedBuilder()
    .setTitle("📦 Supplies Ordered!")
    .setColor(0x0099FF)
    .addFields(
      { name: "Cost", value: `$${cost}`, inline: true },
      { name: "New Balance", value: `$${location.balance}`, inline: true }
    );

  await respond({ embeds: [embed] });
}

async function cmdUpgrade(user, locationId, respond) {
  const business = getOrCreateBusiness(user.id);
  const location = business.locations.find(l => l.id === locationId);

  if (!location) return respond({ content: "❌ Location not found" });

  const cost = 2000 * location.level;
  if (location.balance < cost) {
    return respond({ content: `❌ Need $${cost}` });
  }

  location.balance -= cost;
  location.level += 1;
  business.prestige += 15;

  const embed = new EmbedBuilder()
    .setTitle("🏗️ Location Upgraded!")
    .setColor(0xFFAA00)
    .addFields(
      { name: "New Level", value: String(location.level), inline: true },
      { name: "Cost", value: `$${cost}`, inline: true },
      { name: "New Balance", value: `$${location.balance}`, inline: true }
    );

  await respond({ embeds: [embed] });
}

async function cmdExpand(user, respond) {
  const business = getOrCreateBusiness(user.id);
  const cost = 3000 * business.locations.length;

  if (business.getTotalBalance() < cost) {
    return respond({ content: `❌ Need $${cost}` });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('expand_brand')
    .setPlaceholder('🔻 Pick a brand for new location')
    .addOptions(Object.entries(BRANDS).map(([key, brand]) => ({
      label: brand.name,
      value: key,
      emoji: brand.emoji
    })));

  const row = new ActionRowBuilder().addComponents(select);
  await respond({ components: [row] });
}

async function cmdLeaderboard(respond) {
  const leaderboard = Object.entries(businesses)
    .map(([userId, business]) => ({
      name: business.business_name,
      prestige: business.prestige,
      balance: business.getTotalBalance(),
      locations: business.locations.length
    }))
    .sort((a, b) => b.prestige - a.prestige || b.balance - a.balance)
    .slice(0, 10);

  if (leaderboard.length === 0) return respond({ content: "No players yet!" });

  const embed = new EmbedBuilder()
    .setTitle("🏆 Leaderboard")
    .setColor(0xFFD700)
    .setDescription(leaderboard.map((p, i) => `${i + 1}. **${p.name}** | Prestige ${p.prestige} | $${p.balance.toLocaleString()} | ${p.locations} locations`).join('\n'))
    .setFooter({ text: "Keep grinding!" });

  await respond({ embeds: [embed] });
}

// =============== EVENTS ===============

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("start").setDescription("🚀 Start your empire"),
    new SlashCommandBuilder().setName("status").setDescription("📊 View your business"),
    new SlashCommandBuilder().setName("locations").setDescription("📍 Manage locations"),
    new SlashCommandBuilder().setName("leaderboard").setDescription("🏆 Global rankings"),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Commands registered");
  } catch (error) {
    console.error("❌ Error:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      if (commandName === "start") await cmdStart(interaction.user, (o) => interaction.reply(o));
      else if (commandName === "status") {
        const business = getOrCreateBusiness(interaction.user.id);
        const embed = buildBusinessEmbed(interaction.user, business);
        await interaction.reply({ embeds: [embed] });
      }
      else if (commandName === "locations") await cmdLocations(interaction.user, (o) => interaction.reply(o));
      else if (commandName === "leaderboard") await cmdLeaderboard((o) => interaction.reply(o));
    } else if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;

      if (customId === "select_brand") {
        const business = getOrCreateBusiness(interaction.user.id);
        const brandKey = values[0];

        if (brandKey === "custom") {
          const modal = new ModalBuilder()
            .setCustomId('custom_business_modal')
            .setTitle('Create Your Restaurant');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('custom_name')
                .setLabel('Restaurant Name')
                .setStyle(TextInputStyle.Short)
            )
          );

          await interaction.showModal(modal);
        } else {
          const brand = BRANDS[brandKey];
          const city = CITIES[Math.floor(Math.random() * CITIES.length)];
          const location = new Location(brand.name, city, brandKey);
          
          business.business_name = brand.name;
          business.locations.push(location);
          business.setup_complete = true;

          const embed = new EmbedBuilder()
            .setTitle(`✅ Welcome to ${brand.name}!`)
            .setColor(brand.color)
            .addFields(
              { name: "Location", value: `${city}`, inline: true },
              { name: "Starting Balance", value: "$15,000", inline: true },
              { name: "Description", value: brand.description, inline: false },
              { name: "Next Steps", value: "`?hire cashier` - Hire staff\n`?supplies` - Stock up\n`?expand` - New location", inline: false }
            );

          await interaction.reply({ embeds: [embed] });
        }
      } else if (customId === "select_location") {
        const business = getOrCreateBusiness(interaction.user.id);
        const location = business.locations.find(l => l.id === values[0]);

        if (location) {
          const embed = buildLocationEmbed(location);

          const buttons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder().setCustomId(`hire_${location.id}`).setLabel('👔 Hire').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`supplies_${location.id}`).setLabel('📦 Supplies').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`upgrade_${location.id}`).setLabel('🏗️ Upgrade').setStyle(ButtonStyle.Secondary)
            );

          await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
        }
      } else if (customId === "expand_brand") {
        const business = getOrCreateBusiness(interaction.user.id);
        const brandKey = values[0];
        const brand = BRANDS[brandKey];
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const cost = 3000 * business.locations.length;

        business.total_balance -= cost;
        business.locations.push(new Location(`${brand.name} #${business.locations.length}`, city, brandKey));
        business.prestige += 20;

        const embed = new EmbedBuilder()
          .setTitle(`🎉 New ${brand.name} Opened!`)
          .setColor(brand.color)
          .addFields(
            { name: "City", value: city, inline: true },
            { name: "Cost", value: `$${cost}`, inline: true }
          );

        await interaction.reply({ embeds: [embed] });
      }
 

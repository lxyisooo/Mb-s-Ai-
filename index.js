const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const PREFIX = '?';

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.DirectMessages
  ] 
});

// =============== ADVANCED DATA MODELS ===============

class Achievement {
  constructor(name, description, icon) {
    this.name = name;
    this.description = description;
    this.icon = icon;
    this.unlocked_at = new Date();
  }
}

class Investment {
  constructor(type, amount, interest_rate) {
    this.id = Math.random().toString(36).substring(7);
    this.type = type; // 'stocks', 'bonds', 'property'
    this.amount = amount;
    this.interest_rate = interest_rate;
    this.created_date = new Date();
    this.returns = 0;
  }

  calculateReturns() {
    const days = (new Date() - this.created_date) / (1000 * 60 * 60 * 24);
    this.returns = Math.floor(this.amount * (this.interest_rate / 100) * (days / 365));
    return this.returns;
  }
}

class Employee {
  constructor(name, role, experience = 1) {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.role = role;
    this.experience = experience;
    this.level = 1;
    this.salary = this.getSalaryByRole(role);
    this.morale = 100;
    this.hired_date = new Date();
    this.performance = Math.random() * 0.3 + 0.7;
    this.total_revenue_generated = 0;
    this.skill_points = 0;
    
    if (role === 'cashier') {
      this.speed = 8;
      this.quality = 6;
      this.customer_satisfaction = 7;
    } else if (role === 'cook') {
      this.speed = 5;
      this.quality = 9;
      this.customer_satisfaction = 8;
    } else if (role === 'manager') {
      this.speed = 7;
      this.quality = 8;
      this.customer_satisfaction = 9;
    } else if (role === 'delivery_driver') {
      this.speed = 9;
      this.quality = 6;
      this.customer_satisfaction = 7;
    } else if (role === 'marketing_specialist') {
      this.speed = 7;
      this.quality = 8;
      this.customer_satisfaction = 9;
    } else if (role === 'chef') {
      this.speed = 4;
      this.quality = 10;
      this.customer_satisfaction = 10;
    }
  }

  getSalaryByRole(role) {
    const salaries = {
      'cashier': 15,
      'cook': 25,
      'manager': 45,
      'delivery_driver': 20,
      'marketing_specialist': 30,
      'chef': 60
    };
    return salaries[role] || 15;
  }

  giveBenefit() {
    this.morale = Math.min(100, this.morale + 25);
    this.performance = Math.min(1.0, this.performance + 0.15);
  }

  reduceWellbeing() {
    this.morale = Math.max(0, this.morale - 8);
    if (this.morale < 40) this.performance *= 0.8;
  }

  levelUp() {
    this.level += 1;
    this.salary = Math.floor(this.salary * 1.15);
    this.performance = Math.min(1.0, this.performance + 0.1);
    this.speed = Math.min(10, this.speed + 1);
    this.quality = Math.min(10, this.quality + 1);
  }
}

class MenuItem {
  constructor(name, cost, selling_price, category = 'general') {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.cost = cost;
    this.selling_price = selling_price;
    this.category = category;
    this.popularity = 50;
    this.orders_sold = 0;
  }

  profit() {
    return this.selling_price - this.cost;
  }
}

class Shop {
  constructor() {
    this.id = Math.random().toString(36).substring(7);
    this.items = {
      'Upgrade Speed': { cost: 500, effect: 'speed', value: 0.1 },
      'Upgrade Quality': { cost: 500, effect: 'quality', value: 0.1 },
      'Staff Training': { cost: 300, effect: 'morale', value: 20 },
      'Marketing Campaign': { cost: 1000, effect: 'reputation', value: 10 },
      'Premium Supplies': { cost: 800, effect: 'ingredient_quality', value: 0.2 },
      'Loyalty Program': { cost: 2000, effect: 'customer_retention', value: 0.15 },
      'Premium Kitchen Equipment': { cost: 3000, effect: 'cooking_speed', value: 0.25 },
      'Digital Ordering System': { cost: 1500, effect: 'order_efficiency', value: 0.2 }
    };
  }

  getItemsList() {
    return Object.entries(this.items).map(([name, data]) => ({
      label: `${name} - $${data.cost}`,
      value: name,
      description: `Effect: +${data.value * 100}${data.effect === 'morale' ? '%' : 'x'}`
    }));
  }
}

class Location {
  constructor(name, city, type = 'franchise') {
    this.id = Math.random().toString(36).substring(7);
    this.name = name;
    this.city = city;
    this.type = type;
    this.level = 1;
    this.balance = 5000;
    this.revenue_today = 0;
    this.revenue_all_time = 0;
    this.reputation = 75;
    this.employees = [];
    this.inventory = {};
    this.menu_items = this.generateMenu();
    this.last_tick = new Date();
    this.operating_hours = { open: 8, close: 22 };
    this.upgrades = [];
    this.customer_count_today = 0;
    this.avg_satisfaction = 80;
    this.speed_multiplier = 1.0;
    this.quality_multiplier = 1.0;
    this.is_open = true;
    this.events = [];
  }

  generateMenu() {
    const items = [
      new MenuItem('Classic Burger', 3, 9, 'burgers'),
      new MenuItem('Crispy Chicken', 2.5, 8, 'chicken'),
      new MenuItem('Fries', 1, 4, 'sides'),
      new MenuItem('Soft Drink', 0.5, 2.5, 'drinks'),
      new MenuItem('Milkshake', 1.5, 6, 'drinks'),
      new MenuItem('Premium Steak Burger', 5, 15, 'burgers'),
      new MenuItem('Veggie Wrap', 2, 7, 'wraps'),
      new MenuItem('Family Meal', 8, 25, 'combos'),
      new MenuItem('Grilled Chicken Sandwich', 3.5, 10, 'chicken'),
      new MenuItem('Ice Cream', 1, 4, 'desserts')
    ];
    const menu = {};
    items.forEach(item => menu[item.name] = item);
    return menu;
  }

  addRevenue(amount) {
    this.balance += amount;
    this.revenue_today += amount;
    this.revenue_all_time += amount;
  }

  payEmployees() {
    let total_paid = 0;
    this.employees.forEach(emp => {
      const payment = emp.salary;
      this.balance -= payment;
      total_paid += payment;
    });
    return total_paid;
  }

  purchaseItem(itemName) {
    const item = this.menu_items[itemName];
    if (!item) return null;
    this.balance -= item.cost;
    item.orders_sold += 1;
    return item.profit();
  }

  toggleOpen() {
    this.is_open = !this.is_open;
  }
}

class Business {
  constructor(userId) {
    this.user_id = userId;
    this.business_name = "Unnamed Empire";
    this.business_type = "restaurant";
    this.locations = [];
    this.total_balance = 10000;
    this.loan = 0;
    this.loan_interest = 0.05;
    this.prestige = 0;
    this.level = 1;
    this.created_date = new Date();
    this.marketing_budget = 0;
    this.reputation = 50;
    this.total_employees = 0;
    this.shop = new Shop();
    this.setup_complete = false;
    this.total_revenue = 0;
    this.achievements = [];
    this.investments = [];
    this.franchise_agreement = false;
    this.franchises_owned = 0;
    this.total_customers_served = 0;
    this.daily_profit_goal = 500;
    this.statistics = {
      highest_daily_revenue: 0,
      total_upgrades: 0,
      total_hires: 0,
      total_employees_fired: 0
    };
  }

  getTotalRevenue() {
    return this.locations.reduce((sum, loc) => sum + loc.revenue_today, 0);
  }

  getTotalBalance() {
    return this.total_balance + this.locations.reduce((sum, loc) => sum + loc.balance, 0);
  }

  getTotalEmployees() {
    return this.locations.reduce((sum, loc) => sum + loc.employees.length, 0);
  }

  addPrestige(amount) {
    this.prestige += amount;
    this.level = Math.floor(1 + this.prestige / 100);
  }

  applyForFranchise(cost) {
    if (this.getTotalBalance() >= cost) {
      this.total_balance -= cost;
      this.franchise_agreement = true;
      return true;
    }
    return false;
  }

  openFranchise(cost) {
    if (this.getTotalBalance() >= cost && this.franchise_agreement) {
      this.total_balance -= cost;
      this.franchises_owned += 1;
      return true;
    }
    return false;
  }

  addAchievement(name, description, icon) {
    if (!this.achievements.find(a => a.name === name)) {
      this.achievements.push(new Achievement(name, description, icon));
      return true;
    }
    return false;
  }
}

// =============== REALISTIC DATA ===============

const EMPLOYEE_NAMES = {
  first: ["Marcus", "Jessica", "David", "Sarah", "James", "Emma", "Michael", "Olivia", "Chris", "Sophia", "Robert", "Ava", "Daniel", "Isabella", "Matthew", "Charlotte", "Andrew", "Amelia", "Joseph", "Mia", "William", "Harper", "Benjamin", "Evelyn"],
  last: ["Johnson", "Smith", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White"]
};

const BUSINESS_TYPES = {
  'restaurant': '🍽️ Restaurant - Fine dining, higher prices',
  'fast_food': '🍔 Fast Food - Quick service, high volume',
  'cafe': '☕ Café - Beverages & pastries, trendy',
  'catering': '🎉 Catering - Events & bulk orders'
};

const LOCATION_NAMES = {
  flagship: ["Downtown Hub", "Central Station", "Main Street", "Premier Location", "Grand Central"],
  franchise: ["Express", "Quick Stop", "Urban Eats", "City Branch", "Speedy Service"],
  kiosk: ["Corner Spot", "Mall Kiosk", "Quick Grab", "Fast Lane"]
};

const CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Miami", "Boston", "Seattle", "Denver", "Atlanta", "Las Vegas", "Portland"];

const SUPPLIERS = [
  { name: "Premium Foods Co", quality: 0.95, cost_multiplier: 1.3, delivery_time: 2 },
  { name: "Budget Supplies", quality: 0.65, cost_multiplier: 0.65, delivery_time: 1 },
  { name: "Local Farms", quality: 0.98, cost_multiplier: 1.5, delivery_time: 3 },
  { name: "Wholesale Giants", quality: 0.8, cost_multiplier: 0.75, delivery_time: 2 },
  { name: "Organic Direct", quality: 0.92, cost_multiplier: 1.4, delivery_time: 4 }
];

const RANDOM_EVENTS = [
  { name: "Food Safety Inspection", impact: -50, type: 'negative' },
  { name: "Local Food Festival", impact: 200, type: 'positive' },
  { name: "Celebrity Visit", impact: 100, type: 'positive' },
  { name: "Supply Shortage", impact: -100, type: 'negative' },
  { name: "Media Coverage", impact: 80, type: 'positive' }
];

// =============== GAME STATE ===============

const businesses = {};

function getOrCreateBusiness(userId) {
  if (!businesses[userId]) {
    businesses[userId] = new Business(userId);
  }
  return businesses[userId];
}

function generateEmployeeName() {
  const first = EMPLOYEE_NAMES.first[Math.floor(Math.random() * EMPLOYEE_NAMES.first.length)];
  const last = EMPLOYEE_NAMES.last[Math.floor(Math.random() * EMPLOYEE_NAMES.last.length)];
  return `${first} ${last}`;
}

function generateCustomer(location) {
  const names = ["Alex", "Taylor", "Jordan", "Sam", "Casey", "Morgan", "Jamie", "Riley", "Chris", "Drew"];
  const personalities = ["😋 Hungry", "⏰ In a hurry", "😤 Picky", "😊 Happy", "😴 Tired", "👑 VIP"];
  
  return {
    name: names[Math.floor(Math.random() * names.length)],
    personality: personalities[Math.floor(Math.random() * personalities.length)],
    hunger_level: Math.floor(Math.random() * 100),
    patience: Math.floor(Math.random() * 100),
    budget: Math.floor(Math.random() * 30 + 5) * location.level
  };
}

function simulateLocationTick(location) {
  const now = new Date();
  const elapsed = (now - location.last_tick) / 1000;
  
  if (elapsed < 30) return;
  
  location.last_tick = now;

  if (!location.is_open) return;

  const payroll = location.payEmployees();
  location.balance -= payroll;

  const hour = now.getHours();
  const is_open = hour >= location.operating_hours.open && hour < location.operating_hours.close;
  
  if (!is_open) return;

  const customer_generation_rate = location.level * (location.reputation / 100) * 8;
  const customers = Math.floor(Math.random() * customer_generation_rate) + 1;

  for (let i = 0; i < customers; i++) {
    const customer = generateCustomer(location);
    
    const avg_inventory = Object.values(location.inventory).reduce((a, b) => a + b, 0) / Object.keys(location.inventory).length || 0;
    if (avg_inventory <= 0) break;

    const avg_employee_speed = location.employees.length > 0
      ? (location.employees.reduce((sum, e) => sum + e.speed * e.performance, 0) / location.employees.length) * location.speed_multiplier
      : 3;
    const avg_employee_quality = location.employees.length > 0
      ? (location.employees.reduce((sum, e) => sum + e.quality * e.performance, 0) / location.employees.length) * location.quality_multiplier
      : 5;

    const serve_chance = Math.min(1.0, (avg_employee_speed / 10) * (customer.patience / 100));

    if (Math.random() < serve_chance && customer.budget > 0) {
      const menuItems = Object.values(location.menu_items);
      const selectedItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      
      const order_value = selectedItem.selling_price;
      const cost = selectedItem.cost;
      const profit = order_value - cost;

      location.addRevenue(profit);
      location.customer_count_today++;
      selectedItem.orders_sold += 1;

      const satisfaction = Math.min(100, 50 + (avg_employee_quality * 5) + (Math.random() * 30));
      location.avg_satisfaction = (location.avg_satisfaction + satisfaction) / 2;

      if (satisfaction > 80) {
        const tip = Math.floor(Math.random() * 3 + 1);
        location.addRevenue(tip);
      }

      const items = Object.keys(location.inventory);
      if (items.length > 0) {
        const item = items[Math.floor(Math.random() * items.length)];
        location.inventory[item] = Math.max(0, location.inventory[item] - 1);
      }
    } else {
      location.reputation = Math.max(0, location.reputation - 1);
    }
  }

  if (location.avg_satisfaction > 85) {
    location.reputation = Math.min(100, location.reputation + 1);
  }
}

// =============== EMBED BUILDERS ===============

function buildProgressBar(current, max, length = 10) {
  const percentage = current / max;
  const filled = Math.floor(percentage * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function buildSetupEmbed() {
  return new EmbedBuilder()
    .setTitle("🎉 Welcome to Business Tycoon!")
    .setDescription("Let's set up your empire! Answer a few questions to get started.")
    .setColor(0xFF6B35)
    .setThumbnail('https://media.discordapp.net/attachments/1194280900903579649/1299564048898510960/image-removebg-preview.png?ex=671bf4c0&is=671aa340&size=large')
    .addFields(
      { name: "Step 1️⃣", value: "Choose your business type", inline: false },
      { name: "Step 2️⃣", value: "Name your empire", inline: false },
      { name: "Step 3️⃣", value: "Open your first location", inline: false }
    )
    .setFooter({ text: "Let's build something great! 🚀" });
}

function buildBusinessEmbed(user, business) {
  const totalRevenue = business.getTotalRevenue();
  const totalBalance = business.getTotalBalance();
  const totalEmployees = business.getTotalEmployees();

  const repBar = buildProgressBar(business.reputation, 100);

  const embed = new EmbedBuilder()
    .setTitle(`${business.business_type === 'fast_food' ? '🍔' : business.business_type === 'cafe' ? '☕' : business.business_type === 'catering' ? '🎉' : '🍽️'} ${business.business_name}`)
    .setColor(0xFF6B35)
    .setThumbnail('https://media.discordapp.net/attachments/1194280900903579649/1299564048898510960/image-removebg-preview.png?ex=671bf4c0&is=671aa340&size=large')
    .addFields(
      { name: "💰 Total Balance", value: `$${totalBalance.toLocaleString()}`, inline: true },
      { name: "📈 Today's Revenue", value: `$${totalRevenue.toLocaleString()}`, inline: true },
      { name: "🏆 Level", value: String(business.level), inline: true },
      { name: "⭐ Prestige", value: `${business.prestige}`, inline: true },
      { name: "📊 Reputation", value: `${repBar} ${business.reputation}/100`, inline: true },
      { name: "🏪 Locations", value: String(business.locations.length), inline: true },
      { name: "👥 Total Employees", value: String(totalEmployees), inline: true },
      { name: "💼 Business Type", value: BUSINESS_TYPES[business.business_type], inline: true },
      { name: "🎖️ Achievements", value: String(business.achievements.length), inline: true },
      { name: "📍 Locations", value: business.locations.length === 0 ? "No locations yet" : business.locations.map(loc => `**${loc.name}** (${loc.city}) Lvl ${loc.level} • $${loc.balance} • ⭐${loc.reputation}`).join('\n'), inline: false }
    )
    .setFooter({ text: "Keep building! 🚀" });

  return embed;
}

function buildLocationEmbed(location) {
  const employees_text = location.employees.length === 0
    ? "No employees"
    : location.employees.map(e => `• ${e.name} (${e.role}) Lvl${e.level} • Morale: ${e.morale}%`).slice(0, 5).join('\n');

  const topMenuItems = Object.values(location.menu_items)
    .sort((a, b) => b.orders_sold - a.orders_sold)
    .slice(0, 3)
    .map(item => `• ${item.name}: ${item.orders_sold} sold`)
    .join('\n');

  const repBar = buildProgressBar(location.reputation, 100);
  const satisfactionBar = buildProgressBar(location.avg_satisfaction, 100);

  const embed = new EmbedBuilder()
    .setTitle(`🏪 ${location.name} - ${location.city}`)
    .setColor(0x04B4D4)
    .addFields(
      { name: "Level", value: String(location.level), inline: true },
      { name: "💰 Balance", value: `$${location.balance.toLocaleString()}`, inline: true },
      { name: "📊 Today's Revenue", value: `$${location.revenue_today.toLocaleString()}`, inline: true },
      { name: "⭐ Reputation", value: `${repBar} ${location.reputation}/100`, inline: true },
      { name: "😊 Satisfaction", value: `${satisfactionBar} ${location.avg_satisfaction.toFixed(0)}%`, inline: true },
      { name: "👥 Customers Today", value: String(location.customer_count_today), inline: true },
      { name: "🔴 Status", value: location.is_open ? "🟢 OPEN" : "🔴 CLOSED", inline: true },
      { name: "👔 Staff", value: employees_text || "No employees yet", inline: false },
      { name: "🍔 Top Menu Items", value: topMenuItems || "No sales yet", inline: false }
    );

  return embed;
}

function buildShopEmbed() {
  const shop = new Shop();
  const items = Object.entries(shop.items)
    .map(([name, data]) => `**${name}** - $${data.cost}\n💡 +${(data.value * 100).toFixed(0)}`)
    .join('\n\n');

  return new EmbedBuilder()
    .setTitle("🏬 Premium Shop")
    .setDescription("Upgrade your business with premium features!")
    .setColor(0xFFD700)
    .addFields(
      { name: "Available Items", value: items, inline: false }
    );
}

function buildEmployeeEmbed(employee) {
  const performanceBar = buildProgressBar(employee.performance * 100, 100);
  const moraleBar = buildProgressBar(employee.morale, 100);

  return new EmbedBuilder()
    .setTitle(`👤 ${employee.name}`)
    .setColor(0x9B59B6)
    .addFields(
      { name: "💼 Role", value: employee.role.toUpperCase(), inline: true },
      { name: "📊 Level", value: String(employee.level), inline: true },
      { name: "💰 Salary", value: `$${employee.salary}/period`, inline: true },
      { name: "⚡ Speed", value: String(employee.speed), inline: true },
      { name: "✨ Quality", value: String(employee.quality), inline: true },
      { name: "😊 Customer Satisfaction", value: String(employee.customer_satisfaction), inline: true },
      { name: "📈 Performance", value: `${performanceBar} ${(employee.performance * 100).toFixed(0)}%`, inline: false },
      { name: "😄 Morale", value: 

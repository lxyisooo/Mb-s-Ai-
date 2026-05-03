// =============================================
// NPC CUSTOMER ENGINE — Hunger, patience, personalities
// =============================================

const { getPlayer, savePlayer, loadDB } = require('./database');
const { MENU_ITEMS } = require('./economy');

const NPC_NAMES = [
  'Jake', 'Maria', 'DeShawn', 'Sophie', 'Raj', 'Mei', 'Tyler', 'Aaliyah',
  'Carlos', 'Emma', 'Noah', 'Fatima', 'Liam', 'Zoe', 'Marcus', 'Priya',
  'Ethan', 'Chloe', 'Jordan', 'Yuki', 'Kevin', 'Brianna', 'Omar', 'Stella'
];

const PERSONALITIES = {
  hungry: {
    label: '😤 Starving',
    hungerLevel: 95,
    patience: 4,          // minutes before leaving
    tipMultiplier: 1.0,
    orderSize: 3,         // items
    description: 'Extremely hungry, will order a lot but patience is thin'
  },
  casual: {
    label: '😊 Casual',
    hungerLevel: 50,
    patience: 8,
    tipMultiplier: 1.2,
    orderSize: 2,
    description: 'Normal customer, reasonable patience'
  },
  impatient: {
    label: '😠 Impatient',
    hungerLevel: 60,
    patience: 2,
    tipMultiplier: 0.5,
    orderSize: 1,
    description: 'Always in a rush. Leave tip only if FAST service'
  },
  generous: {
    label: '🤑 Big Tipper',
    hungerLevel: 40,
    patience: 10,
    tipMultiplier: 2.5,
    orderSize: 2,
    description: 'Rich and generous. Tips HUGE if happy'
  },
  critic: {
    label: '🧐 Food Critic',
    hungerLevel: 30,
    patience: 7,
    tipMultiplier: 0,
    orderSize: 2,
    description: 'Affects your reputation heavily. No tip but rep impact ×3'
  },
  groupOrder: {
    label: '👨‍👩‍👧 Family Group',
    hungerLevel: 70,
    patience: 6,
    tipMultiplier: 1.5,
    orderSize: 5,
    description: 'Ordering for the whole family. Big bill, medium patience'
  }
};

function generateCustomer(restaurantId) {
  const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
  const personalityKey = weightedRandom({
    hungry: 15, casual: 35, impatient: 20, generous: 10, critic: 5, groupOrder: 15
  });
  const personality = PERSONALITIES[personalityKey];

  const menuKeys = Object.keys(MENU_ITEMS);
  const order = [];
  const usedItems = new Set();

  for (let i = 0; i < personality.orderSize; i++) {
    let item;
    let attempts = 0;
    do {
      item = menuKeys[Math.floor(Math.random() * menuKeys.length)];
      attempts++;
    } while (usedItems.has(item) && attempts < 10);
    usedItems.add(item);
    order.push(item);
  }

  const orderValue = order.reduce((sum, key) => sum + MENU_ITEMS[key].basePrice, 0);

  return {
    id: `npc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name,
    personalityKey,
    personalityLabel: personality.label,
    hungerLevel: personality.hungerLevel + Math.floor(Math.random() * 10) - 5,
    patience: personality.patience,
    tipMultiplier: personality.tipMultiplier,
    order,
    orderValue: +orderValue.toFixed(2),
    restaurantId,
    arrivedAt: Date.now(),
    expiresAt: Date.now() + personality.patience * 60 * 1000,
    status: 'waiting',   // waiting | served | left
    isCritic: personalityKey === 'critic'
  };
}

function weightedRandom(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (const [key, weight] of Object.entries(weights)) {
    rand -= weight;
    if (rand <= 0) return key;
  }
  return Object.keys(weights)[0];
}

// Called on interval by main bot — adds customers to active restaurants
function simulateCustomers(client) {
  const db = loadDB();

  for (const [userId, player] of Object.entries(db)) {
    if (!player.restaurants || player.restaurants.length === 0) continue;

    for (const restaurant of player.restaurants) {
      // Chance of new customer based on reputation
      const chance = 0.3 + (player.reputation / 100) * 0.5;
      if (Math.random() > chance) continue;

      // Check capacity
      const waitingCount = (player.activeOrders || []).filter(
        o => o.restaurantId === restaurant.id && o.status === 'waiting'
      ).length;

      const tierCapacity = { foodcart: 5, kiosk: 10, diner: 20, chain: 50 }[restaurant.tier] || 5;
      if (waitingCount >= tierCapacity) continue;

      const customer = generateCustomer(restaurant.id);
      if (!player.activeOrders) player.activeOrders = [];
      player.activeOrders.push(customer);
    }

    // Expire old customers who left
    const now = Date.now();
    if (player.activeOrders) {
      player.activeOrders = player.activeOrders.filter(order => {
        if (order.status === 'waiting' && now > order.expiresAt) {
          player.failedOrders = (player.failedOrders || 0) + 1;
          player.reputation = Math.max(0, (player.reputation || 50) - (order.isCritic ? 6 : 2));
          return false; // Remove expired customer
        }
        return order.status !== 'served'; // Remove served too
      });
    }

    savePlayer(userId, player);
  }
}

module.exports = { generateCustomer, simulateCustomers, PERSONALITIES };

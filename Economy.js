// =============================================
// ECONOMY SYSTEM — Realistic pricing, costs, margins
// =============================================

const MENU_ITEMS = {
  burger: {
    name: '🍔 Classic Burger',
    basePrice: 8.99,
    baseCost: 2.50,
    cookTime: 3,       // minutes (game time)
    popularity: 0.9,
    hungerValue: 40
  },
  fries: {
    name: '🍟 Large Fries',
    basePrice: 3.99,
    baseCost: 0.60,
    cookTime: 2,
    popularity: 0.95,
    hungerValue: 20
  },
  soda: {
    name: '🥤 Large Soda',
    basePrice: 2.49,
    baseCost: 0.30,
    cookTime: 0,
    popularity: 0.85,
    hungerValue: 5
  },
  chicken: {
    name: '🍗 Crispy Chicken',
    basePrice: 10.99,
    baseCost: 3.20,
    cookTime: 5,
    popularity: 0.75,
    hungerValue: 50
  },
  hotdog: {
    name: '🌭 Mega Hotdog',
    basePrice: 6.49,
    baseCost: 1.40,
    cookTime: 2,
    popularity: 0.65,
    hungerValue: 30
  },
  pizza: {
    name: '🍕 Slice of Pizza',
    basePrice: 4.99,
    baseCost: 1.10,
    cookTime: 4,
    popularity: 0.80,
    hungerValue: 35
  },
  shake: {
    name: '🥛 Milkshake',
    basePrice: 5.99,
    baseCost: 1.80,
    cookTime: 1,
    popularity: 0.70,
    hungerValue: 15
  },
  wrap: {
    name: '🌯 Veggie Wrap',
    basePrice: 7.99,
    baseCost: 2.10,
    cookTime: 3,
    popularity: 0.60,
    hungerValue: 38
  }
};

const RESTAURANT_TIERS = {
  foodcart: {
    name: '🛒 Food Cart',
    cost: 0,
    capacity: 5,          // max simultaneous orders
    maxStaff: 2,
    dailyRent: 0,
    menuSlots: 3,
    description: 'Your humble beginning. Limited but zero overhead.'
  },
  kiosk: {
    name: '🏪 Food Kiosk',
    cost: 1500,
    capacity: 10,
    maxStaff: 4,
    dailyRent: 50,
    menuSlots: 5,
    description: 'A proper setup with more menu items and staff.'
  },
  diner: {
    name: '🍽️ Fast Food Diner',
    cost: 5000,
    capacity: 20,
    maxStaff: 8,
    dailyRent: 200,
    menuSlots: 8,
    description: 'Full restaurant with kitchen, seating, and staff room.'
  },
  chain: {
    name: '🏬 Chain Location',
    cost: 20000,
    capacity: 50,
    maxStaff: 15,
    dailyRent: 800,
    menuSlots: 8,
    description: 'A franchise-level operation. Maximum capacity and brand power.'
  }
};

// Market fluctuations — ingredient costs rise/fall
function getMarketMultiplier() {
  // Random walk between 0.7 and 1.5
  return +(0.85 + Math.random() * 0.5).toFixed(2);
}

function getItemCost(itemKey, marketMultiplier = 1.0) {
  const item = MENU_ITEMS[itemKey];
  if (!item) return null;
  return {
    ...item,
    currentCost: +(item.baseCost * marketMultiplier).toFixed(2),
    profit: +(item.basePrice - item.baseCost * marketMultiplier).toFixed(2),
    margin: +(((item.basePrice - item.baseCost * marketMultiplier) / item.basePrice) * 100).toFixed(1)
  };
}

function calcRestaurantUpkeep(restaurant) {
  const tier = RESTAURANT_TIERS[restaurant.tier];
  return tier ? tier.dailyRent : 0;
}

module.exports = {
  MENU_ITEMS,
  RESTAURANT_TIERS,
  getMarketMultiplier,
  getItemCost,
  calcRestaurantUpkeep
};

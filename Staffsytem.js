// =============================================
// STAFF SYSTEM — Hiring, wages, performance, morale
// =============================================

const STAFF_ROLES = {
  cashier: {
    name: '💳 Cashier',
    hireCost: 100,
    hourlyWage: 12,
    description: 'Takes orders faster. Each cashier reduces customer wait time by 15%.',
    speedBonus: 0.15,
    qualityBonus: 0,
    maxPerRestaurant: 3
  },
  cook: {
    name: '👨‍🍳 Cook',
    hireCost: 200,
    hourlyWage: 16,
    description: 'Prepares food faster and better. Each cook cuts cook time by 20%.',
    speedBonus: 0.20,
    qualityBonus: 0.10,
    maxPerRestaurant: 4
  },
  manager: {
    name: '📋 Manager',
    hireCost: 800,
    hourlyWage: 28,
    description: 'Boosts ALL staff efficiency by 10% and improves reputation gain.',
    speedBonus: 0.10,
    qualityBonus: 0.15,
    maxPerRestaurant: 1
  },
  cleaner: {
    name: '🧹 Cleaner',
    hireCost: 80,
    hourlyWage: 10,
    description: 'Keeps the place clean. Improves reputation passively by +1/hr.',
    speedBonus: 0,
    qualityBonus: 0.05,
    maxPerRestaurant: 2
  },
  delivery: {
    name: '🛵 Delivery Driver',
    hireCost: 300,
    hourlyWage: 14,
    description: 'Unlocks /deliver command. Each driver handles 1 delivery at a time.',
    speedBonus: 0,
    qualityBonus: 0,
    maxPerRestaurant: 3
  }
};

const STAFF_NAMES = [
  'Alex', 'Sam', 'Jamie', 'Taylor', 'Morgan', 'Casey', 'Avery', 'Riley',
  'Quinn', 'Blake', 'Dakota', 'Hayden', 'Skyler', 'Reese', 'Finley', 'Rowan'
];

function generateStaff(roleKey, restaurantId) {
  const role = STAFF_ROLES[roleKey];
  if (!role) return null;

  // Random skill level 1-5
  const skillLevel = Math.ceil(Math.random() * 5);

  return {
    id: `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: STAFF_NAMES[Math.floor(Math.random() * STAFF_NAMES.length)],
    roleKey,
    roleName: role.name,
    restaurantId,
    skillLevel,
    morale: 80,           // 0-100
    hoursWorked: 0,
    ordersHelped: 0,
    hiredAt: Date.now(),
    totalWagesPaid: 0
  };
}

function getStaffBonus(staffList, restaurantId) {
  const restaurantStaff = staffList.filter(s => s.restaurantId === restaurantId);
  let speedBonus = 1.0;
  let qualityBonus = 1.0;
  let hasManager = false;

  for (const staff of restaurantStaff) {
    const role = STAFF_ROLES[staff.roleKey];
    if (!role) continue;

    // Skill level scales bonus (1-5 → 60%-140% of base bonus)
    const skillMod = 0.6 + (staff.skillLevel - 1) * 0.2;
    const moraleMod = staff.morale / 100;

    speedBonus += role.speedBonus * skillMod * moraleMod;
    qualityBonus += role.qualityBonus * skillMod * moraleMod;

    if (staff.roleKey === 'manager') hasManager = true;
  }

  // Manager multiplies all other bonuses
  if (hasManager) {
    speedBonus *= 1.1;
    qualityBonus *= 1.15;
  }

  return { speedBonus, qualityBonus };
}

function calcHourlyWages(staffList) {
  return staffList.reduce((total, staff) => {
    const role = STAFF_ROLES[staff.roleKey];
    return total + (role ? role.hourlyWage : 0);
  }, 0);
}

function canHireRole(player, restaurantId, roleKey) {
  const role = STAFF_ROLES[roleKey];
  if (!role) return { ok: false, reason: 'Unknown role.' };

  const restaurant = (player.restaurants || []).find(r => r.id === restaurantId);
  if (!restaurant) return { ok: false, reason: 'Restaurant not found.' };

  const staffInRestaurant = (player.staff || []).filter(
    s => s.restaurantId === restaurantId && s.roleKey === roleKey
  ).length;

  if (staffInRestaurant >= role.maxPerRestaurant) {
    return { ok: false, reason: `Max ${role.maxPerRestaurant} ${role.name} per restaurant.` };
  }

  const { RESTAURANT_TIERS } = require('./economy');
  const tierData = RESTAURANT_TIERS[restaurant.tier];
  const totalStaff = (player.staff || []).filter(s => s.restaurantId === restaurantId).length;

  if (totalStaff >= (tierData?.maxStaff || 2)) {
    return { ok: false, reason: `Your restaurant is at max staff capacity (${tierData?.maxStaff}).` };
  }

  if (player.cash < role.hireCost) {
    return { ok: false, reason: `Not enough cash. Need $${role.hireCost}.` };
  }

  return { ok: true };
}

module.exports = { STAFF_ROLES, generateStaff, getStaffBonus, calcHourlyWages, canHireRole };

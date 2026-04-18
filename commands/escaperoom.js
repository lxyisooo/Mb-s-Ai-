/******************************************************************************************
 * ESCAPE ROOM RPG ENGINE — SINGLE FILE EDITION
 * Features:
 * - Classes
 * - Story narration
 * - Loot + rarity
 * - Shop system
 * - Combat encounters
 * - Room progression
 ******************************************************************************************/

const fs = require("fs");

/* =========================
   PLAYER DATABASE
========================= */

const players = new Map();

function getPlayer(id) {
  if (!players.has(id)) {
    players.set(id, {
      class: null,
      room: "cell",
      hp: 100,
      gold: 10,
      inventory: [],
      difficulty: 0,
      stats: { strength: 0, agility: 0, intelligence: 0 }
    });
  }
  return players.get(id);
}

/* =========================
   CLASSES
========================= */

const classes = {
  warrior: {
    hp: 130,
    gold: 5,
    stats: { strength: 5, agility: 2, intelligence: 1 },
    starter: "Broken Sword"
  },
  rogue: {
    hp: 90,
    gold: 15,
    stats: { strength: 2, agility: 6, intelligence: 2 },
    starter: "Lockpick"
  },
  mage: {
    hp: 80,
    gold: 10,
    stats: { strength: 1, agility: 3, intelligence: 7 },
    starter: "Mana Crystal"
  }
};

function setClass(id, type) {
  const p = getPlayer(id);
  const c = classes[type];
  if (!c) return "❌ Invalid class.";

  p.class = type;
  p.hp = c.hp;
  p.gold = c.gold;
  p.stats = { ...c.stats };
  p.inventory.push(c.starter);

  return `🧙 You are now a **${type.toUpperCase()}**`;
}

/* =========================
   LOOT SYSTEM
========================= */

const lootTable = [
  { name: "Rusty Dagger", rarity: "common" },
  { name: "Healing Herb", rarity: "common" },
  { name: "Steel Blade", rarity: "rare" },
  { name: "Shadow Cloak", rarity: "rare" },
  { name: "Dragon Fragment", rarity: "epic" },
  { name: "Void Crown", rarity: "legendary" }
];

function randomLoot() {
  const roll = Math.random() * 100;

  if (roll > 95) return lootTable[5];
  if (roll > 80) return lootTable[4];
  if (roll > 50) return lootTable[2 + Math.floor(Math.random() * 2)];
  return lootTable[Math.floor(Math.random() * 2)];
}

/* =========================
   SHOP
========================= */

const shop = [
  { name: "Health Potion", price: 10, heal: 30 },
  { name: "Iron Sword", price: 25, atk: 3 },
  { name: "Agility Boots", price: 20, agi: 2 },
  { name: "Arcane Tome", price: 30, int: 3 }
];

function buy(id, itemName) {
  const p = getPlayer(id);
  const item = shop.find(i => i.name.toLowerCase() === itemName.toLowerCase());

  if (!item) return "❌ Item not found.";
  if (p.gold < item.price) return "💰 Not enough gold.";

  p.gold -= item.price;
  p.inventory.push(item.name);

  return `🛒 Bought **${item.name}**`;
}

/* =========================
   STORY ROOMS
========================= */

const rooms = {
  cell: {
    name: "🧩 Prison Cell",
    story: "Cold stone surrounds you. Something is wrong... the wall is breathing.",
    actions: ["search", "rest", "yell"]
  },

  hallway: {
    name: "🚪 Whisper Hallway",
    story: "Shadows move even when you don't. The air feels alive.",
    actions: ["move", "search", "shop"]
  },

  vault: {
    name: "🧠 Arcane Vault",
    story: "A glowing lock pulses with ancient magic.",
    actions: ["solve", "force", "loot"]
  },

  freedom: {
    name: "🌅 Exit",
    story: "Light pours in... but something watches you leave.",
    actions: []
  }
};

/* =========================
   COMBAT SYSTEM
========================= */

function combat(p) {
  const enemy = Math.floor(Math.random() * 10) + 1;
  const playerPower = p.stats.strength + Math.floor(Math.random() * 6);

  if (playerPower >= enemy) {
    const loot = randomLoot();
    p.inventory.push(loot.name);
    p.gold += 5;
    return `⚔️ You defeated a shadow beast!\n💎 Loot: ${loot.name}`;
  }

  p.hp -= 20;
  return "💀 You got hit by a shadow creature!";
}

/* =========================
   MAIN ENGINE
========================= */

function handleAction(id, action) {
  const p = getPlayer(id);
  const room = rooms[p.room];

  if (!room) return "❌ Invalid room.";

  /* ===== CELL ===== */
  if (p.room === "cell") {
    if (action === "search") {
      const loot = randomLoot();
      p.inventory.push(loot.name);
      p.room = "hallway";
      return `🔍 You found ${loot.name} and escaped the cell...`;
    }

    if (action === "rest") {
      p.hp = Math.min(100, p.hp + 10);
      return "😌 You rest and recover.";
    }

    if (action === "yell") {
      p.hp -= 5;
      return "📢 Something hears you in the dark...";
    }
  }

  /* ===== HALLWAY ===== */
  if (p.room === "hallway") {
    if (action === "move") {
      const chance = 40 + p.difficulty * 5;

      if (Math.random() * 100 > chance) {
        p.room = "vault";
        return "👣 You safely reach the vault...";
      }

      return combat(p);
    }

    if (action === "search") {
      const loot = randomLoot();
      p.inventory.push(loot.name);
      return `🧺 You found ${loot.name}`;
    }

    if (action === "shop") {
      return "🏪 Items: " + shop.map(i => `${i.name} (${i.price}g)`).join(", ");
    }
  }

  /* ===== VAULT ===== */
  if (p.room === "vault") {
    if (action === "solve") {
      const hasKey = p.inventory.includes("Mysterious Key");

      if (hasKey) {
        p.room = "freedom";
        return "🧠 The vault unlocks... freedom is near.";
      }

      p.hp -= 25;
      return "💥 Wrong solution! Arcane backlash!";
    }

    if (action === "force") {
      if (p.stats.strength > 5) {
        p.room = "freedom";
        return "💪 You break the vault open!";
      }

      p.hp = 0;
      return "☠️ The vault crushes you.";
    }

    if (action === "loot") {
      const loot = randomLoot();
      p.inventory.push(loot.name);
      return `💎 You found ${loot.name}`;
    }
  }

  return "❓ Nothing happens.";
}

/* =========================
   SAVE SYSTEM (OPTIONAL)
========================= */

function save() {
  fs.writeFileSync("./players.json", JSON.stringify([...players]));
}

function load() {
  if (!fs.existsSync("./players.json")) return;
  const data = JSON.parse(fs.readFileSync("./players.json"));

  for (const [id, val] of data) {
    players.set(id, val);
  }
}

setInterval(save, 30000);
load();

/* =========================
   EXPORTS
========================= */

module.exports = {
  getPlayer,
  handleAction,
  setClass,
  buy
};

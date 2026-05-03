const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/players.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getPlayer(userId) {
  const db = loadDB();
  if (!db[userId]) {
    db[userId] = createNewPlayer(userId);
    saveDB(db);
  }
  return db[userId];
}

function savePlayer(userId, playerData) {
  const db = loadDB();
  db[userId] = playerData;
  saveDB(db);
}

function createNewPlayer(userId) {
  return {
    userId,
    name: null,
    cash: 500,
    totalEarned: 0,
    reputation: 50,        // 0-100, affects customer flow
    restaurants: [],
    staff: [],
    activeOrders: [],
    completedOrders: 0,
    failedOrders: 0,
    dayStarted: Date.now(),
    lastActivityLog: [],
    marketMultiplier: 1.0,
    createdAt: Date.now()
  };
}

module.exports = { getPlayer, savePlayer, loadDB };

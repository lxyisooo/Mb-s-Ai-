const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    cash: { type: Number, default: 1000 },
    luck: { type: Number, default: 1.0 },
    inventory: { type: Array, default: [] },
    zoo: { type: Map, of: Number, default: {} },
    weapon: { type: String, default: "Fists" },
    marriedTo: { type: String, default: null },
    accepted: { type: Boolean, default: false },
    cooldowns: {
        hunt: { type: Number, default: 0 },
        daily: { type: Number, default: 0 },
        pray: { type: Number, default: 0 }
    }
});

module.exports = mongoose.model('User', UserSchema);

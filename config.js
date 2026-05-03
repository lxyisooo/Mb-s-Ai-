lconst mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
    class: { type: String, default: 'Recruit' },
    inventory: [String],
    equipped: { type: String, default: 'Rusty Knife' },
    wins: { type: Number, default: 0 },
    stamina: { type: Number, default: 5 }
});

module.exports = mongoose.model('User', UserSchema);

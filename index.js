const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "mb";

// --- DB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected!"))
    .catch(err => console.log("❌ DB Error: ", err));

// --- USER SCHEMA ---
const userSchema = new mongoose.Schema({
    userId: String,
    cash: { type: Number, default: 1000 },
    luck: { type: Number, default: 1.0 },
    zoo: { type: Map, of: Number, default: {} },
    inv: { type: Array, default: [] },
    weapon: { type: String, default: "Fists" },
    marriedTo: { type: String, default: "Nobody" },
    accepted: { type: Boolean, default: false },
    cooldowns: { hunt: { type: Number, default: 0 }, pray: { type: Number, default: 0 } }
});
const User = mongoose.model('User', userSchema);

client.once('ready', () => console.log(`🚀 ${client.user.tag} is online!`));

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    // --- GATE: HELP & RULES (Only full commands allowed) ---
    if (cmd === 'help' || cmd === 'rules') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('v').setLabel('Accept Rules').setStyle(ButtonStyle.Success)
        );
        return message.reply({ content: "📜 **Wimble Rules:** No spamming. Enjoy the grind.\nClick to verify!", components: [row] });
    }

    if (!user.accepted) return message.reply("⚠️ You must accept the rules in `mb help` first!");

    // --- RPG & ECONOMY COMMANDS (Short & Full) ---

    // HUNT (mb h / mb hunt)
    if (cmd === 'h' || cmd === 'hunt') {
        const now = Date.now();
        if (now < user.cooldowns.hunt) return message.reply(`⏳ Wait ${Math.ceil((user.cooldowns.hunt - now)/1000)}s!`);
        
        const animals = ['🐭', '🦊', '🐯', '🐉'];
        const res = animals[Math.floor(Math.random() * animals.length)];
        const gain = 100;
        
        user.cash += gain;
        user.zoo.set(res, (user.zoo.get(res) || 0) + 1);
        user.cooldowns.hunt = now + 15000;
        await user.save();
        message.reply(`🏹 Caught a **${res}**! Found **${gain} mb cash**.`);
    }

    // SLOTS (mb s / mb slots)
    if (cmd === 's' || cmd === 'slots') {
        const bet = parseInt(args[0]);
        if (!bet || bet > user.cash || bet < 10) return message.reply("❌ Usage: `mb s [amount]`");
        
        const emoji = ['🍎', '💎', '🌟'];
        const r = [emoji[Math.floor(Math.random()*3)], emoji[Math.floor(Math.random()*3)], emoji[Math.floor(Math.random()*3)]];
        const win = r[0] === r[1] && r[1] === r[2];

        user.cash += win ? bet * 5 : -bet;
        await user.save();
        message.reply(`🎰 **[ ${r.join(' | ')} ]**\n${win ? `🔥 WIN! +${bet*5}` : `❌ LOSS! -${bet}`} mb cash`);
    }

    // PROFILE (mb p / mb profile)
    if (cmd === 'p' || cmd === 'profile') {
        const embed = new EmbedBuilder()
            .setTitle(`${message.author.username}'s Profile`)
            .addFields(
                { name: "💰 Cash", value: `${user.cash} mbc`, inline: true },
                { name: "💍 Partner", value: user.marriedTo, inline: true },
                { name: "⚔️ Weapon", value: user.weapon, inline: true }
            ).setColor("#5865F2");
        message.reply({ embeds: [embed] });
    }

    // PRAY (mb pray)
    if (cmd === 'pray') {
        const now = Date.now();
        if (now < user.cooldowns.pray) return message.reply("⏳ Calm down, the gods are busy.");
        user.luck += 0.1;
        user.cooldowns.pray = now + 300000;
        await user.save();
        message.reply("🙏 You prayed! Your luck is now higher.");
    }

    // ZOO (mb zoo)
    if (cmd === 'zoo') {
        let list = "";
        user.zoo.forEach((v, k) => { list += `${k} x${v}  `; });
        message.reply(`🦁 **Your Zoo:** ${list || "Empty!"}`);
    }

    // MARRY (mb marry)
    if (cmd === 'marry') {
        const target = message.mentions.users.first();
        if (!target) return message.reply("💍 Mention someone to marry!");
        user.marriedTo = target.username;
        await user.save();
        message.reply(`🎊 You are now married to **${target.username}**!`);
    }
    
    // GIVE (mb give)
    if (cmd === 'give') {
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (!target || !amt || amt > user.cash) return message.reply("❌ Invalid user or amount!");
        
        user.cash -= amt;
        await user.save();
        
        let tData = await User.findOne({ userId: target.id });
        if (tData) { tData.cash += amt; await tData.save(); }
        
        message.reply(`💸 Sent **${amt} mb cash** to ${target.username}!`);
    }
});

// Button Interaction Handler
client.on('interactionCreate', async i => {
    if (!i.isButton()) return;
    if (i.customId === 'v') {
        await User.findOneAndUpdate({ userId: i.user.id }, { accepted: true });
        await i.update({ content: "✅ Rules accepted! Type `mb h` to begin.", components: [] });
    }
});

client.login(process.env.TOKEN);

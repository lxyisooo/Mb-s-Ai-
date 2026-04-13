const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const User = require('./User');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "mb";

// Connect to your MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => console.log("🍃 Connected to MongoDB"));

client.once('ready', () => console.log(`🚀 Wimble Omega Pro is Live!`));

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Fetch user from DB
    let user = await User.findOne({ userId: message.author.id });
    if (!user) user = await User.create({ userId: message.author.id });

    // --- RULES GATE ---
    if (!user.accepted && !['help', 'rules'].includes(command)) {
        return message.reply("⚠️ **Verification Required!** Use `mb help` to accept the rules first.");
    }

    // --- 1. SLOTS (mb s / mb slots) ---
    if (command === 's' || command === 'slots') {
        const bet = parseInt(args[0]);
        if (!bet || bet > user.cash || bet < 10) return message.reply("❌ Usage: `mb slots [amount]`");

        const items = ['💎', '🍒', '🌟', '🍀'];
        const res = [items[Math.floor(Math.random()*4)], items[Math.floor(Math.random()*4)], items[Math.floor(Math.random()*4)]];
        const win = res[0] === res[1] && res[1] === res[2];

        user.cash += win ? bet * 5 : -bet;
        await user.save();

        message.reply({ embeds: [new EmbedBuilder()
            .setTitle("🎰 SLOTS")
            .setDescription(`**[ ${res.join(' | ')} ]**\n\n${win ? `🔥 **WIN!** +${bet*5} mb cash` : `❌ **LOSS!** -${bet} mb cash`}`)
            .setColor(win ? "#00FF00" : "#FF0000")] 
        });
    }

    // --- 2. HUNT (mb h / mb hunt) ---
    if (command === 'h' || command === 'hunt') {
        const now = Date.now();
        if (now < user.cooldowns.hunt) return message.reply(`⏳ Wait ${Math.ceil((user.cooldowns.hunt - now)/1000)}s!`);

        const animals = [{n: "Rabbit", e: "🐰", m: 40}, {n: "Fox", e: "🦊", m: 100}, {n: "Tiger", e: "🐯", m: 400}];
        const result = animals[Math.floor(Math.random() * animals.length)];

        user.cash += result.m;
        user.zoo.set(result.e, (user.zoo.get(result.e) || 0) + 1);
        user.cooldowns.hunt = now + 15000;
        await user.save();
        message.reply(`🏹 **${message.author.username}** caught a **${result.n} ${result.e}**! (+${result.m} mb cash)`);
    }

    // --- 3. PROFILE (mb p / mb profile) ---
    if (command === 'p' || command === 'profile') {
        const embed = new EmbedBuilder()
            .setTitle(`${message.author.username.toUpperCase()}'S STATS`)
            .addFields(
                { name: "💰 Balance", value: `${user.cash} mb cash`, inline: true },
                { name: "⚔️ Weapon", value: user.weapon, inline: true },
                { name: "💍 Partner", value: user.marriedTo || "Single", inline: true }
            ).setColor("#5865F2");
        message.reply({ embeds: [embed] });
    }

    // --- 4. BATTLE (mb b / mb battle) ---
    if (command === 'b' || command === 'battle') {
        const win = Math.random() < (user.weapon.includes("Blade") ? 0.75 : 0.45);
        if (win) {
            const gain = 500;
            user.cash += gain;
            message.reply(`⚔️ **Victory!** You won **${gain} mb cash**!`);
        } else {
            message.reply(`💀 **Defeat!** Better luck next time.`);
        }
        await user.save();
    }

    // --- 5. SHOP & BUY (mb buy) ---
    if (command === 'shop') {
        message.reply({ embeds: [new EmbedBuilder().setTitle("🛒 SHOP").setDescription("`mb buy ring` (5000)\n`mb buy blade` (3000)")] });
    }

    if (command === 'buy') {
        const item = args[0]?.toLowerCase();
        if (item === 'ring' && user.cash >= 5000) {
            user.cash -= 5000; user.inventory.push("Diamond Ring");
            message.reply("💍 Bought a **Diamond Ring**!");
        } else if (item === 'blade' && user.cash >= 3000) {
            user.cash -= 3000; user.weapon = "Iron Blade";
            message.reply("⚔️ Equipped **Iron Blade**!");
        } else {
            message.reply("❌ Invalid item or insufficient mb cash.");
        }
        await user.save();
    }

    // --- 6. HELP (Fixed Trigger) ---
    if (command === 'help') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('v').setLabel('Accept Rules').setStyle(ButtonStyle.Success)
        );
        const msg = await message.reply({ content: "📜 **Rules:** Don't spam, have fun.\nClick below to verify.", components: [row] });
        
        const collector = msg.createMessageComponentCollector({ time: 30000 });
        collector.on('collect', async i => {
            if (i.customId === 'v') {
                user.accepted = true; await user.save();
                i.update({ content: "✅ You are now verified! Type `mb h` to start.", components: [] });
            }
        });
    }
});

client.login(process.env.TOKEN);

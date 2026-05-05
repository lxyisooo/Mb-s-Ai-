const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

const app = express();
app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(process.env.PORT || 3000);

const User = mongoose.model('AdoptMeUser', new mongoose.Schema({
    userId: String,
    bucks: { type: Number, default: 500 },
    inventory: [{ name: String, rarity: String, emoji: String }]
}));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// --- UPDATED PREFIX ---
const PREFIX = "m?";

const DATA = {
    rarities: [
        { n: 'Common', c: '#95a5a6', p: 0.6, pets: [{n:'Dog', e:'🐶'}, {n:'Cat', e:'🐱'}] },
        { n: 'Rare', c: '#3498db', p: 0.25, pets: [{n:'Unicorn', e:'🦄'}, {n:'Shiba Inu', e:'🐕'}] },
        { n: 'Ultra-Rare', c: '#9b59b6', p: 0.1, pets: [{n:'Flamingo', e:'🦩'}, {n:'Yeti', e:'❄️'}] },
        { n: 'LEGENDARY', c: '#f1c40f', p: 0.05, pets: [{n:'Shadow Dragon', e:'💀'}, {n:'Frost Dragon', e:'❄️🐉'}] }
    ]
};

client.once('ready', async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Logged in as ${client.user.tag}! Prefix is ${PREFIX}`);
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;

    const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    let u = await User.findOne({ userId: msg.author.id }) || await User.create({ userId: msg.author.id });

    // --- HELP COMMAND ---
    if (cmd === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle("🐾 Adopt Me Simulator Help")
            .setDescription(`Current Prefix: \`${PREFIX}\``)
            .setColor('#ff9900')
            .addFields(
                { name: '🥚 Getting Started', value: `\`${PREFIX}hatch\` - Buy an egg for $250\n\`${PREFIX}work\` - Earn Bucks` },
                { name: '🎒 Management', value: `\`${PREFIX}inv\` - See your pets\n\`${PREFIX}trade @user [id]\` - Trade a pet` },
                { name: '✨ Fusion', value: `\`${PREFIX}make-neon [name]\` - Fuse 4 same pets into a Neon!` },
                { name: '💰 Economy', value: `Your Balance: **$${u.bucks}**` }
            )
            .setFooter({ text: "Try to hatch a LEGENDARY Shadow Dragon! 💀" });

        return msg.reply({ embeds: [helpEmbed] });
    }

    // --- HATCH COMMAND ---
    if (cmd === 'hatch') {
        if (u.bucks < 250) return msg.reply("❌ Too broke! You need $250. Go `m?work`.");
        u.bucks -= 250;
        await u.save();

        const hatchMsg = await msg.channel.send("🥚 **Buying Egg...**");
        const frames = ["🥚 *Egg is wobbling...*", "🥚 *Crack appearing...*", "💥 **BOOM!**"];
        
        for (const frame of frames) {
            await new Promise(r => setTimeout(r, 1200));
            await hatchMsg.edit(frame);
        }

        const rng = Math.random();
        let roll = 0;
        let rarity = DATA.rarities[0];
        for (const r of DATA.rarities) {
            roll += r.p;
            if (rng <= roll) { rarity = r; break; }
        }
        const pet = rarity.pets[Math.floor(Math.random() * rarity.pets.length)];

        u.inventory.push({ name: pet.n, rarity: rarity.n, emoji: pet.e });
        await u.save();

        const res = new EmbedBuilder()
            .setTitle(`${rarity.n.toUpperCase()} HATCH!`)
            .setDescription(`You just got: ${pet.e} **${pet.n}**`)
            .setColor(rarity.c);
        
        await hatchMsg.edit({ content: "✨ **Hatched!**", embeds: [res] });
    }

    // --- WORK COMMAND ---
    if (cmd === 'work') {
        const amt = Math.floor(Math.random() * 80) + 40;
        u.bucks += amt;
        await u.save();
        msg.reply(`💰 You worked as a Pet Groomer and earned **$${amt}**!`);
    }

    // --- INVENTORY COMMAND ---
    if (cmd === 'inv' || cmd === 'inventory') {
        if (u.inventory.length === 0) return msg.reply("You have no pets. Go hatch some!");
        
        const list = u.inventory.map((p, i) => `\`${i+1}\` ${p.emoji} **${p.name}** [${p.rarity}]`).join('\n');
        const invEmbed = new EmbedBuilder()
            .setTitle(`🎒 ${msg.author.username}'s Pets`)
            .setDescription(list.substring(0, 4000))
            .setColor('#3498db')
            .setFooter({ text: `Balance: $${u.bucks}` });

        msg.reply({ embeds: [invEmbed] });
    }

    // --- NEON COMMAND ---
    if (cmd === 'make-neon') {
        const petName = args.join(" ").toLowerCase();
        const dups = u.inventory.filter(p => p.name.toLowerCase() === petName);

        if (dups.length < 4) return msg.reply(`❌ You need 4 of the same pet! You only have ${dups.length} ${petName}s.`);

        let count = 0;
        u.inventory = u.inventory.filter(p => {
            if (p.name.toLowerCase() === petName && count < 4) {
                count++;
                return false;
            }
            return true;
        });

        u.inventory.push({ name: `Neon ${petName}`, rarity: 'NEON', emoji: '🌟' });
        await u.save();
        msg.reply(`🌈 **NEON SUCCESS!** You fused your ${petName}s into a **Neon ${petName}**!`);
    }
});

client.login(process.env.TOKEN);

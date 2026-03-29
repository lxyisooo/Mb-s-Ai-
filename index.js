const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios'); 

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// --- DATABASE (In-Memory) ---
let db = { cash: {}, marry: {}, items: {}, daily: {}, messages: {}, streaks: {}, lastMsg: {}, bday: {} };

// --- COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 View all commands'),
    new SlashCommandBuilder().setName('chat').setDescription('💬 Talk to Me').addStringOption(o => o.setName('msg').setDescription('Your message').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Get a random meme'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('🎂 Set your birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('e.g. 27/02').setRequired(true)),
    new SlashCommandBuilder().setName('rank').setDescription('📊 Check your message count'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setDescription('User 1').setRequired(true)).addUserOption(o => o.setName('u2').setDescription('User 2').setRequired(true)),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Enter the Casino Hub'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check your balance'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn cash'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim daily 1k'),
    new SlashCommandBuilder().setName('🚀').setDescription('This').addStringOption(o => o.setName('t').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Amount')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🔥 WIMBLE OMEGA IS LIVE!");
    } catch (e) { console.error(e); }
});

// --- MESSAGE TRACKING ---
client.on('messageCreate', (m) => {
    if (m.author.bot) return;
    const uid = m.author.id;
    db.messages[uid] = (db.messages[uid] || 0) + 1;
    db.cash[uid] = (db.cash[uid] || 500) + 2;
});

// --- INTERACTIONS ---
client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    if (i.isButton()) {
        if (i.customId === 'gamble_slots') {
            if (db.cash[uid] < 100) return i.reply({ content: "❌ Not enough cash!", ephemeral: true });
            db.cash[uid] -= 100;
            const ems = ['💎', '🍎', '⭐'];
            const s = [ems[Math.floor(Math.random()*3)], ems[Math.floor(Math.random()*3)], ems[Math.floor(Math.random()*3)]];
            const win = s[0] === s[1] && s[1] === s[2];
            if (win) db.cash[uid] += 2000;
            return i.reply(`🎰 [ ${s[0]} | ${s[1]} | ${s[2]} ]\n${win ? '✨ **JACKPOT!** Won 2000!' : '💀 Try again.'}`);
        }
    }

    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'bal') return i.reply(`💰 **Balance:** ${CURRENCY}${db.cash[uid]}`);

    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 150) + 50;
        db.cash[uid] += gain;
        return i.reply(`🔨 You earned ${CURRENCY}${gain}!`);
    }

    if (i.commandName === 'daily') {
        const last = db.daily[uid] || 0;
        if (Date.now() - last < 86400000) return i.reply({ content: "❌ Wait 24h!", ephemeral: true });
        db.cash[uid] += 1000; db.daily[uid] = Date.now();
        return i.reply("📆 Claimed your 1k!");
    }

    if (i.commandName === 'rank') {
        const msgs = db.messages[uid] || 0;
        return i.reply(`📊 **Rank:** You've sent **${msgs}** messages!`);
    }

    if (i.commandName === 'ship') {
        const score = Math.floor(Math.random() * 101);
        return i.reply(`❤️ **Ship Meter:** ${i.options.getUser('u1')} x ${i.options.getUser('u2')} is a **${score}%** match!`);
    }

    if (i.commandName === 'chat') {
        const msg = i.options.getString('msg').toLowerCase();
        let resp = "Interesting! Tell me more.";
        if (msg.includes("hello") || msg.includes("hi")) resp = "Yo! How's it going?";
        return i.reply(`💬 **Wimble:** ${resp}`);
    }

    if (i.commandName === 'gamble') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gamble_slots').setLabel('🎰 Slots (100)').setStyle(ButtonStyle.Primary)
        );
        return i.reply({ content: "🎰 **Casino Hub**", components: [row] });
    }

    if (i.commandName === 'meme') {
        await i.deferReply();
        try {
            const res = await axios.get('https://meme-api.com/gimme');
            const embed = new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor(BOT_COLOR);
            return i.editReply({ embeds: [embed] });
        } catch (e) { return i.editReply("❌ Error fetching meme."); }
    }

    if (i.commandName === 'spam' && uid === OWNER_ID) {
        const text = i.options.getString('t');
        const amt = i.options.getInteger('a') || 5;
        await i.reply({ content: "🚀", ephemeral: true });
        for (let x = 0; x < Math.min(amt, 15); x++) { 
            await i.channel.send(text); 
            await new Promise(r => setTimeout(r, 500)); 
        }
    }
}); // <--- THIS WAS MISSING

client.login(process.env.DISCORD_TOKEN); // <--- THIS WAS MISSINGout(r, 460)); 
        }
            }
} // Closes the spam command 'if'
}); // Closes the interactionCreate 'on'

client.login(process.env.DISCORD_TOKEN);

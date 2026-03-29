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

// --- GHOST PING HELPER ---
async function ghostPing(channel, user) {
    const msg = await channel.send(`${user}`);
    return msg.delete().catch(() => {}); 
}

// --- COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 View all commands'),
    new SlashCommandBuilder().setName('chat').setDescription('💬 Talk to Me').addStringOption(o => o.setName('msg').setDescription('Your message to the bot').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Get a random meme from Reddit'), // FIXED THIS LINE
    new SlashCommandBuilder().setName('setbirthday').setDescription('🎂 Set your birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('e.g. 27/02').setRequired(true)),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 See the top 10 richest members'),
    new SlashCommandBuilder().setName('rank').setDescription('📊 Check your message count'),
    new SlashCommandBuilder().setName('streak').setDescription('🔥 View your daily activity streak'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setDescription('First person').setRequired(true)).addUserOption(o => o.setName('u2').setDescription('Second person').setRequired(true)),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View your profile card').addUserOption(o => o.setName('u').setDescription('User to view')),
    new SlashCommandBuilder().setName('shop').setDescription('🛍️ Visit the Luxury Mall'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Enter the Casino Hub'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check your wallet balance'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn some extra cash'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim your daily 1k reward'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Get server stats'),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Spam a message').addStringOption(o => o.setName('t').setDescription('Text to spam').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Amount of messages')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🔥 WIMBLE OMEGA IS LIVE!");
    } catch (e) { console.error(e); }
});

// --- MESSAGE TRACKING & BIRTHDAYS ---
client.on('messageCreate', (m) => {
    if (m.author.bot) return;
    const uid = m.author.id;
    
    db.messages[uid] = (db.messages[uid] || 0) + 1;
    db.cash[uid] = (db.cash[uid] || 500) + 2;

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    if (db.bday[uid] === today && !db.streaks[`bday_${uid}`]) {
        m.reply(`🎂 **HAPPY BIRTHDAY <@${uid}>!** Wimble gifted you ${CURRENCY}5000!`);
        db.cash[uid] += 5000;
        db.streaks[`bday_${uid}`] = true;
    }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;
    if (!db.items[uid]) db.items[uid] = { padlocks: 0 };

    if (i.isButton()) {
        if (i.customId === 'gamble_slots') {
            if (db.cash[uid] < 100) return i.reply({ content: "❌ You need 100 to play!", ephemeral: true });
            db.cash[uid] -= 100;
            await i.reply("🎰 **SPINNING...**");
            setTimeout(() => {
                const ems = ['💎', '🍎', '⭐'];
                const s = [ems[Math.floor(Math.random()*3)], ems[Math.floor(Math.random()*3)], ems[Math.floor(Math.random()*3)]];
                const win = s[0] === s[1] && s[1] === s[2];
                if (win) db.cash[uid] += 2000;
                i.editReply(`🎰 [ ${s[0]} | ${s[1]} | ${s[2]} ]\n${win ? `✨ **JACKPOT!** Won ${CURRENCY}2000!` : '💀 Better luck next time.'}`);
            }, 1000);
            return;
        }
    }

    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'setbirthday') {
        const date = i.options.getString('date');
        db.bday[uid] = date;
        return i.reply(`🎂 Birthday locked in for **${date}**!`);
    }

    if (i.commandName === 'meme') {
        try {
            const res = await axios.get('https://meme-api.com/gimme');
            const embed = new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor(BOT_COLOR);
            return i.reply({ embeds: [embed] });
        } catch { return i.reply("❌ Couldn't find a meme right now."); }
    }

    if (i.commandName === 'chat') {
        const msg = i.options.getString('msg').toLowerCase();
        let resp = "That's interesting! Tell me more.";
        if (msg.includes("hello") || msg.includes("hi")) resp = "Yo! How's it going?";
        if (msg.includes("how are you")) resp = "I'm running at 100% power!";
        return i.reply(`💬 **Wimble:** ${resp}`);
    }

    if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY}${db.cash[uid]}`);
    
    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 150) + 50;
        db.cash[uid] += gain;
        return i.reply(`🔨 You worked hard and earned ${CURRENCY}${gain}!`);
    }

    if (i.commandName === 'spam' && uid === OWNER_ID) {
        const text = i.options.getString('t');
        const amt = i.options.getInteger('a') || 5;
        await i.reply({ content: "🚀 Starting spam...", ephemeral: true });
        for (let x=0; x < Math.min(amt, 15); x++) { 
            await i.channel.send(text); 
            await new Promise(r => setTimeout(r, 500)); 
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

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
let db = { cash: {}, marry: {}, items: {}, daily: {}, messages: {}, streaks: {}, bday: {} };

// --- COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 View all commands'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Get server stats'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View your profile card').addUserOption(o => o.setName('u').setDescription('User to view')),
    new SlashCommandBuilder().setName('chat').setDescription('💬 Talk to Me').addStringOption(o => o.setName('msg').setDescription('Your message').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Get a random meme'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('🎂 Set your birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('e.g. 27/02').setRequired(true)),
    new SlashCommandBuilder().setName('rank').setDescription('📊 Check your message count'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setDescription('User 1').setRequired(true)).addUserOption(o => o.setName('u2').setDescription('User 2').setRequired(true)),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Enter the Casino Hub'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check your balance'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn cash'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim daily 1k'),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Spam').addStringOption(o => o.setName('t').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Amount')),
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
        m.reply(`🎂 **HAPPY BIRTHDAY!** Wimble gifted you ${CURRENCY}5000!`);
        db.cash[uid] += 5000;
        db.streaks[`bday_${uid}`] = true;
    }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- BUTTONS ---
    if (i.isButton()) {
        if (i.customId === 'gamble_slots') {
            if (db.cash[uid] < 100) return i.reply({ content: "❌ Not enough cash!", ephemeral: true });
            db.cash[uid] -= 100;
            const ems = ['💎', '🍎', '⭐'];
            const s = [ems[Math.floor(Math.random()*3)], ems[Math.floor(Math.random()*3)], ems[Math.floor(Math.random()*3)]];
            const win = s[0] === s[1] && s[1] === s[2];
            if (win) db.cash[uid] += 2000;
            return i.reply(`🎰 [ ${s[0]} | ${s[1]} | ${s[2]} ]\n${win ? '✨ **JACKPOT!**' : '💀 Try again.'}`);
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- UTILITY & INFO ---
    if (i.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle("📜 Wimble Help Menu")
            .setDescription("**/bal, /work, /daily** - Economy\n**/gamble** - Casino\n**/ship, /meme, /chat** - Fun\n**/rank, /profile, /serverinfo** - Utility")
            .setColor(BOT_COLOR);
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'serverinfo') {
        return i.reply(`🏢 **Server:** ${i.guild.name}\n👥 **Members:** ${i.guild.memberCount}`);
    }

    if (i.commandName === 'profile') {
        const target = i.options.getUser('u') || i.user;
        const embed = new EmbedBuilder()
            .setTitle(`${target.username}'s Profile`)
            .addFields(
                { name: '💰 Cash', value: `${CURRENCY}${db.cash[target.id] || 500}`, inline: true },
                { name: '📊 Messages', value: `${db.messages[target.id] || 0}`, inline: true }
            )
            .setColor(BOT_COLOR);
        return i.reply({ embeds: [embed] });
    }

    // --- REMAINING COMMANDS ---
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
    if (i.commandName === 'rank') return i.reply(`📊 **Rank:** You've sent **${db.messages[uid] || 0}** messages!`);
    if (i.commandName === 'setbirthday') {
        db.bday[uid] = i.options.getString('date');
        return i.reply(`🎂 Birthday set to **${db.bday[uid]}**!`);
    }
    if (i.commandName === 'ship') {
        const score = Math.floor(Math.random() * 101);
        return i.reply(`❤️ **Ship Meter:** ${i.options.getUser('u1')} x ${i.options.getUser('u2')} is a **${score}%** match!`);
    }
    if (i.commandName === 'chat') {
        return i.reply(`💬 **Wimble:** ${i.options.getString('msg').includes("hi") ? "Yo!" : "Interesting..."}`);
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
        } catch { return i.editReply("❌ Meme fail!"); }
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
});

client.login(process.env.DISCORD_TOKEN);

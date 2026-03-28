const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const http = require('http');
const axios = require('axios');

http.createServer((req, res) => { res.write("Mb's Ai is Online! 😪"); res.end(); }).listen(8080);

process.on('unhandledRejection', (reason) => { console.log(' [Anti-Crash] Rejection:', reason); });
process.on("uncaughtException", (err) => { console.log(' [Anti-Crash] Error:', err); });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const BOT_COLOR = '#00FFFF';

// Database
let db = { cash: {}, lastDaily: {}, birthdays: {}, suggestions: [], xp: {} };
let lastDeleted = { content: "Nothing to snipe!", author: "Unknown" };

// --- 1. THE COMPLETE 26 COMMANDS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('The full menu'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble cash').addIntegerOption(o => o.setName('bet').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a die'),
    new SlashCommandBuilder().setName('joke').setDescription('Random joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('See last deleted'),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('R, P, or S').setRequired(true)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 cash (24h cooldown)'),
    new SlashCommandBuilder().setName('work').setDescription('Earn money'),
    new SlashCommandBuilder().setName('bal').setDescription('Check cash'),
    new SlashCommandBuilder().setName('profile').setDescription('View profile'),
    new SlashCommandBuilder().setName('shop').setDescription('View shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send cash').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('whois').setDescription('User lookup').addUserOption(o => o.setName('target').setDescription('User')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('ping').setDescription('Check speed'),
    new SlashCommandBuilder().setName('roles').setDescription('List roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('DD/MM').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('Check birthday').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('calculate').setDescription('Math solver').addStringOption(o => o.setName('exp').setDescription('Expression').setRequired(true)),
    new SlashCommandBuilder().setName('suggest').setDescription('Suggestion').addStringOption(o => o.setName('msg').setDescription('Idea').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ Mb's Ai: All 26 Commands Fully Loaded!");
    } catch (e) { console.error(e); }
});

// --- 2. MASTER LOGIC HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply(); 

    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    switch (i.commandName) {
        case 'help':
            const h = new EmbedBuilder().setTitle("🤖 Mb's Ai - Super Menu").addFields(
                { name: "🎮 Fun", value: "`8ball`, `slots`, `flip`, `roll`, `joke`, `fact`, `snipe`, `rps`, `weather`" },
                { name: "💰 Economy", value: "`daily`, `work`, `bal`, `profile`, `shop`, `buy`, `pay`" },
                { name: "🛠️ Utility", value: "`whois`, `avatar`, `ping`, `roles`, `stats`, `serverinfo`, `setbirthday`, `checkbirthday`, `calculate`, `suggest`" }
            ).setColor(BOT_COLOR);
            return i.editReply({ embeds: [h] });

        case '8ball': return i.editReply(`🎱 **Answer:** ${["Yes", "No", "Maybe", "Probably", "Never"][Math.floor(Math.random()*5)]}`);
        case 'slots':
            const bet = i.options.getInteger('bet');
            if (db.cash[uid] < bet) return i.editReply("❌ You don't have enough cash!");
            const win = Math.random() > 0.7;
            db.cash[uid] += win ? bet : -bet;
            return i.editReply(win ? `🎰 **WIN!** You won **${bet * 2} cash!**` : `🎰 **LOST!** You lost **${bet} cash.**`);
        case 'flip': return i.editReply(`🪙 It's **${Math.random() > 0.5 ? "Heads" : "Tails"}**!`);
        case 'roll': return i.editReply(`🎲 You rolled a **${Math.floor(Math.random()*6)+1}**!`);
        case 'joke': return i.editReply("Why don't scientists trust atoms? Because they make up everything! 😂");
        case 'fact': return i.editReply("Did you know? Honey never spoils. 🍯");
        case 'snipe': return i.editReply(`🎯 **Last Deleted:** ${lastDeleted.content} (by ${lastDeleted.author})`);
        case 'weather': return i.editReply(`🌤️ Weather in **${i.options.getString('city')}**: Clear, 22°C (Simulated)`);
        case 'rps': return i.editReply(`✂️ I chose **Rock**! You chose **${i.options.getString('choice')}**.`);
        case 'daily':
            const now = Date.now();
            if (now - (db.lastDaily[uid] || 0) < 86400000) return i.editReply("⏳ Wait 24h!");
            db.cash[uid] += 100; db.lastDaily[uid] = now;
            return i.editReply("💵 +100 cash! ✅");
        case 'work': 
            const e = Math.floor(Math.random()*50)+20; db.cash[uid] += e;
            return i.editReply(`💼 You earned **${e} cash**!`);
        case 'bal': return i.editReply(`💰 **Wallet:** ${db.cash[uid]} cash`);
        case 'profile': return i.editReply(`👤 **Profile:** ${i.user.username}\n💰 **Cash:** ${db.cash[uid]}`);
        case 'shop': return i.editReply("🛒 **Shop:** VIP Role (1000), Custom Color (500)");
        case 'buy': return i.editReply(`✅ You bought **${i.options.getString('item')}**!`);
        case 'pay': 
            const target = i.options.getUser('user'); const amt = i.options.getInteger('amt');
            if (db.cash[uid] < amt) return i.editReply("❌ No money!");
            db.cash[uid] -= amt; db.cash[target.id] = (db.cash[target.id] || 0) + amt;
            return i.editReply(`💸 Sent **${amt}** to ${target.username}!`);
        case 'whois':
            const u = i.options.getUser('target') || i.user;
            return i.editReply(`👤 **User:** ${u.username}\n🆔 **ID:** \`${u.id}\``);
        case 'avatar': return i.editReply(i.options.getUser('user')?.displayAvatarURL() || i.user.displayAvatarURL());
        case 'ping': return i.editReply(`🏓 Latency: \`${client.ws.ping}ms\``);
        case 'roles': return i.editReply(`📜 Server has **${i.guild.roles.cache.size}** roles.`);
        case 'stats': return i.editReply(`🤖 Online in **${client.guilds.cache.size}** servers.`);
        case 'serverinfo': return i.editReply(`🏰 **Server:** ${i.guild.name}\n👥 **Members:** ${i.guild.memberCount}`);
        case 'setbirthday': db.birthdays[uid] = i.options.getString('date'); return i.editReply("🎂 Birthday set!");
        case 'checkbirthday': return i.editReply(`📅 Birthday: ${db.birthdays[i.options.getUser('user')?.id || uid] || "Not set"}`);
        case 'calculate': 
            try { return i.editReply(`🧮 Result: **${eval(i.options.getString('exp'))}**`); } 
            catch { return i.editReply("❌ Invalid math!"); }
        case 'suggest': db.suggestions.push(i.options.getString('msg')); return i.editReply("✅ Suggestion saved!");
    }
});

// --- 3. AI HANDLER (EDITING + REACTIONS) ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user) || !m.guild) {
        await m.react('👀');
        const thinking = await m.reply("🤖 *Thinking...*");
        try {
            const res = await axios.get(`https://api.simsimi.vn/v1/simtalk?text=${encodeURIComponent(m.content)}&lc=en`);
            return thinking.edit(res.data.message || "😪");
        } catch { return thinking.edit("😪"); }
    }
});

client.on('messageDelete', (m) => {
    if (m.author?.bot) return;
    lastDeleted = { content: m.content || "Embed/Image", author: m.author?.tag || "Unknown" };
});

client.login(process.env.DISCORD_TOKEN);

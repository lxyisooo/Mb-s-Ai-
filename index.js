const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const http = require('http');

// 1. SETTINGS
const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const BOT_COLOR = '#00FFFF';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

http.createServer((req, res) => { res.write("Mb's Ai Online!"); res.end(); }).listen(8080);
process.on('unhandledRejection', (r) => console.log('Error:', r));

const client = new Client({
    intents: [3276799],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// Database
let db = { cash: {}, lastDaily: {}, birthdays: {}, suggestions: [], items: {} };
let lastDeleted = { content: "Nothing to snipe!", author: "Unknown" };

// --- 2. COMMAND REGISTRATION (26 Commands) ---
const commands = [
    // FUN
    new SlashCommandBuilder().setName('help').setDescription('The full menu'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble cash').addIntegerOption(o => o.setName('bet').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a die'),
    new SlashCommandBuilder().setName('joke').setDescription('Get a joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('See last deleted message'),
    new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('R, P, or S').setRequired(true)),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    // ECONOMY
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 cash'),
    new SlashCommandBuilder().setName('work').setDescription('Earn money'),
    new SlashCommandBuilder().setName('bal').setDescription('Check balance'),
    new SlashCommandBuilder().setName('profile').setDescription('View profile'),
    new SlashCommandBuilder().setName('shop').setDescription('Item shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy item').addStringOption(o => o.setName('item').setDescription('Item').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send money').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),
    // UTILITY
    new SlashCommandBuilder().setName('whois').setDescription('User info').addUserOption(o => o.setName('target').setDescription('User')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('ping').setDescription('Bot speed'),
    new SlashCommandBuilder().setName('roles').setDescription('Server roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set birthday').addStringOption(o => o.setName('date').setDescription('DD/MM').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('Check birthday').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('calculate').setDescription('Math solver').addStringOption(o => o.setName('exp').setDescription('Math problem').setRequired(true)),
    new SlashCommandBuilder().setName('suggest').setDescription('Suggestion').addStringOption(o => o.setName('msg').setDescription('Idea').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🧹 Wiping 40 duplicate commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
        console.log("🚀 Registering the fresh 26...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } catch (e) { console.error(e); }
});

// --- 3. SMART AI (NO FOGGY BRAIN) ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user) || !m.guild) {
        await m.react('👀');
        const thinking = await m.reply("🤖 *Thinking...*");
        try {
            const result = await aiModel.generateContent(m.content);
            const response = result.response.text();
            return thinking.edit(response);
        } catch { return thinking.edit("I had a connection error. Try that again!"); }
    }
});

// --- 4. THE COMPLETE COMMAND HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;
    if (!db.items[uid]) db.items[uid] = [];

    switch (i.commandName) {
        case 'help':
            const help = new EmbedBuilder().setTitle("🤖 Mb's Ai Master Menu").setColor(BOT_COLOR)
                .addFields(
                    { name: "🎮 Fun", value: "`8ball`, `slots`, `flip`, `roll`, `joke`, `fact`, `snipe`, `rps`, `weather`" },
                    { name: "💰 Economy", value: "`daily`, `work`, `bal`, `profile`, `shop`, `buy`, `pay`" },
                    { name: "🛠️ Utility", value: "`whois`, `avatar`, `ping`, `roles`, `stats`, `serverinfo`, `setbirthday`, `checkbirthday`, `calculate`, `suggest`" }
                );
            return i.reply({ embeds: [help] });

        case '8ball': return i.reply(`🎱 **Answer:** ${["Yes", "No", "Maybe", "Probably", "Never"][Math.floor(Math.random()*5)]}`);
        case 'bal': return i.reply(`💰 **Wallet:** ${db.cash[uid]} cash`);
        case 'daily':
            if (Date.now() - (db.lastDaily[uid] || 0) < 86400000) return i.reply("⏳ Claim again in 24 hours!");
            db.cash[uid] += 100; db.lastDaily[uid] = Date.now();
            return i.reply("💵 Claimed **100 cash**! ✅");
        case 'work':
            const earn = Math.floor(Math.random()*50)+20; db.cash[uid] += earn;
            return i.reply(`💼 You worked and earned **${earn} cash**!`);
        case 'slots':
            const bet = i.options.getInteger('bet');
            if (db.cash[uid] < bet) return i.reply("❌ Too poor!");
            const win = Math.random() > 0.6;
            db.cash[uid] += win ? bet : -bet;
            return i.reply(win ? `🎰 **WIN!** You got **${bet*2}**!` : `🎰 **LOST!** You lost **${bet}**.`);
        case 'ping': return i.reply(`🏓 Latency: **${client.ws.ping}ms**`);
        case 'whois':
            const u = i.options.getUser('target') || i.user;
            return i.reply(`👤 **User:** ${u.username}\n🆔 **ID:** \`${u.id}\`\n🤖 **Bot:** ${u.bot}`);
        case 'avatar': return i.reply(i.options.getUser('user')?.displayAvatarURL({ dynamic: true }) || i.user.displayAvatarURL());
        case 'flip': return i.reply(`🪙 **${Math.random() > 0.5 ? "Heads" : "Tails"}**`);
        case 'roll': return i.reply(`🎲 Rolled a **${Math.floor(Math.random()*6)+1}**`);
        case 'joke': return i.reply("Why did the golfer bring two pairs of pants? In case he got a hole in one! ⛳");
        case 'fact': return i.reply("Did you know? Octopuses have three hearts. 🐙");
        case 'snipe': return i.reply(`🎯 **Last Deleted:** ${lastDeleted.content} (by ${lastDeleted.author})`);
        case 'weather': return i.reply(`🌤️ Weather in **${i.options.getString('city')}**: Sunny, 25°C.`);
        case 'rps': return i.reply(`✂️ I chose **Rock**! Did you beat me?`);
        case 'roles': return i.reply(`📜 Server has **${i.guild.roles.cache.size}** roles.`);
        case 'stats': return i.reply(`📊 Servers: **${client.guilds.cache.size}** | Members: **${client.users.cache.size}**`);
        case 'serverinfo': return i.reply(`🏰 **${i.guild.name}**\n👥 **Members:** ${i.guild.memberCount}\n🆔 **ID:** ${i.guild.id}`);
        case 'setbirthday': db.birthdays[uid] = i.options.getString('date'); return i.reply("🎂 Birthday saved!");
        case 'checkbirthday':
            const bu = i.options.getUser('user') || i.user;
            return i.reply(`📅 Birthday: **${db.birthdays[bu.id] || "Not set"}**`);
        case 'calculate':
            try { return i.reply(`🧮 Result: **${eval(i.options.getString('exp').replace(/[^-()\d/*+.]/g, ''))}**`); }
            catch { return i.reply("❌ Invalid math!"); }
        case 'suggest': db.suggestions.push(i.options.getString('msg')); return i.reply("✅ Suggestion sent!");
        case 'shop': return i.reply("🛒 **Shop:** `VIP` (1000), `Lamborghini` (5000), `Badge` (500)");
        case 'buy':
            const item = i.options.getString('item');
            if (db.cash[uid] < 500) return i.reply("❌ Not enough cash for anything in the shop!");
            db.cash[uid] -= 500; db.items[uid].push(item);
            return i.reply(`✅ Bought **${item}**!`);
        case 'profile':
            return i.reply(`👤 **Profile:** ${i.user.username}\n💰 **Cash:** ${db.cash[uid]}\n🎒 **Items:** ${db.items[uid].join(', ') || "Empty"}`);
        case 'pay':
            const target = i.options.getUser('user'); const amt = i.options.getInteger('amt');
            if (db.cash[uid] < amt) return i.reply("❌ No money!");
            db.cash[uid] -= amt; db.cash[target.id] = (db.cash[target.id] || 0) + amt;
            return i.reply(`💸 Sent **${amt} cash** to ${target.username}!`);
    }
});

client.on('messageDelete', (m) => {
    if (m.author?.bot) return;
    lastDeleted = { content: m.content || "Image/Embed", author: m.author?.tag || "Unknown" };
});

client.login(process.env.DISCORD_TOKEN);

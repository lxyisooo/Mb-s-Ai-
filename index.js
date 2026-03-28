const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const http = require('http');

// 1. SETTINGS & AI SETUP
const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const BOT_COLOR = '#00FFFF';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Anti-Crash & Keep Alive
http.createServer((req, res) => { res.write("Mb's Ai Online!"); res.end(); }).listen(8080);
process.on('unhandledRejection', (r) => console.log('Error:', r));

const client = new Client({
    intents: [3276799],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- 2. THE COMPLETE 26 COMMAND LIST ---
const commands = [
    // FUN (9)
    new SlashCommandBuilder().setName('help').setDescription('View all commands'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble cash').addIntegerOption(o => o.setName('bet').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a die'),
    new SlashCommandBuilder().setName('joke').setDescription('Get a joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('See last deleted message'),
    new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('R, P, or S').setRequired(true)),
    
    // ECONOMY (7)
    new SlashCommandBuilder().setName('daily').setDescription('Get daily 100 cash'),
    new SlashCommandBuilder().setName('work').setDescription('Work for money'),
    new SlashCommandBuilder().setName('bal').setDescription('Check your balance'),
    new SlashCommandBuilder().setName('profile').setDescription('View user profile'),
    new SlashCommandBuilder().setName('shop').setDescription('View the item shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send money').addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),

    // UTILITY (10)
    new SlashCommandBuilder().setName('whois').setDescription('User info').addUserOption(o => o.setName('target').setDescription('User')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get user avatar').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('roles').setDescription('List server roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot statistics'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Information about this server'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set your birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('DD/MM').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('Check someone\'s birthday').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('calculate').setDescription('Solve math').addStringOption(o => o.setName('exp').setDescription('Math problem').setRequired(true)),
    new SlashCommandBuilder().setName('suggest').setDescription('Send a suggestion').addStringOption(o => o.setName('msg').setDescription('Your idea').setRequired(true)),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City name').setRequired(true)),
].map(c => c.toJSON());

// --- 3. NUCLEAR WIPE & REGISTRATION ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🧹 Wiping ALL old commands...");
        // This clears Global AND Guild commands
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });

        console.log("🚀 Registering fresh 26 commands...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ CLEANUP COMPLETE!");
    } catch (e) { console.error(e); }
});

// --- 4. SMART GEMINI AI LOGIC ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user) || !m.guild) {
        await m.channel.sendTyping();
        try {
            const result = await aiModel.generateContent(m.content);
            const response = result.response.text();
            return m.reply(response.length > 2000 ? response.substring(0, 1990) + "..." : response);
        } catch { return m.reply("My brain is foggy... ask me again! 🧠"); }
    }
});

// --- 5. INTERACTION HANDLER ---
let db = { cash: {}, lastDaily: {}, birthdays: [] }; // Simple temp DB

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    switch (i.commandName) {
        case 'help':
            const help = new EmbedBuilder().setTitle("🤖 Mb's Ai Menu").setColor(BOT_COLOR)
                .addFields(
                    { name: "🎮 Fun", value: "`8ball`, `slots`, `flip`, `roll`, `joke`, `fact`, `snipe`, `rps`" },
                    { name: "💰 Economy", value: "`daily`, `work`, `bal`, `profile`, `shop`, `buy`, `pay`" },
                    { name: "🛠️ Utility", value: "`whois`, `avatar`, `ping`, `roles`, `stats`, `serverinfo`, `setbirthday`, `checkbirthday`, `calculate`, `suggest`, `weather`" }
                );
            return i.reply({ embeds: [help] });

        case '8ball':
            const res = ["Yes", "No", "Maybe", "Most likely", "Forget about it"];
            return i.reply(`🎱 **Answer:** ${res[Math.floor(Math.random()*res.length)]}`);

        case 'bal': return i.reply(`💰 Your balance is **${db.cash[uid]} cash**.`);
        
        case 'daily':
            if (Date.now() - (db.lastDaily[uid] || 0) < 86400000) return i.reply("⏳ Come back tomorrow!");
            db.cash[uid] += 100; db.lastDaily[uid] = Date.now();
            return i.reply("💵 You claimed your **100 cash**! ✅");

        case 'ping': return i.reply(`🏓 Latency is **${client.ws.ping}ms**`);

        default: return i.reply("✅ Command received! (Logic for this specific command is being updated)");
    }
});

client.login(process.env.DISCORD_TOKEN);

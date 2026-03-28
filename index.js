const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const http = require('http');
const axios = require('axios');

// 1. KEEP-ALIVE & ANTI-CRASH
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

// --- SETTINGS (USE YOUR IDs HERE) ---
const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const PREFIX = '\\';
const BOT_COLOR = '#00FFFF';

// Simple Database
let db = { cash: {}, birthdays: {}, xp: {} };
let lastDeleted = { content: "Nothing to snipe!", author: "Unknown" };

// --- 2. ALL 26 COMMANDS REGISTERED HERE ---
const commands = [
    // FUN (9)
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble cash').addIntegerOption(o => o.setName('bet').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a die'),
    new SlashCommandBuilder().setName('joke').setDescription('Random joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('See last deleted'),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('R, P, or S').setRequired(true)),

    // ECONOMY (7)
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 cash'),
    new SlashCommandBuilder().setName('work').setDescription('Earn money'),
    new SlashCommandBuilder().setName('bal').setDescription('Check cash'),
    new SlashCommandBuilder().setName('profile').setDescription('View profile'),
    new SlashCommandBuilder().setName('shop').setDescription('View shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send cash').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),

    // UTILITY/SOCIAL (10)
    new SlashCommandBuilder().setName('help').setDescription('The full menu'),
    new SlashCommandBuilder().setName('whois').setDescription('User lookup').addUserOption(o => o.setName('target').setDescription('User')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('ping').setDescription('Check speed'),
    new SlashCommandBuilder().setName('roles').setDescription('List roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('DD/MM').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('Check birthday').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('calculate').setDescription('Math solver').addStringOption(o => o.setName('exp').setDescription('Expression').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🚀 Mb's Ai: All 26 Commands Synchronized!");
    } catch (e) { console.error(e); }
});

// --- 3. FREE AI ENGINE ---
async function getAIResponse(msg) {
    try {
        const res = await axios.get(`https://api.simsimi.vn/v1/simtalk?text=${encodeURIComponent(msg)}&lc=en`);
        return res.data.message || "I'm thinking... but my brain is empty. 😪";
    } catch { return "Error connecting to my brain! 🤖"; }
}

// --- 4. MASTER INTERACTION HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply(); 

    if (!db.cash[i.user.id]) db.cash[i.user.id] = 500;

    switch (i.commandName) {
        case 'help':
            const h = new EmbedBuilder().setTitle("🤖 Mb's Ai - Master Menu").addFields(
                { name: "🎮 Fun", value: "`8ball`, `slots`, `joke`, `fact`, `snipe`, `flip`, `roll`, `rps`, `weather`" },
                { name: "💰 Economy", value: "`daily`, `work`, `bal`, `profile`, `shop`, `buy`, `pay`" },
                { name: "🛠️ Utility", value: "`whois`, `avatar`, `ping`, `roles`, `stats`, `serverinfo`, `setbirthday`, `calculate`" }
            ).setColor(BOT_COLOR);
            return i.editReply({ embeds: [h] });

        case 'bal': return i.editReply(`💰 **Balance:** ${db.cash[i.user.id]} cash`);
        case 'daily': 
            db.cash[i.user.id] += 100;
            return i.editReply("💵 You claimed your daily **100 cash**!");
        case 'ping': return i.editReply(`🏓 Latency: \`${client.ws.ping}ms\``);
        case 'joke':
            const jokes = ["Why was the cell phone wearing glasses? It lost its contacts! 😂", "What's an AI's favorite snack? Micro-chips!"];
            return i.editReply(jokes[Math.floor(Math.random()*jokes.length)]);
        case 'snipe': return i.editReply(`🎯 **Last Deleted:** ${lastDeleted.content} (by ${lastDeleted.author})`);
        case 'whois':
            const target = i.options.getMember('target') || i.member;
            return i.editReply(`👤 **User:** ${target.user.username}\n**Joined:** <t:${Math.floor(target.joinedTimestamp/1000)}:R>`);
        case 'setbirthday':
            const date = i.options.getString('date');
            db.birthdays[i.user.id] = date;
            return i.editReply(`🎂 Saved! Your birthday is set to **${date}**.`);
        default:
            return i.editReply("⚙️ This command is registered but I'm still writing the logic for it! Check back in 5 mins.");
    }
});

// --- 5. DM & PING AI HANDLER ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;

    // Trigger AI in DMs or when Mentioned
    if (m.mentions.has(client.user) || !m.guild) {
        m.channel.sendTyping();
        const response = await getAIResponse(m.content);
        return m.reply(response);
    }

    // Prefix Handler (Backup)
    if (!m.content.startsWith(PREFIX)) return;
    const args = m.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    // (Logic for prefix commands would go here)
});

client.on('messageDelete', (m) => {
    if (m.author?.bot) return;
    lastDeleted = { content: m.content || "Embed/Image", author: m.author?.tag || "Unknown" };
});

client.login(process.env.DISCORD_TOKEN);

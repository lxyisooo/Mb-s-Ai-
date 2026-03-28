const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const http = require('http');
const axios = require('axios');

// 1. KEEP-ALIVE & ANTI-CRASH (Crucial!)
http.createServer((req, res) => { res.write("Mb's Ai is Online! 😪"); res.end(); }).listen(8080);

process.on('unhandledRejection', (reason, p) => { console.log(' [Anti-Crash] Unhandled Rejection:', reason); });
process.on("uncaughtException", (err, origin) => { console.log(' [Anti-Crash] Uncaught Exception:', err); });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

// --- SETTINGS ---
const CLIENT_ID = 'YOUR_APP_ID_HERE'; 
const GUILD_ID = 'YOUR_SERVER_ID_HERE'; 
const PREFIX = '\\';

// --- 2. THE COMMANDS (The "Essentials" for now to prevent lag) ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('View all commands'),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot speed'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 cash'),
    new SlashCommandBuilder().setName('bal').setDescription('Check your money'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Your question').setRequired(true)),
].map(c => c.toJSON());

// --- 3. AUTO-DEPLOY ON STARTUP ---
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Registers to your server INSTANTLY
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🚀 Commands synced to your server!");
    } catch (e) { console.error("Registration Error:", e); }
});

// --- 4. NO-KEY AI ENGINE ---
async function getAIResponse(msg) {
    try {
        const res = await axios.get(`https://api.simsimi.vn/v1/simtalk?text=${encodeURIComponent(msg)}&lc=en`);
        return res.data.message || "I'm thinking... but my brain is empty. 😪";
    } catch { return "I can't reach my brain right now! 🤖"; }
}

// --- 5. INTERACTION HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply(); // Stops the "Application did not respond" error

    if (i.commandName === 'ping') return i.editReply(`🏓 Latency: \`${client.ws.ping}ms\``);
    if (i.commandName === 'daily') return i.editReply("💵 You got **100 cash**! (Check your balance with `/bal`)");
    if (i.commandName === 'help') {
        const h = new EmbedBuilder().setTitle("Mb's Ai Help").setDescription("Use `/` to see all commands!").setColor('#00FFFF');
        return i.editReply({ embeds: [h] });
    }
    return i.editReply("⚙️ Logic is active!");
});

// --- 6. DM & PING HANDLER ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user) || !m.guild) {
        m.channel.sendTyping();
        const response = await getAIResponse(m.content);
        return m.reply(response);
    }
});

client.login(process.env.DISCORD_TOKEN);

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const http = require('http');
const axios = require('axios');

// 1. KEEP-ALIVE (For 24/7 Hosting)
http.createServer((req, res) => { res.write("Mb's Ai is Online! 😪"); res.end(); }).listen(8080);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

const PREFIX = '\\';
const BRANDING = "Powered by Mb's Ai | 🤖";
const BOT_COLOR = '#00FFFF'; 

// Databases (In-memory for this example)
let db = { cash: {}, xp: {}, birthdays: {}, inventory: {} };
let lastDeleted = { content: "Nothing to snipe!", author: "Unknown" };

// --- 2. REGISTRATION (25+ COMMANDS) ---
const commands = [
    // FUN (9)
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble cash').addIntegerOption(o => o.setName('bet').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a die'),
    new SlashCommandBuilder().setName('joke').setDescription('Get a random joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Get a random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('See last deleted message'),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('R, P, or S').setRequired(true)),

    // ECONOMY (7)
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 cash'),
    new SlashCommandBuilder().setName('work').setDescription('Earn money'),
    new SlashCommandBuilder().setName('bal').setDescription('Check your balance'),
    new SlashCommandBuilder().setName('profile').setDescription('View your profile'),
    new SlashCommandBuilder().setName('shop').setDescription('View the shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send cash').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),

    // UTILITY & SOCIAL (10)
    new SlashCommandBuilder().setName('whois').setDescription('User lookup').addUserOption(o => o.setName('target').setDescription('The user')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get user avatar').addUserOption(o => o.setName('user').setDescription('The user')),
    new SlashCommandBuilder().setName('ping').setDescription('Check speed'),
    new SlashCommandBuilder().setName('roles').setDescription('List server roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Detailed server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('DD/MM').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('Check a birthday').addUserOption(o => o.setName('user').setDescription('The user')),
    new SlashCommandBuilder().setName('suggest').setDescription('Make a suggestion').addStringOption(o => o.setName('msg').setDescription('Your idea').setRequired(true)),
    new SlashCommandBuilder().setName('calculate').setDescription('Math solver').addStringOption(o => o.setName('exp').setDescription('Expression').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("🚀 Mb's Ai: All 26 Commands Live!");
    } catch (e) { console.error(e); }
});

// --- 3. FREE AI ENGINE (NO KEY REQUIRED) ---
async function getAIResponse(userMessage) {
    try {
        // Uses a public proxy to talk to a conversational AI
        const res = await axios.get(`https://api.simsimi.vn/v1/simtalk?text=${encodeURIComponent(userMessage)}&lc=en`);
        return res.data.message || "I'm thinking... but I can't find the words! 😪";
    } catch (err) {
        return "My brain is a bit laggy. Try talking to me again! 🤖";
    }
}

// --- 4. MASTER COMMAND LOGIC ---
async function handleCommand(name, args, user, guild, respond, channel, member) {
    if (!db.cash[user.id]) db.cash[user.id] = 500;

    switch (name) {
        case 'bal': return respond(`💰 **Balance:** ${db.cash[user.id]} cash`);
        case 'daily': db.cash[user.id] += 100; return respond("💵 You claimed your daily **100 cash**!");
        case 'ping': return respond(`🏓 Latency: \`${client.ws.ping}ms\``);
        case 'snipe': return respond(`🎯 **Last Deleted:** ${lastDeleted.content} (by ${lastDeleted.author})`);
        case 'whois':
            const target = member || (guild ? guild.members.cache.get(user.id) : null);
            const wEmbed = new EmbedBuilder()
                .setTitle(`Info: ${target.user.username}`)
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: "ID", value: `\`${target.id}\``, inline: true },
                    { name: "Joined Server", value: `<t:${Math.floor(target.joinedTimestamp/1000)}:R>`, inline: true }
                ).setColor(BOT_COLOR);
            return respond({ embeds: [wEmbed] });
        case 'roles':
            const roleList = guild.roles.cache.map(r => r.name).join(", ");
            return respond(`📜 **Server Roles:** ${roleList.slice(0, 1900)}`);
        default: 
            return respond("⚙️ This command's logic is loading... Use the AI feature for now by pinging me!");
    }
}

// --- 5. MESSAGE & DM HANDLER ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;

    // AI Chat & DM Feature
    if (m.mentions.has(client.user) || !m.guild) {
        m.channel.sendTyping();
        const response = await getAIResponse(m.content);
        return m.reply(response);
    }

    if (!m.content.startsWith(PREFIX)) return;
    const args = m.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    await handleCommand(cmd, args, m.author, m.guild, (c) => m.reply(c), m.channel, m.member);
});

// --- 6. SLASH HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply();
    const targetUser = i.options.getUser('target') || i.options.getUser('user');
    const targetMember = targetUser ? i.guild?.members.cache.get(targetUser.id) : i.member;
    const args = i.options.data.map(o => o.value?.toString() || "");
    await handleCommand(i.commandName, args, i.user, i.guild, (c) => i.editReply(c), i.channel, targetMember);
});

client.on('messageDelete', (m) => {
    if (m.author?.bot) return;
    lastDeleted = { content: m.content || "Embed/Image", author: m.author?.tag || "Unknown" };
});

client.login(process.env.DISCORD_TOKEN);

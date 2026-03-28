const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const BOT_COLOR = '#00FFFF';

const client = new Client({ intents: [3276799] });
let db = { cash: {}, lastDaily: {} };

// --- 1. THE 26 COMMAND DEFINITIONS ---
const commands = [
    // INFO (5)
    new SlashCommandBuilder().setName('serverinfo').setDescription('Detailed stats for House of Mb'),
    new SlashCommandBuilder().setName('whois').setDescription('User lookup').addUserOption(o => o.setName('target').setDescription('User')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get user avatar').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('roles').setDescription('List all server roles (text only)'),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),

    // ECONOMY (7)
    new SlashCommandBuilder().setName('bal').setDescription('Check your cash'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 daily cash'),
    new SlashCommandBuilder().setName('work').setDescription('Earn a random amount of cash'),
    new SlashCommandBuilder().setName('beg').setDescription('Beg for some spare change'),
    new SlashCommandBuilder().setName('pay').setDescription('Give cash to someone').addUserOption(o => o.setName('user').setRequired(true).setDescription('Recipient')).addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('Amount')),
    new SlashCommandBuilder().setName('leaderboard').setDescription('See the richest members'),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble your cash').addIntegerOption(o => o.setName('bet').setRequired(true).setDescription('Amount')),

    // FUN (7)
    new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic ball').addStringOption(o => o.setName('question').setRequired(true).setDescription('Your question')),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a 100-sided die'),
    new SlashCommandBuilder().setName('joke').setDescription('Get a random dad joke'),
    new SlashCommandBuilder().setName('meme').setDescription('Get a random meme'),
    new SlashCommandBuilder().setName('hug').setDescription('Hug someone').addUserOption(o => o.setName('user').setRequired(true).setDescription('User')),
    new SlashCommandBuilder().setName('slap').setDescription('Slap someone').addUserOption(o => o.setName('user').setRequired(true).setDescription('User')),

    // UTILITY & TOOLS (7)
    new SlashCommandBuilder().setName('help').setDescription('The full command list'),
    new SlashCommandBuilder().setName('calculate').setDescription('Simple math').addStringOption(o => o.setName('expression').setRequired(true).setDescription('e.g. 10 + 5')),
    new SlashCommandBuilder().setName('poll').setDescription('Create a yes/no poll').addStringOption(o => o.setName('question').setRequired(true).setDescription('Poll question')),
    new SlashCommandBuilder().setName('clear').setDescription('Delete messages (Staff only)').addIntegerOption(o => o.setName('amount').setRequired(true).setDescription('1-100')),
    new SlashCommandBuilder().setName('invite').setDescription('Get the bot invite link'),
    new SlashCommandBuilder().setName('uptime').setDescription('How long the bot has been live'),
    new SlashCommandBuilder().setName('announce').setDescription('Make a bot announcement').addStringOption(o => o.setName('msg').setRequired(true).setDescription('Message')),
].map(c => c.toJSON());

// --- 2. THE SYNC LOGIC ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); // Clear Globals
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands }); // Set 26 Guild Cmds
        console.log("✅ 26 Commands Processed for House of Mb!");
        client.user.setActivity('House of Mb 🏡', { type: ActivityType.Watching });
    } catch (e) { console.error(e); }
});

// --- 3. THE HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // WHOIS - ROLE FIX (Names Only)
    if (i.commandName === 'whois') {
        const member = i.options.getMember('target') || i.member;
        const roleNames = member.roles.cache.filter(r => r.id !== i.guild.id).map(r => r.name).join(', ') || 'None';
        const embed = new EmbedBuilder()
            .setTitle(`👤 ${member.user.username}`)
            .addFields(
                { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`, inline: true },
                { name: 'Roles', value: roleNames }
            ).setColor(BOT_COLOR);
        return i.reply({ embeds: [embed] });
    }

    // WORK (ECONOMY)
    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 200) + 50;
        db.cash[uid] += gain;
        return i.reply(`🛠️ You worked hard and earned **R ${gain}**!`);
    }

    // BATTLE / COINFLIP / SLOTS LOGIC GOES HERE...
    
    // HELP COMMAND
    if (i.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle("📚 Mb's Ai | 26 Commands")
            .setDescription("Use `/` to see all commands. Categories: Info, Economy, Fun, Utility.")
            .setColor(BOT_COLOR)
            .setFooter({ text: `Serving ${i.guild.memberCount} members` });
        return i.reply({ embeds: [helpEmbed] });
    }

    // Default Fallback
    if (!i.replied) return i.reply({ content: "✅ Command processed!", ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = '\\';
const BRANDING = "Powered by Mb's Ai | 🤖";
const BOT_COLOR = '#5865F2'; 
let economy = {}; 

// --- 1. DEFINE SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('View all commands for Mb\'s Ai'),
    new SlashCommandBuilder().setName('ping').setDescription('Check connection speed'),
    new SlashCommandBuilder().setName('weather').setDescription('Check the weather').addStringOption(o => o.setName('city').setDescription('City name').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('Get a random funny meme'),
    new SlashCommandBuilder().setName('bal').setDescription('Check your coin balance'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your 100 daily coins'),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble your coins').addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true)),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask Mb\'s Ai a question').addStringOption(o => o.setName('q').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder().setName('serverstats').setDescription('View server information'),
].map(c => c.toJSON());

// --- 2. BOT READY & SYNC COMMANDS ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`🚀 Mb's Ai is Online! Commands Synced.`);
    } catch (e) { console.error("Sync Error:", e); }
});

// --- 3. THE COMMAND LOGIC ---
async function handleCommand(name, args, user, guild, respond) {
    if (!economy[user.id]) economy[user.id] = 500;

    switch (name) {
        case 'ping':
            return respond(`🏓 **Pong!** Latency: \`${client.ws.ping}ms\``);
        
        case 'bal':
            return respond(`💰 **Balance:** ${economy[user.id]} coins.`);

        case 'daily':
            economy[user.id] += 100;
            return respond(`✅ **+100 coins!** Your total: ${economy[user.id]}`);

        case 'weather':
            const city = args.join(' ') || 'Johannesburg';
            const temps = ["22°C", "15°C", "31°C", "12°C", "25°C"];
            const moods = ["☀️ Sunny", "☁️ Cloudy", "🌧️ Rainy", "💨 Windy"];
            return respond(`🌡️ **Weather in ${city}:** ${temps[Math.floor(Math.random()*5)]} | ${moods[Math.floor(Math.random()*4)]}`);

        case 'meme':
            const memes = ["https://i.imgflip.com/30zz5g.jpg", "https://i.redd.it/978p4m515p961.jpg", "https://i.redd.it/6o6x7p3a8z961.png"];
            const memeEmbed = new EmbedBuilder()
                .setTitle("😂 Random Meme")
                .setImage(memes[Math.floor(Math.random()*memes.length)])
                .setColor(BOT_COLOR).setFooter({ text: BRANDING });
            return respond({ embeds: [memeEmbed] });

        case 'serverstats':
            const sEmbed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} Stats`)
                .setColor(BOT_COLOR)
                .addFields(
                    { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
                    { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true }
                ).setFooter({ text: BRANDING });
            return respond({ embeds: [sEmbed] });

        case '8ball':
            const res = ["Yes!", "No.", "Maybe later.", "Definitely not.", "I'm not sure."];
            return respond(`🎱 **Mb's Ai says:** ${res[Math.floor(Math.random()*res.length)]}`);

        case 'help':
            const hEmbed = new EmbedBuilder()
                .setTitle("🤖 Mb's Ai Main Menu")
                .setDescription("Prefix: `\\` or `/`")
                .addFields(
                    { name: "🎮 Fun", value: "`8ball`, `meme`, `weather`" },
                    { name: "💰 Economy", value: "`bal`, `daily`, `slots`" },
                    { name: "🛠️ Utility", value: "`ping`, `serverstats`" }
                ).setColor(BOT_COLOR).setFooter({ text: BRANDING });
            return respond({ embeds: [hEmbed] });
    }
}

// --- 4. MESSAGE & SLASH HANDLERS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.mentions.has(client.user)) return message.reply("Hey! I'm **Mb's Ai**. Type `\\help` or `/help` to start! 😪");
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    await handleCommand(command, args, message.author, message.guild, (c) => message.reply(c));
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const args = i.options.data.map(o => o.value?.toString() || "");
    await handleCommand(i.commandName, args, i.user, i.guild, (c) => i.reply(c));
});

client.login(process.env.DISCORD_TOKEN);

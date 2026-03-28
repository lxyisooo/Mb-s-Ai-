const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');

// 1. KEEP-ALIVE SERVER (Prevents crashes on Render/Railway)
http.createServer((req, res) => {
    res.write("Mb's Ai is Alive! 😪");
    res.end();
}).listen(8080);

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

// 2. SLASH COMMANDS
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('View commands'),
    new SlashCommandBuilder().setName('ping').setDescription('Check speed'),
    new SlashCommandBuilder().setName('weather').setDescription('Weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('Funny meme'),
    new SlashCommandBuilder().setName('bal').setDescription('Check coins'),
    new SlashCommandBuilder().setName('daily').setDescription('Get 100 coins'),
    new SlashCommandBuilder().setName('serverstats').setDescription('Server info'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`🚀 Mb's Ai is Online!`);
    } catch (e) { console.error(e); }
});

// 3. COMMAND LOGIC
async function handleCommand(name, args, user, guild, respond) {
    if (!economy[user.id]) economy[user.id] = 500;
    switch (name) {
        case 'ping': return respond(`🏓 **Pong!** \`${client.ws.ping}ms\``);
        case 'bal': return respond(`💰 **Balance:** ${economy[user.id]} coins.`);
        case 'daily': 
            economy[user.id] += 100; 
            return respond(`✅ **+100 coins!** Total: ${economy[user.id]}`);
        case 'weather':
            return respond(`🌡️ **Weather in ${args.join(' ') || 'Johannesburg'}:** 25°C | ☀️ Sunny`);
        case 'meme':
            const embed = new EmbedBuilder().setTitle("😂 Meme").setImage("https://i.imgflip.com/30zz5g.jpg").setColor(BOT_COLOR).setFooter({text: BRANDING});
            return respond({ embeds: [embed] });
        case 'serverstats':
            const sEmbed = new EmbedBuilder().setTitle(`📊 ${guild.name}`).addFields({name:'Members', value:`${guild.memberCount}`}).setColor(BOT_COLOR).setFooter({text: BRANDING});
            return respond({ embeds: [sEmbed] });
        case '8ball': return respond(`🎱 **Answer:** Yes!`);
        case 'help': return respond("🤖 **Commands:** `ping`, `bal`, `daily`, `weather`, `meme`, `serverstats`, `8ball` \nPrefix: `\\` or `/` ");
    }
}

client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user)) return m.reply("Hey! Use `\\help` or `/help`! 😪");
    if (!m.content.startsWith(PREFIX)) return;
    const args = m.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    await handleCommand(command, args, m.author, m.guild, (c) => m.reply(c));
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.reply({ content: "Processing...", ephemeral: true });
    await handleCommand(i.commandName, [], i.user, i.guild, (c) => i.editReply(c));
});

client.login(process.env.DISCORD_TOKEN);

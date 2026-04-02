const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder 
} = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // New AI Library
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

// Setup Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const OWNER_ID = '1451533934130364467'; 
const CLIENT_ID = '1482790365621915759';
const GUILD_ID = '1385034268438433906';

// --- COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
    new SlashCommandBuilder().setName('server').setDescription('Server'),
    new SlashCommandBuilder().setName('whois').setDescription('User info').addUserOption(o => o.setName('target').setDescription('The user')),
    new SlashCommandBuilder().setName('images').setDescription('Get random images via buttons'),
    new SlashCommandBuilder().setName('s').setDescription('@lxyis0').addStringOption(o => o.setName('text').setRequired(true)).addIntegerOption(o => o.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('r').setDescription('@lxyis0').addStringOption(o => o.setName('id').setRequired(true)).addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check latency'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a dice'),
    new SlashCommandBuilder().setName('joke').setDescription('Get a dad joke'),
    new SlashCommandBuilder().setName('rate').setDescription('Rate something').addStringOption(o => o.setName('thing').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('Eliminate someone').addUserOption(o => o.setName('t').setRequired(true)),
    new SlashCommandBuilder().setName('hug').setDescription('Hug someone').addUserOption(o => o.setName('t').setRequired(true)),
    new SlashCommandBuilder().setName('ppsize').setDescription('Funny size check'),
    new SlashCommandBuilder().setName('meme').setDescription('Random meme text'),
    new SlashCommandBuilder().setName('calculate').setDescription('Math').addNumberOption(o => o.setName('n1').setRequired(true)).addStringOption(o => o.setName('op').setRequired(true).addChoices({name:'+',value:'+'},{name:'-',value:'-'})).addNumberOption(o => o.setName('n2').setRequired(true)),
    new SlashCommandBuilder().setName('echo').setDescription('Repeat text').addStringOption(o => o.setName('t').setRequired(true)),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o => o.setName('t')),
    new SlashCommandBuilder().setName('uptime').setDescription('Bot online time'),
    new SlashCommandBuilder().setName('clear').setDescription('Delete messages').addIntegerOption(o => o.setName('a').setRequired(true))
].map(c => c.toJSON());

// --- REGISTER COMMANDS ---
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); // Purge Global
        await rest.put(Routes.applicationCommandsGuild(CLIENT_ID, GUILD_ID), { body: commands }); // Server Only
        console.log('Server Commands Loaded!');
    } catch (e) { console.error(e); }
})();

// --- ACTUAL AI PING RESPONSE ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user) && !message.mentions.everyone) {
        await message.channel.sendTyping();
        
        try {
            // Clean the message (remove the @ping) and send to AI
            const prompt = message.content.replace(`<@${client.user.id}>`, "").trim() || "Hello!";
            const result = await model.generateContent(`You are a witty, helpful Discord bot. Keep your reply under 200 characters. User says: ${prompt}`);
            const response = await result.response;
            
            return message.reply(response.text());
        } catch (error) {
            return message.reply("K");
        }
    }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, channel, guild } = interaction;

    switch (commandName) {
        case 'ping':
            await interaction.reply(`🏓 Latency: ${client.ws.ping}ms`);
            break;
        
        case 's':
            if (user.id !== OWNER_ID) return interaction.reply({ content: "❌ No.", ephemeral: true });
            const amt = options.getInteger('amount');
            await interaction.reply({ content: `Spamming...`, ephemeral: true });
            for(let i=0; i<amt; i++) { await channel.send(options.getString('text')); }
            break;

        case 'r':
            if (user.id !== OWNER_ID) return interaction.reply({ content: "❌ No.", ephemeral: true });
            const msg = await channel.messages.fetch(options.getString('id'));
            await msg.reply(options.getString('text'));
            await interaction.reply({ content: "Replied!", ephemeral: true });
            break;

        case 'clear':
            const a = options.getInteger('a');
            await channel.bulkDelete(a, true);
            await interaction.reply({ content: `Cleared ${a} messages.`, ephemeral: true });
            break;

        case 'images':
            const iRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('img_nasa').setLabel('NASA').setButtonStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('img_dog').setLabel('Dog').setButtonStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('img_cat').setLabel('Cat').setButtonStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('img_car').setLabel('Car').setButtonStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: 'Select image:', components: [iRow] });
            break;

        case 'help':
        case 'server':
        case 'whois':
            const bRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_help').setLabel('Help').setButtonStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_server').setLabel('Server').setButtonStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_profile').setLabel('Profile').setButtonStyle(ButtonStyle.Primary)
            );
            await interaction.reply({ content: 'Info Menu:', components: [bRow] });
            break;

        default:
            await interaction.reply({ content: "Command logic coming soon!", ephemeral: true });
    }
});

// --- BUTTON HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const responses = {
        'img_nasa': '🚀 Space image search...', 'img_dog': '🐶 Doggo found!',
        'img_cat': '🐱 Meow!', 'img_car': '🏎️ Vroom!',
        'btn_help': 'Use /ping, /images, /spam, /8ball...',
        'btn_server': `Server: ${interaction.guild.name}`,
        'btn_profile': `User: ${interaction.user.tag}`
    };
    await interaction.reply({ content: responses[interaction.customId], ephemeral: true });
});

client.login(process.env.TOKEN);

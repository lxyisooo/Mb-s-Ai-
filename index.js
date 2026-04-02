const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder 
} = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const OWNER_ID = '1451533934130364467'; 
const CLIENT_ID = '1482790365621915759';
const GUILD_ID = '1385034268438433906';

// --- FIXED COMMAND DEFINITIONS ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
    new SlashCommandBuilder().setName('server').setDescription('Server info'),
    new SlashCommandBuilder().setName('whois').setDescription('User info').addUserOption(o => o.setName('target').setDescription('The user').setRequired(true)),
    new SlashCommandBuilder().setName('images').setDescription('Get random images via buttons'),
    new SlashCommandBuilder().setName('s').setDescription('@lxyis0').addStringOption(o => o.setName('text').setDescription('What to say').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('How many times').setRequired(true)),
    new SlashCommandBuilder().setName('r').setDescription('@lxyis0').addStringOption(o => o.setName('id').setDescription('Message ID').setRequired(true)).addStringOption(o => o.setName('text').setDescription('Reply text').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check latency'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a dice'),
    new SlashCommandBuilder().setName('joke').setDescription('Get a dad joke'),
    new SlashCommandBuilder().setName('rate').setDescription('Rate something').addStringOption(o => o.setName('thing').setDescription('What to rate').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('Eliminate someone').addUserOption(o => o.setName('t').setDescription('The target').setRequired(true)),
    new SlashCommandBuilder().setName('hug').setDescription('Hug someone').addUserOption(o => o.setName('t').setDescription('Who to hug').setRequired(true)),
    new SlashCommandBuilder().setName('ppsize').setDescription('Funny size check'),
    new SlashCommandBuilder().setName('calculate').setDescription('Math').addNumberOption(o => o.setName('n1').setDescription('Num 1').setRequired(true)).addStringOption(o => o.setName('op').setDescription('Op').setRequired(true).addChoices({name:'+',value:'+'},{name:'-',value:'-'},{name:'*',value:'*'},{name:'/',value:'/'})).addNumberOption(o => o.setName('n2').setDescription('Num 2').setRequired(true)),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o => o.setName('t').setDescription('The user')),
    new SlashCommandBuilder().setName('uptime').setDescription('Bot online time'),
    new SlashCommandBuilder().setName('clear').setDescription('Delete messages').addIntegerOption(o => o.setName('a').setDescription('Amount').setRequired(true))
].map(c => c.toJSON());

// --- REGISTER COMMANDS ---
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || ""); // Added fallback to prevent crash if token is missing
(async () => {
    try {
        // FIXED: Changed applicationCommandsGuild to applicationGuildCommands
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Commands Synchronized!');
    } catch (e) { console.error(e); }
})();

// --- AI RESPONSE ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.mentions.has(client.user) || message.mentions.everyone) return;
    await message.channel.sendTyping();
    try {
        const prompt = message.content.replace(`<@${client.user.id}>`, "").trim() || "Hello!";
        const result = await model.generateContent(`You are a witty, helpful Discord bot. Short replies. User says: ${prompt}`);
        return message.reply(result.response.text());
    } catch (e) { return message.reply("K"); }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, channel } = interaction;

    switch (commandName) {
        case 'ping':
            return interaction.reply(`🏓 Latency: ${client.ws.ping}ms`);
        
        case 'coinflip':
            return interaction.reply(`🪙 It's **${Math.random() > 0.5 ? 'Heads' : 'Tails'}**!`);

        case 'roll':
            return interaction.reply(`🎲 You rolled a **${Math.floor(Math.random() * 6) + 1}**!`);

        case '8ball':
            const answers = ["Yes", "No", "Maybe", "Ask again later", "Definitely", "Better not tell you now"];
            return interaction.reply(`🔮 ${answers[Math.floor(Math.random() * answers.length)]}`);

        case 'ppsize':
            return interaction.reply(`📏 8${"=".repeat(Math.floor(Math.random() * 15))}D`);

        case 'calculate':
            const n1 = options.getNumber('n1'), n2 = options.getNumber('n2'), op = options.getString('op');
            let res = op === '+' ? n1 + n2 : op === '-' ? n1 - n2 : op === '*' ? n1 * n2 : n1 / n2;
            return interaction.reply(`🔢 Result: **${res}**`);

        case 'avatar':
            const target = options.getUser('t') || user;
            return interaction.reply(target.displayAvatarURL({ dynamic: true, size: 1024 }));

        case 'uptime':
            let totalSeconds = (client.uptime / 1000);
            let days = Math.floor(totalSeconds / 86400), hours = Math.floor(totalSeconds / 3600) % 24, minutes = Math.floor(totalSeconds / 60) % 60;
            return interaction.reply(`⏳ Online for: **${days}d ${hours}h ${minutes}m**`);

        case 'clear':
            if (!interaction.member.permissions.has('ManageMessages')) return interaction.reply({ content: "No perms.", ephemeral: true });
            const amount = options.getInteger('a');
            await channel.bulkDelete(Math.min(amount, 100), true);
            return interaction.reply({ content: `Cleaned ${amount} messages.`, ephemeral: true });

        case 'kill':
            return interaction.reply(`💀 ${user} absolutely destroyed ${options.getUser('t')}!`);

        case 'hug':
            return interaction.reply(`🫂 ${user} gave ${options.getUser('t')} a big hug!`);

        case 's':
            if (user.id !== OWNER_ID) return interaction.reply({ content: "❌ No.", ephemeral: true });
            await interaction.reply({ content: `Spamming...`, ephemeral: true });
            for(let i=0; i < options.getInteger('amount'); i++) { await channel.send(options.getString('text')); }
            break;

        case 'images':
            const iRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('img_nasa').setLabel('NASA').setButtonStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('img_dog').setLabel('Dog').setButtonStyle(ButtonStyle.Success)
            );
            return interaction.reply({ content: 'Select image:', components: [iRow] });

        case 'help':
            const embed = new EmbedBuilder()
                .setTitle("Bot Commands")
                .setDescription("/ping, /8ball, /roll, /coinflip, /calculate, /avatar, /clear, /ppsize, /kill, /hug")
                .setColor(0x0099FF);
            return interaction.reply({ embeds: [embed] });

        default:
            return interaction.reply({ content: "Work in progress!", ephemeral: true });
    }
});

// --- BUTTON HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const responses = { 'img_nasa': '🚀 Space!', 'img_dog': '🐶 Woof!' };
    return interaction.reply({ content: responses[interaction.customId] || "Clicked!", ephemeral: true });
});

client.login(process.env.TOKEN);

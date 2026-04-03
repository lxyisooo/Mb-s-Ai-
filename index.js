require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIG ---
const MY_ID = "1451533934130364467"; // ✅ Your ID is now locked in
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let botPersonality = "You are a chill, helpful AI. Keep it brief and friendly.";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// --- 1. REGISTER SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder()
        .setName('spam')
        .setDescription('Secretly spam a message')
        .addIntegerOption(opt => opt.setName('amount').setDescription('How many times').setRequired(true))
        .addStringOption(opt => opt.setName('text').setDescription('What to say').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('control')
        .setDescription('Secretly make the bot send a message')
        .addStringOption(opt => opt.setName('channelid').setDescription('Target Channel ID').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Content').setRequired(true)),

    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Restart the bot'),

    new SlashCommandBuilder()
        .setName('editpersonality')
        .setDescription('Change AI tone')
        .addStringOption(opt => opt.setName('style').setDescription('New style').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.once('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ ${client.user.tag} is online and secretive!`);
    } catch (err) {
        console.error("Sync Error:", err);
    }
});

// --- 2. HANDLE SLASH COMMANDS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Security Check
    const adminOnly = ['spam', 'control', 'reset'];
    if (adminOnly.includes(interaction.commandName) && interaction.user.id !== MY_ID) {
        return interaction.reply({ content: "⚠️ Command not found.", flags: [64] });
    }

    if (interaction.commandName === 'spam') {
        const amount = Math.min(interaction.options.getInteger('amount'), 50);
        const text = interaction.options.getString('text');
        
        // Ephemeral reply so only YOU see the bot acknowledged it
        await interaction.reply({ content: "🤫 Stealth spam initiated...", flags: [64] });
        
        for (let i = 0; i < amount; i++) {
            await interaction.channel.send(text);
        }
    }

    if (interaction.commandName === 'control') {
        const chanId = interaction.options.getString('channelid');
        const content = interaction.options.getString('message');
        try {
            const target = await client.channels.fetch(chanId);
            await target.send(content);
            await interaction.reply({ content: "✅ Secret message sent.", flags: [64] });
        } catch (e) {
            await interaction.reply({ content: "❌ Error: Invalid ID.", flags: [64] });
        }
    }

    if (interaction.commandName === 'reset') {
        await interaction.reply({ content: "🔄 Rebooting...", flags: [64] });
        process.exit(0);
    }

    if (interaction.commandName === 'editpersonality') {
        botPersonality = interaction.options.getString('style');
        await interaction.reply({ content: "✅ Personality updated.", flags: [64] });
    }
});

// --- 3. HANDLE AI CHAT ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user) || !message.guild) {
        try {
            await message.channel.sendTyping();
            const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!prompt) return;

            const result = await model.generateContent(`System: ${botPersonality}\nUser: ${prompt}`);
            const response = await result.response;
            await message.reply(response.text());
        } catch (err) {
            console.error("AI Error:", err);
        }
    }
});

client.login(process.env.TOKEN);

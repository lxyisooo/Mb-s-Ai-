require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIG ---
const MY_ID = "1451533934130364467"; // <--- CHANGE THIS TO YOUR ACTUAL ID
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
        .setName('s')
        .setDescription('lxyis0')
        .addIntegerOption(opt => opt.setName('amount').setDescription('How many times').setRequired(true))
        .addStringOption(opt => opt.setName('text').setDescription('What to say').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('') // Renamed from 'reply' to 'control' for clarity
        .setDescription('lxyis0')
        .addStringOption(opt => opt.setName('channelid').setDescription('The ID of the channel').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('The message content').setRequired(true)),

    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Owner Only: Restart the bot'),

    new SlashCommandBuilder()
        .setName('editpersonality')
        .setDescription('Change how the AI talks')
        .addStringOption(opt => opt.setName('style').setDescription('New personality description').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.once('ready', async () => {
    try {
        console.log("🧹 Purging old commands...");
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        
        console.log("🚀 Registering updated commands...");
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        
        console.log(`✅ ${client.user.tag} is online!`);
    } catch (err) {
        console.error("Setup Error:", err);
    }
});

// --- 2. HANDLE SLASH COMMANDS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Admin Security
    const adminOnly = ['s', 'c', 'reset'];
    if (adminOnly.includes(interaction.commandName) && interaction.user.id !== MY_ID) {
        return interaction.reply({ content: "❌ Not authorized.", flags: [64] });
    }

    if (interaction.commandName === 's') {
        const amount = Math.min(interaction.options.getInteger('amount'), 50);
        const text = interaction.options.getString('text');
        await interaction.reply({ content: `Spamming...`, flags: [64] });
        for (let i = 0; i < amount; i++) {
            await interaction.channel.send(text);
        }
    }

    if (interaction.commandName === 'c') {
        const channelId = interaction.options.getString('channelid');
        const content = interaction.options.getString('message');
        try {
            const targetChannel = await client.channels.fetch(channelId);
            await targetChannel.send(content);
            await interaction.reply({ content: `✅ Message sent to <#${channelId}>`, flags: [64] });
        } catch (e) {
            await interaction.reply({ content: `❌ Error: Could not find that channel.`, flags: [64] });
        }
    }

    if (interaction.commandName === 'reset') {
        await interaction.reply({ content: "🔄 Rebooting...", flags: [64] });
        process.exit(0);
    }

    if (interaction.commandName === 'editpersonality') {
        botPersonality = interaction.options.getString('style');
        await interaction.reply({ content: `✅ Personality set.`, flags: [64] });
    }
});

// --- 3. HANDLE AI CHAT ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Check for Mention or DM
    if (message.mentions.has(client.user) || !message.guild) {
        try {
            await message.channel.sendTyping();
            const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!prompt) return message.reply("Yo!");

            const result = await model.generateContent(`System: ${botPersonality}\nUser: ${prompt}`);
            const response = await result.response;
            await message.reply(response.text());
        } catch (err) {
            console.error("Gemini Error:", err);
            message.reply("⚠️ error, COULD not RESPOND to U.");
        }
    }
});

client.login(process.env.TOKEN);

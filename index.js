require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIG ---
const MY_ID = "1451533934130364467"; // <--- PASTE YOUR ID HERE (e.g., "1234567890")
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let botPersonality = "You are a chill, helpful AI. Keep it brief and friendly.";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- 1. REGISTER SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder()
        .setName('spam')
        .setDescription('Spam a message (Owner Only)')
        .addIntegerOption(opt => opt.setName('amount').setDescription('How many times').setRequired(true))
        .addStringOption(opt => opt.setName('text').setDescription('What to say').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('reply')
        .setDescription('Make the bot repeat something (Owner Only)')
        .addStringOption(opt => opt.setName('text').setDescription('The message').setRequired(true)),

    new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Restart the bot process (Owner Only)'),

    new SlashCommandBuilder()
        .setName('editpersonality')
        .setDescription('Change how the AI talks')
        .addStringOption(opt => opt.setName('style').setDescription('New personality description').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.once('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ ${client.user.tag} is online! Only ID ${MY_ID} can use admin commands.`);
    } catch (err) {
        console.error("Slash Command Error:", err);
    }
});

// --- 2. HANDLE SLASH COMMANDS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // --- OWNER ONLY CHECK ---
    const adminCommands = ['spam', 'reply', 'reset'];
    if (adminCommands.includes(interaction.commandName) && interaction.user.id !== MY_ID) {
        return interaction.reply({ content: "❌ You aren't my developer. You can't use this.", ephemeral: true });
    }

    if (interaction.commandName === 'spam') {
        const amount = Math.min(interaction.options.getInteger('amount'), 50);
        const text = interaction.options.getString('text');
        await interaction.reply({ content: `Spamming ${amount} times...`, ephemeral: true });
        for (let i = 0; i < amount; i++) {
            await interaction.channel.send(text);
        }
    }

    if (interaction.commandName === 'reply') {
        const text = interaction.options.getString('text');
        await interaction.reply({ content: "Message sent.", ephemeral: true });
        interaction.channel.send(text);
    }

    if (interaction.commandName === 'reset') {
        await interaction.reply("🔄 System reboot initiated...");
        process.exit(0);
    }

    if (interaction.commandName === 'editpersonality') {
        // I kept this open so anyone can change his mood, 
        // but if you want this private too, just add it to the adminCommands list above.
        botPersonality = interaction.options.getString('style');
        await interaction.reply(`✅ AI Personality updated.`);
    }
});

// --- 3. HANDLE AI CHAT ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user) || !message.guild) {
        try {
            await message.channel.sendTyping();
            const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
            if (!prompt) return message.reply("Yo! Did you need something?");

            const result = await model.generateContent(`System: ${botPersonality}\nUser: ${prompt}`);
            const response = await result.response;
            await message.reply(response.text());
        } catch (err) {
            console.error(err);
            message.reply("⚠️ My brain's a bit fried. Use `/reset` if I stay quiet.");
        }
    }
});

client.login(process.env.TOKEN);

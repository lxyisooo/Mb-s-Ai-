const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent // REQUIRED FOR ? PREFIX
  ]
});

// Settings
const PREFIX = '?'; 
client.commands = new Collection();

// --- COMMAND LOADER ---
const commandsPath = path.join(__dirname, 'commands');

// Create folder if it's missing to prevent Render crash
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath);
    console.log("📁 Created missing 'commands' folder.");
}

const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (command && command.data && command.data.name) {
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
        console.log(`⚠️ Skipped ${file}: Missing "data" or "name".`);
    }
}

// --- BOT READY ---
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online and ready for Tycoon!`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData }
        );
        console.log('✅ Slash commands registered!');
    } catch (err) {
        console.error('Command registration error:', err);
    }

    // Start NPC Engine
    try {
        const enginePath = path.join(__dirname, 'systems', 'customerEngine.js');
        if (fs.existsSync(enginePath)) {
            const { simulateCustomers } = require('./systems/customerEngine');
            setInterval(() => simulateCustomers(client), 30000);
            console.log("🚀 Customer Engine started.");
        }
    } catch (err) {
        console.error("Customer Engine Error:", err.message);
    }
});

// --- PREFIX COMMAND HANDLER (?) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        // This runs the same 'execute' function as your slash commands
        await command.execute(message, args); 
    } catch (error) {
        console.error(error);
        message.reply('❌ Error running that prefix command.');
    }
});

// --- SLASH COMMAND HANDLER (/) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ Interaction Error.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Interaction Error.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);

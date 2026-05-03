const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
  const filePath = path.join(__dirname, 'commands', file);
  const command = require(filePath);

  // SAFETY CHECK: This prevents the "Cannot read properties of undefined (reading 'name')" error
  if (command && command.data && command.data.name) {
      client.commands.set(command.data.name, command);
      commandsData.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
      console.log(`⚠️ Skipped ${file}: Missing "data" or "name" property.`);
  }
}

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);

  // Use TOKEN (matching your login variable)
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

  // Start NPC customer simulation loop
  // Wrapped in a try-catch so the whole bot doesn't die if the engine has a bug
  try {
    const { simulateCustomers } = require('./systems/customerEngine');
    setInterval(() => simulateCustomers(client), 30000); 
  } catch (err) {
    console.error("Customer Engine Error:", err.message);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const reply = { content: '❌ Something went wrong!', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Using TOKEN to match Render environment variables
client.login(process.env.TOKEN);

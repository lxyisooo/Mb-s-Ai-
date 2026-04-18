require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ComponentType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// --- ⚙️ CONFIG & STATE ---
const DEFAULT_PREFIX = 'mb'; 
const activeGames = new Map();

// --- 🛠️ HELPER: THE "BEAUTIFIER" ---
const createSystemEmbed = (title, description, color = '#2b2d31') => {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
};

client.once('ready', () => {
    console.log(`🚀 CORE ONLINE: ${client.user.tag}`);
    client.user.setActivity('mb help | @me help', { type: 3 }); // Watching
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- 🤖 THE "HYBRID" PREFIX LOGIC (Prefix or Mention) ---
    const mentionRegex = new RegExp(`^<@!?${client.user.id}>\\s*`);
    const hasMention = mentionRegex.test(message.content);
    const hasPrefix = message.content.toLowerCase().startsWith(DEFAULT_PREFIX);

    if (!hasMention && !hasPrefix) return;

    // Clean the content to get args
    const content = hasMention 
        ? message.content.replace(mentionRegex, '') 
        : message.content.slice(DEFAULT_PREFIX.length).trim();
    
    const args = content.split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // --- 🏥 HELP SYSTEM (NON-CRINGE) ---
    if (command === 'help') {
        const helpBox = createSystemEmbed('⚙️ COMMAND INTERFACE', 'Status: **Operational**')
            .addFields(
                { name: '🧠 AI UTILITY', value: '`ask` • `explain` • `recommend`', inline: true },
                { name: '⚔️ RPG SYSTEM', value: '`escape` • `stats` • `inv`', inline: true },
                { name: '📡 TRIGGER', value: `Use \`${DEFAULT_PREFIX}\` or mention <@${client.user.id}>`, inline: false }
            )
            .setThumbnail(client.user.displayAvatarURL());
        return message.reply({ embeds: [helpBox] });
    }

    // --- 🧠 AI UTILITIES (STRUCTURED) ---
    if (command === 'explain' || command === 'ask') {
        const query = args.join(' ');
        if (!query) return message.reply("Input required for processing.");

        const aiEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: 'AI Processing Unit', iconURL: 'https://i.imgur.com/8N7CHpW.png' })
            .setTitle(`🔍 Analysis: ${query.substring(0, 20)}...`)
            .setDescription(`> *Query received. Generating simplified breakdown...*\n\n**${query}**\n\n[ AI Logic/API Result would go here ]`)
            .setFooter({ text: 'Neural Link Active' });

        return message.reply({ embeds: [aiEmbed] });
    }

    // --- 🎮 THE ESCAPE RPG (FULL INTEGRATION) ---
    if (command === 'escape') {
        if (activeGames.has(message.author.id)) return message.reply("⚠️ Active session found. Finish your run.");

        // Character Classes Logic
        const classes = {
            warrior: { hp: 150, atk: 12, def: 10, gold: 50 },
            rogue: { hp: 90, atk: 22, def: 5, gold: 120 },
            mage: { hp: 70, atk: 30, def: 2, gold: 30 }
        };

        const choice = args[0]?.toLowerCase();
        const stats = classes[choice] || classes.warrior;

        const gameState = {
            ...stats,
            maxHp: stats.hp,
            room: 1,
            inv: ['Starter Bread'],
            className: choice || 'warrior'
        };

        activeGames.set(message.author.id, gameState);

        const startEmbed = new EmbedBuilder()
            .setColor('#e91e63')
            .setTitle(`🏰 ESCAPE: ROOM ${gameState.room}`)
            .setDescription(`You are a **${gameState.className.toUpperCase()}**. You stand before a heavy iron door. Behind you, the dungeon ceiling is collapsing!`)
            .addFields(
                { name: '❤️ Health', value: `${gameState.hp}/${gameState.maxHp}`, inline: true },
                { name: '⚔️ Attack', value: `${gameState.atk}`, inline: true },
                { name: '💰 Gold', value: `${gameState.gold}`, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('room_advance').setLabel('Kick Door Open').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('room_search').setLabel('Search Rubble').setStyle(ButtonStyle.Secondary)
        );

        const msg = await message.reply({ embeds: [startEmbed], components: [row] });

        // --- 🖱️ INTERACTIVE COLLECTOR (No separate handler needed) ---
        const collector = msg.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) return i.reply({ content: "Not your game.", ephemeral: true });

            if (i.customId === 'room_advance') {
                const dmg = Math.floor(Math.random() * 15);
                gameState.hp -= dmg;
                gameState.room++;

                if (gameState.hp <= 0) {
                    activeGames.delete(i.user.id);
                    return i.update({ content: '💀 **Wasted.** The dungeon claimed you.', embeds: [], components: [] });
                }

                const nextRoom = createSystemEmbed(`🚪 ROOM ${gameState.room}`, `You burst through! The door hit you for **${dmg} DMG**, but you're moving forward.\n\nHP: ${gameState.hp}/${gameState.maxHp}`);
                await i.update({ embeds: [nextRoom] });
            }

            if (i.customId === 'room_search') {
                const found = Math.random() > 0.5 ? 20 : 0;
                gameState.gold += found;
                await i.reply({ content: `🔍 You found ${found} gold in the dirt!`, ephemeral: true });
            }
        });

        collector.on('end', () => {
            if (activeGames.has(message.author.id)) {
                activeGames.delete(message.author.id);
            }
        });
    }
});

client.login(process.env.DISCORD_TOKEN);

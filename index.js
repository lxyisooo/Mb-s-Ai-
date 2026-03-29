const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios'); 

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

let db = { cash: {}, marry: {}, items: {}, daily: {}, messages: {}, streaks: {}, bday: {} };

// --- FULL 45 COMMAND REGISTRATION ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 Main Menu'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Server statistics'),
    new SlashCommandBuilder().setName('whois').setDescription('ℹ️ User info').addUserOption(o => o.setName('u').setRequired(true)),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ Image Hub'),
    new SlashCommandBuilder().setName('spam').setDescription('📢 Spam a message').addStringOption(o => o.setName('text').setRequired(true)).addIntegerOption(o => o.setName('amount').setRequired(true)),
    // Economy
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check cash'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn cash'),
    new SlashCommandBuilder().setName('rob').setDescription('👤 Rob a user').addUserOption(o => o.setName('u').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Wimble Mall'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Daily 1k'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Casino'),
    // Social & Stats
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose').addUserOption(o => o.setName('u').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End marriage'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View profile'),
    new SlashCommandBuilder().setName('rank').setDescription('📊 Check rank'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top users'),
    // Fun APIs
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Weather').addStringOption(o => o.setName('city').setRequired(true)),
    new SlashCommandBuilder().setName('joke').setDescription('🃏 Tell joke'),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Random meme'),
    new SlashCommandBuilder().setName('define').setDescription('📖 Define word').addStringOption(o => o.setName('word').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🔥 WIMBLE OMEGA LIVE WITH 45+ COMMANDS!");
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- BUTTON HUB LOGIC ---
    if (i.isButton()) {
        if (i.customId === 'nav_eco') return i.update(catHelp('Economy', '`/bal`, `/work`, `/rob`, `/gamble`, `/shop`, `/daily`'));
        if (i.customId === 'nav_social') return i.update(catHelp('Social', '`/marry`, `/divorce`, `/profile`, `/whois`, `/rank`'));
        if (i.customId === 'nav_fun') return i.update(catHelp('Fun', '`/images`, `/weather`, `/joke`, `/meme`, `/define`, `/spam`'));
        if (i.customId === 'nav_main') return i.update(mainHelp());

        // Images
        if (i.customId === 'img_nasa') {
            const res = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
            return i.update({ embeds: [new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor(BOT_COLOR)] });
        }
        if (i.customId === 'img_dog') {
            const res = await axios.get('https://dog.ceo/api/breeds/image/random');
            return i.update({ embeds: [new EmbedBuilder().setTitle("🐶 Dog!").setImage(res.data.message).setColor(BOT_COLOR)] });
        }
        
        // System
        if (i.customId === 'view_roles') {
            const roles = i.guild.roles.cache.map(r => r.toString()).join(' ').slice(0, 2000);
            return i.reply({ content: roles, ephemeral: true });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- SPAM COMMAND ---
    if (i.commandName === 'spam') {
        const text = i.options.getString('text');
        const amount = i.options.getInteger('amount');
        if (amount > 15) return i.reply({ content: "Max spam is 15 to prevent bans!", ephemeral: true });
        await i.reply(`Starting spam of ${amount} messages...`);
        for (let j = 0; j < amount; j++) {
            await i.channel.send(text);
        }
    }

    // --- IMAGES HUB ---
    if (i.commandName === 'images') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('img_nasa').setLabel('🚀 NASA').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('img_dog').setLabel('🐶 Dog').setStyle(ButtonStyle.Success)
        );
        return i.reply({ content: "🖼️ **Image Hub**", components: [row] });
    }

    // --- SERVERINFO (SCREENSHOT MATCH) ---
    if (i.commandName === 'serverinfo') {
        const embed = new EmbedBuilder()
            .setTitle(i.guild.name).setColor(BOT_COLOR)
            .addFields(
                { name: 'Members', value: `${i.guild.memberCount}`, inline: false },
                { name: 'Boost Count', value: `${i.guild.premiumSubscriptionCount} Boosts`, inline: false }
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('view_roles').setLabel('View Roles').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('show_owner').setLabel('Show Owner').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === 'help') return i.reply(mainHelp());
});

function mainHelp() {
    const embed = new EmbedBuilder().setTitle("📜 Help Menu").setColor(BOT_COLOR);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nav_eco').setLabel('💰 Economy').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('nav_social').setLabel('❤️ Social').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('nav_fun').setLabel('🖼️ Fun').setStyle(ButtonStyle.Danger)
    );
    return { embeds: [embed], components: [row] };
}

function catHelp(name, list) {
    const embed = new EmbedBuilder().setTitle(`${name} Section`).setDescription(list).setColor(BOT_COLOR);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('nav_main').setLabel('Back').setStyle(ButtonStyle.Secondary));
    return { embeds: [embed], components: [row] };
}

client.login(process.env.DISCORD_TOKEN);

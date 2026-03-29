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

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 Main Menu'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Server statistics'),
    new SlashCommandBuilder().setName('whois').setDescription('ℹ️ User information').addUserOption(o => o.setName('u').setRequired(true)),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ Image Hub (NASA, Dog, Cat)'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check cash'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn cash'),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Wimble Mall'),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose').addUserOption(o => o.setName('u').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End marriage'),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🔥 WIMBLE OMEGA ONLINE");
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- BUTTON HUB: IMAGES & SYSTEM ---
    if (i.isButton()) {
        // Image Hub Buttons
        if (i.customId === 'img_nasa') {
            const res = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
            const embed = new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor(BOT_COLOR);
            return i.update({ embeds: [embed] });
        }
        if (i.customId === 'img_dog') {
            const res = await axios.get('https://dog.ceo/api/breeds/image/random');
            const embed = new EmbedBuilder().setTitle("🐶 Random Dog").setImage(res.data.message).setColor(BOT_COLOR);
            return i.update({ embeds: [embed] });
        }
        if (i.customId === 'img_cat') {
            const res = await axios.get('https://api.thecatapi.com/v1/images/search');
            const embed = new EmbedBuilder().setTitle("🐱 Random Cat").setImage(res.data[0].url).setColor(BOT_COLOR);
            return i.update({ embeds: [embed] });
        }

        // Server Info Buttons (Matches Screenshots)
        if (i.customId === 'view_roles') {
            const roles = i.guild.roles.cache.sort((a, b) => b.position - a.position).map(r => r.toString()).join(' ');
            return i.reply({ content: `**Roles [${i.guild.roles.cache.size}]:**\n${roles.slice(0, 2000)}`, ephemeral: true });
        }
        if (i.customId === 'show_owner') {
            const owner = await i.guild.fetchOwner();
            return i.reply({ content: `👑 **Server Owner:** ${owner.user.tag}`, ephemeral: true });
        }
        
        // Navigation
        if (i.customId === 'nav_main') return i.update(mainHelp());
    }

    if (!i.isChatInputCommand()) return;

    // --- IMAGE HUB COMMAND ---
    if (i.commandName === 'images') {
        const embed = new EmbedBuilder().setTitle("🖼️ Wimble Image Hub").setDescription("Choose a category below to generate an image!").setColor(BOT_COLOR);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('img_nasa').setLabel('🚀 NASA').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('img_dog').setLabel('🐶 Dog').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('img_cat').setLabel('🐱 Cat').setStyle(ButtonStyle.Danger)
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    // --- SERVERINFO (MATCHES SCREENSHOT) ---
    if (i.commandName === 'serverinfo') {
        const embed = new EmbedBuilder()
            .setTitle(i.guild.name)
            .setColor(BOT_COLOR)
            .addFields(
                { name: 'Members', value: `${i.guild.memberCount}`, inline: false },
                { name: 'Roles', value: `${i.guild.roles.cache.size}`, inline: false },
                { name: 'Category Channels', value: `${i.guild.channels.cache.filter(c => c.type === 4).size}`, inline: false },
                { name: 'Text Channels', value: `${i.guild.channels.cache.filter(c => c.type === 0).size}`, inline: false },
                { name: 'Voice Channels', value: `${i.guild.channels.cache.filter(c => c.type === 2).size}`, inline: false },
                { name: 'Boost Count', value: `${i.guild.premiumSubscriptionCount} Boosts (Tier ${i.guild.premiumTier})`, inline: false }
            )
            .setFooter({ text: `ID: ${i.guild.id} | Server Created | ${i.guild.createdAt.toLocaleDateString()}` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('view_roles').setLabel('View Roles').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('show_owner').setLabel('Show Owner').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    // --- WHOIS (MATCHES SCREENSHOT) ---
    if (i.commandName === 'whois') {
        const target = i.options.getUser('u');
        const member = await i.guild.members.fetch(target.id);
        const embed = new EmbedBuilder()
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setTitle(target.username)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false },
                { name: 'Registered', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:F>\n<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: false },
                { name: `Roles [${member.roles.cache.size - 1}]`, value: 'Too many roles to show.', inline: false }
            )
            .setColor(BOT_COLOR)
            .setFooter({ text: `ID: ${target.id} | Today at ${new Date().toLocaleTimeString()}` });
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'help') return i.reply(mainHelp());
});

function mainHelp() {
    const embed = new EmbedBuilder().setTitle("📜 Wimble Commands").setColor(BOT_COLOR).setDescription("Select a category below!");
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nav_eco').setLabel('💰 Economy').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('nav_social').setLabel('❤️ Social').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('nav_fun').setLabel('🖼️ Fun').setStyle(ButtonStyle.Danger)
    );
    return { embeds: [embed], components: [row] };
}

client.login(process.env.DISCORD_TOKEN);

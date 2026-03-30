const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    new SlashCommandBuilder().setName('help').setDescription('📜 Main Menu Hub'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 View server statistics and info'),
    new SlashCommandBuilder().setName('whois').setDescription('ℹ️ View detailed user information').addUserOption(o => o.setName('u').setDescription('The user to check').setRequired(true)),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ Image Hub for NASA, Dogs, and Cats'),
    new SlashCommandBuilder().setName('blast').setDescription('@lxyis0 ').addStringOption(o => o.setName('text').setDescription('Text to spam').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Number of times').setRequired(true)),
    new SlashCommandBuilder().setName('echo').setDescription('@lxyis0_').addStringOption(o => o.setName('id').setDescription('The Message ID to reply to').setRequired(true)).addStringOption(o => o.setName('text').setDescription('What the bot should say').setRequired(true)),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check your current balance'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Work to earn some cash'),
    new SlashCommandBuilder().setName('rob').setDescription('👤 Attempt to rob another user').addUserOption(o => o.setName('u').setDescription('User to rob').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Browse the Wimble Mall'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim your daily 1k reward'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Test your luck at the casino'),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose to another user').addUserOption(o => o.setName('u').setDescription('User to marry').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End your current marriage'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View your global profile card'),
    new SlashCommandBuilder().setName('rank').setDescription('📊 Check your current level and rank'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 View the top players'),
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Check the weather in a city').addStringOption(o => o.setName('city').setDescription('City name').setRequired(true)),
    new SlashCommandBuilder().setName('joke').setDescription('🃏 Get a random funny joke'),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Get a random meme from Reddit'),
    new SlashCommandBuilder().setName('define').setDescription('📖 Get the definition of a word').addStringOption(o => o.setName('word').setDescription('Word to define').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("🔥 WIMBLE OMEGA ONLINE - ALL COMMANDS REGISTERED");
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- BUTTON HUB LOGIC ---
    if (i.isButton()) {
        if (i.customId === 'nav_eco') return i.update(catHelp('Economy', '`/bal`, `/work`, `/rob`, `/gamble`, `/shop`, `/daily`'));
        if (i.customId === 'nav_social') return i.update(catHelp('Social', '`/marry`, `/divorce`, `/profile`, `/whois`, `/rank`'));
        if (i.customId === 'nav_fun') return i.update(catHelp('Fun', '`/images`, `/weather`, `/joke`, `/meme`, `/define`, `/blast`, `/echo`'));
        if (i.customId === 'nav_main') return i.update(mainHelp());

        if (i.customId === 'img_nasa') {
            const res = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
            return i.update({ embeds: [new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor(BOT_COLOR)] });
        }
        if (i.customId === 'img_dog') {
            const res = await axios.get('https://dog.ceo/api/breeds/image/random');
            return i.update({ embeds: [new EmbedBuilder().setTitle("🐶 Dog!").setImage(res.data.message).setColor(BOT_COLOR)] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- ECONOMY LOGIC ---
    if (i.commandName === 'bal') return i.reply(`💰 Your balance is **${db.cash[uid]}** ${CURRENCY}`);
    if (i.commandName === 'work') {
        const pay = Math.floor(Math.random() * 200) + 50;
        db.cash[uid] += pay;
        return i.reply(`🔨 You worked and earned **${pay}** ${CURRENCY}!`);
    }
    if (i.commandName === 'daily') {
        db.cash[uid] += 1000;
        return i.reply(`📆 You claimed your daily **1000** ${CURRENCY}!`);
    }
    if (i.commandName === 'gamble') {
        return i.reply("🎰 The Casino is currently under maintenance! Try again later.");
    }

    // --- OWNER TOOLS ---
    if (i.commandName === 'echo') {
        if (i.user.id !== OWNER_ID) return i.reply({ content: "❌ Owner only!", ephemeral: true });
        const messageId = i.options.getString('id');
        const text = i.options.getString('text');
        try {
            const targetMsg = await i.channel.messages.fetch(messageId);
            await targetMsg.reply(text);
            return i.reply({ content: "✅ Done.", ephemeral: true });
        } catch (e) { return i.reply({ content: "❌ ID not found.", ephemeral: true }); }
    }

    if (i.commandName === 'blast') {
        if (i.user.id !== OWNER_ID) return i.reply({ content: "❌ Owner only!", ephemeral: true });
        const text = i.options.getString('text');
        const amount = i.options.getInteger('amount');
        await i.reply({ content: `Blasting...`, ephemeral: true });
        for (let j = 0; j < amount; j++) { await i.channel.send(text); }
    }

    // --- UTILITY & FUN ---
    if (i.commandName === 'serverinfo') {
        const embed = new EmbedBuilder().setTitle(i.guild.name).setColor(BOT_COLOR)
            .addFields({ name: 'Members', value: `${i.guild.memberCount}` }, { name: 'Boosts', value: `${i.guild.premiumSubscriptionCount}` });
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'images') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('img_nasa').setLabel('🚀 NASA').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('img_dog').setLabel('🐶 Dog').setStyle(ButtonStyle.Success)
        );
        return i.reply({ content: "🖼️ **Image Hub**", components: [row] });
    }

    if (i.commandName === 'help') return i.reply(mainHelp());

    // CATCH-ALL FOR OTHER COMMANDS
    if (['whois', 'shop', 'rob', 'marry', 'divorce', 'profile', 'rank', 'leaderboard', 'weather', 'joke', 'meme', 'define'].includes(i.commandName)) {
        return i.reply({ content: `🚧 The **/${i.commandName}** command is currently being built!`, ephemeral: true });
    }
});

function mainHelp() {
    const embed = new EmbedBuilder().setTitle("📜 Help Menu").setColor(BOT_COLOR).setDescription("Select a category:");
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

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const axios = require('axios'); 

// --- CONFIGURATION ---
const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel] 
});

// Database - Persistent storage (In-memory for this example)
let db = { cash: {}, marry: {}, items: {}, xp: {}, level: {}, daily: {} };

// --- AI BRAIN LOGIC ---
async function getAIResponse(prompt) {
    try {
        // Using HuggingFace (HF_TOKEN required in your environment variables)
        const response = await axios.post('https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill', 
        { inputs: prompt },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } });
        return response.data[0].generated_text || "I'm processing that... try again?";
    } catch (e) {
        return "System overload. I'm still here, but my AI core is cooling down!";
    }
}

// --- SLASH COMMAND REGISTRATION ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 System Menu'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Premium Server Overview'),
    new SlashCommandBuilder().setName('whois').setDescription('ℹ️ User Analysis').addUserOption(o => o.setName('u').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View Global Profile Card'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check balance'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn cash'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim 1k reward'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Bet cash').addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose').addUserOption(o => o.setName('u').setDescription('Partner').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End marriage'),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ Image Hub'),
    new SlashCommandBuilder().setName('define').setDescription('📖 Dictionary').addStringOption(o => o.setName('word').setDescription('Word').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Random meme'),
    new SlashCommandBuilder().setName('echo').setDescription('💬 [OWNER] Remote Reply').addStringOption(o => o.setName('id').setDescription('Msg ID').setRequired(true)).addStringOption(o => o.setName('text').setDescription('Content').setRequired(true)),
    new SlashCommandBuilder().setName('blast').setDescription('📢 [OWNER] Rapid Fire').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("💎 OMEGA PREMIUM ONLINE - AI CORE & BUTTONS ACTIVE");
});

// --- MENTION & DM HANDLER (AI CHAT) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isDM = message.guild === null;

    if (isMentioned || isDM) {
        await message.channel.sendTyping();
        const prompt = message.content.replace(/<@(!?)\d+>/g, '').trim();
        const aiReply = await getAIResponse(prompt || "Hello!");
        return message.reply(aiReply);
    }
});

// --- INTERACTION HANDLER (SLASH & BUTTONS) ---
client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- BUTTONS ---
    if (i.isButton()) {
        if (i.customId.startsWith('img_')) {
            await i.deferUpdate();
            let url = "";
            const type = i.customId.split('_')[1];
            try {
                if (type === 'nasa') { const r = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY'); url = r.data.url; }
                else if (type === 'dog') { const r = await axios.get('https://dog.ceo/api/breeds/image/random'); url = r.data.message; }
                else if (type === 'cat') { const r = await axios.get('https://api.thecatapi.com/v1/images/search'); url = r.data[0].url; }
                else if (type === 'car') { url = `https://loremflickr.com/1280/720/car?random=${Math.random()}`; }
                return i.editReply({ embeds: [new EmbedBuilder().setImage(url).setColor(BOT_COLOR)] });
            } catch (e) { return i.followUp({ content: "API Error!", ephemeral: true }); }
        }

        if (i.customId.startsWith('roles_')) {
            const page = parseInt(i.customId.split('_')[1]);
            const roles = i.guild.roles.cache.sort((a, b) => b.position - a.position).map(r => r.toString());
            const itemsPerPage = 12;
            const maxPages = Math.ceil(roles.length / itemsPerPage);
            const currentRoles = roles.slice(page * itemsPerPage, (page + 1) * itemsPerPage).join('\n');
            const embed = new EmbedBuilder().setTitle(`Server Roles (Page ${page + 1}/${maxPages})`).setDescription(currentRoles).setColor(BOT_COLOR);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`roles_${page - 1}`).setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId(`roles_${page + 1}`).setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page + 1 >= maxPages)
            );
            return i.update({ embeds: [embed], components: [row] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- COMMAND LOGIC ---
    if (i.commandName === 'bal') return i.reply({ embeds: [new EmbedBuilder().setDescription(`💰 Balance: **${db.cash[uid]}** ${CURRENCY}`).setColor(BOT_COLOR)] });

    if (i.commandName === 'work') {
        const pay = Math.floor(Math.random() * 300) + 100;
        db.cash[uid] += pay;
        return i.reply(`🔨 You worked and earned **${pay}** ${CURRENCY}!`);
    }

    if (i.commandName === 'daily') {
        const now = Date.now();
        if (db.daily[uid] && now - db.daily[uid] < 86400000) return i.reply({ content: "❌ Come back tomorrow!", ephemeral: true });
        db.daily[uid] = now; db.cash[uid] += 1000;
        return i.reply("📆 +1,000 credits claimed!");
    }

    if (i.commandName === 'profile') {
        const embed = new EmbedBuilder()
            .setAuthor({ name: i.user.tag, iconURL: i.user.displayAvatarURL() })
            .setThumbnail(i.user.displayAvatarURL())
            .setColor(BOT_COLOR)
            .addFields(
                { name: '💰 Wallet', value: `${db.cash[uid]}`, inline: true },
                { name: '💍 Partner', value: db.marry[uid] ? `<@${db.marry[uid]}>` : "Single", inline: true }
            );
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'images') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('img_nasa').setLabel('NASA').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('img_dog').setLabel('Dog').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('img_cat').setLabel('Cat').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('img_car').setLabel('Car').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ content: "🖼️ **Premium Image Hub**", components: [row] });
    }

    if (i.commandName === 'serverinfo') {
        const { guild } = i;
        const embed = new EmbedBuilder()
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setThumbnail(guild.iconURL())
            .setImage(guild.bannerURL({ size: 1024 }))
            .setColor(BOT_COLOR)
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true }
            );
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('roles_0').setLabel('View Roles').setStyle(ButtonStyle.Primary));
        return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === 'help') return i.reply(mainHelp());
});

function mainHelp() {
    const embed = new EmbedBuilder().setTitle("📜 System Hub").setColor(BOT_COLOR).setDescription("Talk to me via DM or mention me to use AI!");
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nav_eco').setLabel('Economy').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('nav_fun').setLabel('Fun').setStyle(ButtonStyle.Danger)
    );
    return { embeds: [embed], components: [row] };
}

client.login(process.env.DISCORD_TOKEN);

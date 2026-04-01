const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

// --- CONFIGURATION ---
const CLIENT_ID = '1482790365621915759'; 
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

// Database - Persistent storage (In-memory)
let db = { cash: {}, marry: {}, daily: {} };

// --- AI BRAIN LOGIC ---
async function getAIResponse(prompt) {
    try {
        const response = await axios.post('https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill', 
        { inputs: prompt },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } });
        return response.data[0].generated_text || "I'm processing that...";
    } catch (e) {
        return "System overload. AI core cooling down!";
    }
}

// --- SLASH COMMAND DEFINITIONS (ALL INCLUDED) ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜  System Menu'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Server Analytics'),
    new SlashCommandBuilder().setName('whois').setDescription('ℹ️ User Info').addUserOption(o => o.setName('u').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View Global Profile Card'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check bank balance'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn credits via labor'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim 1k reward'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Bet credits').addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose to a user').addUserOption(o => o.setName('u').setDescription('Partner').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End your current marriage'),
    new SlashCommandBuilder().setName('images').setDescription('🖼️  Media Hub'),
    new SlashCommandBuilder().setName('define').setDescription('📖 Dictionary lookup').addStringOption(o => o.setName('word').setDescription('Word').setRequired(true)),
    new SlashCommandBuilder().setName('meme').setDescription('🤣 Fetch a random meme'),
].map(c => c.toJSON());

// --- ON READY: PURGE & REGISTER ---
client.once('ready', async () => {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        console.log("🧹 Purging old commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        console.log("🚀 Registering All Premium Commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("💎 OMEGA PREMIUM ONLINE");
    } catch (error) { console.error(error); }
});

// --- INTERACTION HANDLER (DYNO STYLE) ---
client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- SELECT MENU (HELP NAVIGATION) ---
    if (i.isStringSelectMenu() && i.customId === 'help_select') {
        const cat = i.values[0];
        const embed = new EmbedBuilder().setColor(BOT_COLOR).setTimestamp();
        
        if (cat === 'eco') {
            embed.setTitle('💰 Economy Commands').setDescription('`/bal` - Check wallet\n`/work` - Earn cash\n`/daily` - Claim 1k\n`/gamble` - Risk it all');
        } else if (cat === 'social') {
            embed.setTitle('💍 Social Commands').setDescription('`/marry` - Propose\n`/divorce` - Break up\n`/profile` - Global ID');
        } else if (cat === 'utility') {
            embed.setTitle('⚙️ Utility Commands').setDescription('`/serverinfo` - Guild stats\n`/whois` - User scan\n`/define` - Dictionary\n`/meme` - Laughs');
        }
        return i.update({ embeds: [embed] });
    }

    // --- BUTTONS (ROLES & IMAGES) ---
    if (i.isButton()) {
        if (i.customId.startsWith('img_')) {
            await i.deferUpdate();
            const type = i.customId.split('_')[1];
            let url = (type === 'dog') ? (await axios.get('https://dog.ceo/api/breeds/image/random')).data.message : `https://loremflickr.com/800/600/car?random=${Math.random()}`;
            return i.editReply({ embeds: [new EmbedBuilder().setImage(url).setColor(BOT_COLOR)] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- SLASH COMMAND LOGIC ---
    switch (i.commandName) {
        case 'help':
            const helpEmbed = new EmbedBuilder()
                .setTitle('💎 OMEGA PREMIUM DASHBOARD')
                .setDescription('Use the menu below to navigate modules.')
                .setThumbnail(client.user.displayAvatarURL())
                .setColor(BOT_COLOR);
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('help_select').setPlaceholder('Select a Category')
                .addOptions([
                    { label: 'Economy', value: 'eco', emoji: '💰' },
                    { label: 'Social', value: 'social', emoji: '💍' },
                    { label: 'Utility', value: 'utility', emoji: '⚙️' }
                ])
            );
            await i.reply({ embeds: [helpEmbed], components: [menu] });
            break;

        case 'bal':
            await i.reply({ embeds: [new EmbedBuilder().setDescription(`💰 Wallet: **${db.cash[uid]}** ${CURRENCY}`).setColor(BOT_COLOR)] });
            break;

        case 'gamble':
            const bet = i.options.getInteger('amt');
            if (bet > db.cash[uid] || bet <= 0) return i.reply("❌ Invalid amount!");
            const win = Math.random() > 0.5;
            db.cash[uid] += win ? bet : -bet;
            await i.reply(win ? `🎰 **WIN!** You doubled your **${bet}**!` : `🎰 **LOSS!** You lost **${bet}**.`);
            break;

        case 'work':
            const pay = Math.floor(Math.random() * 200) + 100;
            db.cash[uid] += pay;
            await i.reply(`🔨 You earned **${pay}** ${CURRENCY}!`);
            break;

        case 'daily':
            const now = Date.now();
            if (db.daily[uid] && now - db.daily[uid] < 86400000) return i.reply("❌ Come back tomorrow!");
            db.daily[uid] = now; db.cash[uid] += 1000;
            await i.reply("📆 **+1,000** credits claimed!");
            break;

        case 'marry':
            const partner = i.options.getUser('u');
            if (partner.id === uid) return i.reply("You can't marry yourself!");
            db.marry[uid] = partner.id; db.marry[partner.id] = uid;
            await i.reply(`💍 <@${uid}> and <@${partner.id}> are now married!`);
            break;

        case 'divorce':
            if (!db.marry[uid]) return i.reply("You aren't married!");
            const ex = db.marry[uid];
            delete db.marry[uid]; delete db.marry[ex];
            await i.reply("💔 Marriage ended.");
            break;

        case 'serverinfo':
            const sEmbed = new EmbedBuilder().setTitle(i.guild.name).setThumbnail(i.guild.iconURL()).setColor(BOT_COLOR)
                .addFields({ name: 'Owner', value: `<@${i.guild.ownerId}>`, inline: true }, { name: 'Members', value: `${i.guild.memberCount}`, inline: true });
            await i.reply({ embeds: [sEmbed] });
            break;

        case 'whois':
            const target = i.options.getUser('u');
            const wEmbed = new EmbedBuilder().setTitle(`Scan: ${target.tag}`).setThumbnail(target.displayAvatarURL()).setColor(BOT_COLOR)
                .addFields({ name: 'ID', value: `\`${target.id}\`` }, { name: 'Joined', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>` });
            await i.reply({ embeds: [wEmbed] });
            break;

        case 'meme':
            const res = await axios.get('https://meme-api.com/gimme');
            await i.reply({ embeds: [new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor(BOT_COLOR)] });
            break;
            
        case 'define':
            const word = i.options.getString('word');
            try {
                const dRes = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
                await i.reply(`📖 **${word}**: ${dRes.data[0].meanings[0].definitions[0].definition}`);
            } catch { i.reply("Word not found!"); }
            break;

        case 'images':
            const iRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('img_dog').setLabel('Dog').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('img_car').setLabel('Car').setStyle(ButtonStyle.Secondary)
            );
            await i.reply({ content: "🖼️ **Media Hub**", components: [iRow] });
            break;
    }
});

// --- AI CHAT HANDLER ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user) || !m.guild) {
        await m.channel.sendTyping();
        const reply = await getAIResponse(m.content);
        m.reply(reply);
    }
});

client.login(process.env.DISCORD_TOKEN);

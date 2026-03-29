const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ intents: [3276799] });

// --- DATABASE ---
let db = { cash: {}, marry: {}, items: {}, daily: {} };

// --- 1. SLASH COMMANDS REGISTRATION ---
const commands = [
    new SlashCommandBuilder().setName('images').setDescription('🖼️ View random images (NASA, Dogs, Cats)'),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose to someone').addUserOption(o => o.setName('u').setDescription('The user').setRequired(true)),
    new SlashBuilder().setName('divorce').setDescription('💔 End your marriage'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View your marriage, cash, and items'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setRequired(true)).addUserOption(o => o.setName('u2').setRequired(true)),
    new SlashCommandBuilder().setName('rob').setDescription('🔫 Rob a user').addUserOption(o => o.setName('t').setDescription('Target').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Buy protection padlocks'),
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Check weather').addStringOption(o => o.setName('city').setRequired(true)),
    new SlashCommandBuilder().setName('define').setDescription('📖 Dictionary').addStringOption(o => o.setName('word').setRequired(true)),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check wallet'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim cash'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn money'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏰 Stats'),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t')),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Turbo Spam').addStringOption(o => o.setName('t').setRequired(true)).addIntegerOption(o => o.setName('a')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ All Commands Registered and Online!");
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;
    if (!db.items[uid]) db.items[uid] = { padlocks: 0 };

    // --- BUTTON HANDLER ---
    if (i.isButton()) {
        if (i.customId.startsWith('accept_marry_')) {
            const proposerId = i.customId.split('_')[2];
            db.marry[proposerId] = i.user.id;
            db.marry[i.user.id] = proposerId;
            return i.update({ content: `💖 **Marriage Official!** <@${proposerId}> and <@${i.user.id}> are now together!`, components: [] });
        }
        if (i.customId === 'img_cat') {
            await i.deferUpdate();
            const res = await axios.get('https://api.thecatapi.com/v1/images/search');
            return i.editReply({ content: "🐱 Meow!", embeds: [new EmbedBuilder().setImage(res.data[0].url).setColor(BOT_COLOR)] });
        }
        if (i.customId === 'img_dog') {
            await i.deferUpdate();
            const res = await axios.get('https://dog.ceo/api/breeds/image/random');
            return i.editReply({ content: "🐶 Woof!", embeds: [new EmbedBuilder().setImage(res.data.message).setColor(BOT_COLOR)] });
        }
        if (i.customId === 'img_nasa') {
            await i.deferUpdate();
            const res = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`);
            return i.editReply({ content: "🌌 Space!", embeds: [new EmbedBuilder().setTitle(res.data.title).setImage(res.data.url).setColor('#0B3D91')] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- MARRIAGE & SOCIAL ---
    if (i.commandName === 'marry') {
        const target = i.options.getUser('u');
        if (db.marry[uid]) return i.reply("❌ You are already married!");
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_marry_${uid}`).setLabel('I Do').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('deny').setLabel('No').setStyle(ButtonStyle.Danger)
        );
        return i.reply({ content: `<@${target.id}>, proposal from **${i.user.username}**!`, components: [row] });
    }

    if (i.commandName === 'divorce') {
        if (!db.marry[uid]) return i.reply("❌ You aren't married.");
        const partner = db.marry[uid];
        delete db.marry[uid]; delete db.marry[partner];
        return i.reply("💔 You are now single.");
    }

    if (i.commandName === 'ship') {
        const u1 = i.options.getUser('u1');
        const u2 = i.options.getUser('u2');
        const rate = Math.floor(Math.random() * 101);
        return i.reply(`❤️ **${u1.username}** + **${u2.username}** = **${rate}%** compatibility!`);
    }

    // --- ECONOMY & CRIME ---
    if (i.commandName === 'rob') {
        const target = i.options.getUser('t');
        if (db.items[target.id]?.padlocks > 0) {
            db.items[target.id].padlocks -= 1;
            return i.reply(`🔒 **FAILED!** ${target.username} had a padlock.`);
        }
        const amount = Math.floor((db.cash[target.id] || 0) * 0.2);
        db.cash[uid] += amount; db.cash[target.id] -= amount;
        return i.reply(`🔫 Stole **${CURRENCY}${amount}** from ${target.username}!`);
    }

    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 200) + 50;
        db.cash[uid] += gain;
        return i.reply(`🔨 Earned **${CURRENCY}${gain}**!`);
    }

    if (i.commandName === 'daily') {
        const last = db.daily[uid] || 0;
        if (Date.now() - last < 86400000) return i.reply("❌ Already claimed today!");
        db.daily[uid] = Date.now(); db.cash[uid] += 1000;
        return i.reply(`📆 Claimed **${CURRENCY}1000**!`);
    }

    // --- UTILITY ---
    if (i.commandName === 'weather') {
        const city = i.options.getString('city');
        return i.reply(`☁️ The weather in **${city}** is currently clear and 22°C.`);
    }

    if (i.commandName === 'define') {
        const word = i.options.getString('word');
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`).catch(() => null);
        if (!res) return i.reply("❌ Word not found.");
        return i.reply(`📖 **${word}**: ${res.data[0].meanings[0].definitions[0].definition}`);
    }

    if (i.commandName === 'whois') {
        const target = i.options.getUser('t') || i.user;
        const embed = new EmbedBuilder().setTitle(target.tag).setThumbnail(target.displayAvatarURL()).setColor(BOT_COLOR);
        return i.reply({ embeds: [embed] });
    }

    // --- HUB COMMANDS ---
    if (i.commandName === 'images') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('img_nasa').setLabel('NASA').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('img_dog').setLabel('Dog').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('img_cat').setLabel('Cat').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ content: "🖼️ **Choose image category:**", components: [row] });
    }

    if (i.commandName === 'profile') {
        const spouse = db.marry[uid] ? `<@${db.marry[uid]}>` : 'Single';
        const embed = new EmbedBuilder().setTitle(`👤 ${i.user.username}`).addFields(
            { name: '💍 Status', value: spouse, inline: true },
            { name: '💰 Cash', value: `${CURRENCY}${db.cash[uid]}`, inline: true }
        ).setColor(BOT_COLOR);
        return i.reply({ embeds: [embed] });
    }

    // --- OWNER ---
    if (i.commandName === 'spam') {
        if (uid !== OWNER_ID) return i.reply({ content: "❌ No.", ephemeral: true });
        const text = i.options.getString('t');
        const amt = i.options.getInteger('a') || 5;
        await i.reply({ content: "🚀 Starting...", ephemeral: true });
        for (let x = 0; x < (amt > 20 ? 20 : amt); x++) {
            i.channel.send(text).catch(() => {});
            await new Promise(r => setTimeout(r, 740)); 
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

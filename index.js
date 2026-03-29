const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios'); 

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ intents: [3276799] });

// Database including leveling and streaks
let db = { cash: {}, marry: {}, items: {}, daily: {}, messages: {}, streaks: {}, lastMsg: {} };

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 View all bot commands'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Open the Casino Hub'),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ View random images'),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose').addUserOption(o => o.setName('u').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End marriage'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View stats'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setRequired(true)).addUserOption(o => o.setName('u2').setRequired(true)),
    new SlashCommandBuilder().setName('rob').setDescription('🔫 Rob someone').addUserOption(o => o.setName('t').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Buy items'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check wallet'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn money'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim cash'),
    new SlashCommandBuilder().setName('rank').setDescription('📊 View your message stats').addUserOption(o => o.setName('u')),
    new SlashCommandBuilder().setName('messages').setDescription('💬 Your total messages sent'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top 10 most active members'),
    new SlashCommandBuilder().setName('streak').setDescription('🔥 View your daily activity streak'),
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Weather').addStringOption(o => o.setName('city').setRequired(true)),
    new SlashCommandBuilder().setName('define').setDescription('📖 Dictionary').addStringOption(o => o.setName('word').setRequired(true)),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t')),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Spam').addStringOption(o => o.setName('t').setRequired(true)).addIntegerOption(o => o.setName('a')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🧹 Cleaning old commands...");
        // Deletes old global commands so they don't show up twice
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); 
        // Registers fresh guild commands
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ Wimble is Online and Clean!");
    } catch (e) { console.error(e); }
});

// --- ACTIVITY TRACKER (CASH PER MESSAGE) ---
client.on('messageCreate', (m) => {
    if (m.author.bot) return;
    const uid = m.author.id;

    // Give 2-5 cash per message
    db.cash[uid] = (db.cash[uid] || 500) + Math.floor(Math.random() * 4) + 2;
    db.messages[uid] = (db.messages[uid] || 0) + 1;

    // Streak Logic (24h - 48h window)
    const now = Date.now();
    const diff = now - (db.lastMsg[uid] || 0);
    const day = 86400000;
    if (diff > day && diff < day * 2) db.streaks[uid] = (db.streaks[uid] || 0) + 1;
    else if (diff > day * 2) db.streaks[uid] = 1;
    db.lastMsg[uid] = now;
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;
    if (!db.items[uid]) db.items[uid] = { padlocks: 0 };

    if (i.isButton()) {
        if (i.customId.startsWith('gamble_')) {
            if (db.cash[uid] < 100) return i.reply({ content: "❌ You need 100 to gamble!", ephemeral: true });
        }

        if (i.customId === 'gamble_slots') {
            const win = Math.random() > 0.7;
            if (win) { db.cash[uid] += 200; return i.reply(`🎰 **WIN!** Won **${CURRENCY}200**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🎰 **LOSS!** Lost **${CURRENCY}100**.`); }
        }

        if (i.customId === 'gamble_coin') {
            const win = Math.random() > 0.5;
            if (win) { db.cash[uid] += 100; return i.reply(`🪙 **Heads!** Won **${CURRENCY}100**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🪙 **Tails!** Lost **${CURRENCY}100**.`); }
        }

        if (i.customId === 'gamble_roulette') {
            const win = Math.random() > 0.6;
            if (win) { db.cash[uid] += 250; return i.reply(`🟢 **GREEN!** Won **${CURRENCY}250**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🔴 **RED.** Lost **${CURRENCY}100**.`); }
        }

        if (i.customId === 'gamble_scratch') {
            const win = Math.random() > 0.8;
            if (win) { db.cash[uid] += 500; return i.reply(`🎫 **JACKPOT!** Won **${CURRENCY}500**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🎫 **No match.** Lost **${CURRENCY}100**.`); }
        }

        if (i.customId === 'gamble_bombs') {
            if (Math.random() > 0.5) { db.cash[uid] -= 100; return i.reply(`💣 **BOOM!** Lost **${CURRENCY}100**.`); }
            else { db.cash[uid] += 150; return i.reply(`📦 **SAFE!** Found **${CURRENCY}150**.`); }
        }

        if (i.customId === 'img_cat') {
            await i.deferUpdate();
            const res = await axios.get('https://api.thecatapi.com/v1/images/search');
            return i.editReply({ embeds: [new EmbedBuilder().setImage(res.data[0].url).setColor(BOT_COLOR)] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- HELP COMMAND ---
    if (i.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle("📜 Wimble Commands")
            .setColor(BOT_COLOR)
            .addFields(
                { name: '💰 Economy', value: '`/bal`, `/work`, `/rob`, `/gamble`, `/shop`, `/daily`' },
                { name: '📊 Stats', value: '`/rank`, `/messages`, `/leaderboard`, `/streak`' },
                { name: '❤️ Social', value: '`/marry`, `/divorce`, `/ship`, `/profile`, `/whois`' },
                { name: '🖼️ Fun', value: '`/images`, `/weather`, `/define`' }
            );
        return i.reply({ embeds: [embed] });
    }

    // --- LEVELING COMMANDS ---
    if (i.commandName === 'messages') return i.reply(`💬 You have sent **${db.messages[uid] || 0}** messages!`);
    
    if (i.commandName === 'rank') {
        const target = i.options.getUser('u') || i.user;
        const embed = new EmbedBuilder()
            .setTitle(`${target.username}'s Rank`)
            .setColor(BOT_COLOR)
            .addFields(
                { name: '💬 Messages', value: `${db.messages[target.id] || 0}`, inline: true },
                { name: '🔥 Streak', value: `${db.streaks[target.id] || 1} Days`, inline: true },
                { name: '💰 Wallet', value: `${CURRENCY}${db.cash[target.id] || 0}`, inline: true }
            );
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'leaderboard') {
        const sorted = Object.entries(db.messages).sort(([,a],[,b]) => b-a).slice(0, 10);
        const lb = sorted.map(([id, cnt], index) => `**#${index+1}** <@${id}>: ${cnt} messages`).join('\n');
        return i.reply(`🏆 **Activity Leaderboard**\n${lb || "No data yet!"}`);
    }

    if (i.commandName === 'streak') return i.reply(`🔥 Your current streak is: **${db.streaks[uid] || 1} days**!`);

    // --- EXISTING COMMANDS ---
    if (i.commandName === 'gamble') {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gamble_slots').setLabel('Slots').setEmoji('🎰').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gamble_coin').setLabel('Coinflip').setEmoji('🪙').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gamble_roulette').setLabel('Roulette').setEmoji('🎡').setStyle(ButtonStyle.Success)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gamble_scratch').setLabel('Scratch').setEmoji('🎫').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('gamble_bombs').setLabel('Bombs').setEmoji('💣').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ content: "🎰 **CASINO HUB** 🎰", components: [row1, row2] });
    }

    if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY}${db.cash[uid]}`);
    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 200) + 50;
        db.cash[uid] += gain;
        return i.reply(`🔨 Earned **${CURRENCY}${gain}**!`);
    }

    if (i.commandName === 'spam') {
        if (uid !== OWNER_ID) return i.reply("❌ No.");
        const text = i.options.getString('t');
        const amt = i.options.getInteger('a') || 5;
        await i.reply({ content: "🚀 Running...", ephemeral: true });
        for (let x = 0; x < (amt > 15 ? 15 : amt); x++) {
            i.channel.send(text).catch(() => {});
            await new Promise(r => setTimeout(r, 800)); 
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios'); 

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ intents: [3276799] });

let db = { cash: {}, marry: {}, items: {}, daily: {} };

const commands = [
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
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Weather').addStringOption(o => o.setName('city').setRequired(true)),
    new SlashCommandBuilder().setName('define').setDescription('📖 Dictionary').addStringOption(o => o.setName('word').setRequired(true)),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t')),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Spam').addStringOption(o => o.setName('t').setRequired(true)).addIntegerOption(o => o.setName('a')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ All Commands & Casino Hub Ready!");
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;
    if (!db.items[uid]) db.items[uid] = { padlocks: 0 };

    if (i.isButton()) {
        if (i.customId.startsWith('gamble_')) {
            if (db.cash[uid] < 100) return i.reply({ content: "❌ You need 100 to gamble!", ephemeral: true });
        }

        // --- SLOTS ---
        if (i.customId === 'gamble_slots') {
            const win = Math.random() > 0.7;
            if (win) { db.cash[uid] += 200; return i.reply(`🎰 **WIN!** You got 🍒🍒🍒! Won **${CURRENCY}200**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🎰 **LOSS!** You got 🍋🍒🥝. Lost **${CURRENCY}100**.`); }
        }

        // --- COINFLIP ---
        if (i.customId === 'gamble_coin') {
            const win = Math.random() > 0.5;
            if (win) { db.cash[uid] += 100; return i.reply(`🪙 **Heads!** You won **${CURRENCY}100**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🪙 **Tails!** You lost **${CURRENCY}100**.`); }
        }

        // --- ROULETTE ---
        if (i.customId === 'gamble_roulette') {
            const win = Math.random() > 0.6;
            if (win) { db.cash[uid] += 250; return i.reply(`🟢 **Roulette:** Landed on GREEN! You won **${CURRENCY}250**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🔴 **Roulette:** Landed on RED. Lost **${CURRENCY}100**.`); }
        }

        // --- SCRATCH ---
        if (i.customId === 'gamble_scratch') {
            const sym = ['💎', '💰', '❌'];
            const r = () => sym[Math.floor(Math.random() * sym.length)];
            const [s1, s2, s3] = [r(), r(), r()];
            if (s1 === s2 && s2 === s3 && s1 !== '❌') {
                db.cash[uid] += 500; return i.reply(`🎫 **SCRATCH:** [ ${s1} | ${s2} | ${s3} ] - **JACKPOT!** Won **${CURRENCY}500**!`);
            } else {
                db.cash[uid] -= 100; return i.reply(`🎫 **SCRATCH:** [ ${s1} | ${s2} | ${s3} ] - No match. Lost **${CURRENCY}100**.`);
            }
        }

        // --- BOMBS ---
        if (i.customId === 'gamble_bombs') {
            const boom = Math.random() > 0.5;
            if (boom) { db.cash[uid] -= 100; return i.reply(`💣 **BOOM!** It exploded. Lost **${CURRENCY}100**.`); }
            else { db.cash[uid] += 150; return i.reply(`📦 **Defused!** Found **${CURRENCY}150** inside!`); }
        }

        // --- IMAGES ---
        if (i.customId === 'img_cat') {
            await i.deferUpdate();
            const res = await axios.get('https://api.thecatapi.com/v1/images/search');
            return i.editReply({ embeds: [new EmbedBuilder().setImage(res.data[0].url).setColor(BOT_COLOR)] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- GAMBLE HUB ---
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
        return i.reply({ content: "🎰 **CASINO HUB** 🎰\nPick a game (Cost: 100 per play):", components: [row1, row2] });
    }

    // --- ECONOMY ---
    if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY}${db.cash[uid]}`);
    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 200) + 50;
        db.cash[uid] += gain;
        return i.reply(`🔨 Earned **${CURRENCY}${gain}**!`);
    }

    // --- REST OF COMMANDS ---
    if (i.commandName === 'weather') return i.reply(`☁️ Weather in **${i.options.getString('city')}** is clear at 22°C.`);
    if (i.commandName === 'rob') {
        const target = i.options.getUser('t');
        if (db.items[target.id]?.padlocks > 0) {
            db.items[target.id].padlocks -= 1;
            return i.reply(`🔒 **FAILED!** They had a padlock.`);
        }
        const amt = Math.floor((db.cash[target.id] || 0) * 0.2);
        db.cash[uid] += amt; db.cash[target.id] -= amt;
        return i.reply(`🔫 Stole **${CURRENCY}${amt}**!`);
    }
});

client.login(process.env.DISCORD_TOKEN);

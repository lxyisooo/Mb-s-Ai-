const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios'); 

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ intents: [3276799] });

// Database initialization
let db = { cash: {}, marry: {}, items: {}, daily: {}, messages: {}, streaks: {}, lastMsg: {} };

// --- HELPER: GHOST PING ---
async function ghostPing(channel, user) {
    const msg = await channel.send(`${user}`);
    return msg.delete().catch(() => {}); 
}

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 View all bot commands'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View your profile card').addUserOption(o => o.setName('u').setDescription('User to view')),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check wallet'),
    new SlashCommandBuilder().setName('pay').setDescription('🤝 Give money').addUserOption(o => o.setName('u').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn money'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim cash'),
    new SlashCommandBuilder().setName('shop').setDescription('🛍️ Luxury Shopping Mall'),
    new SlashCommandBuilder().setName('rob').setDescription('🔫 Rob someone').addUserOption(o => o.setName('t').setDescription('Target').setRequired(true)),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Casino Hub'),
    new SlashCommandBuilder().setName('roulette').setDescription('🎡 Bet on colors').addStringOption(o => o.setName('color').setRequired(true).addChoices({name:'Red (2x)', value:'red'},{name:'Black (2x)', value:'black'},{name:'Green (14x)', value:'green'})).addIntegerOption(o => o.setName('amount').setRequired(true)),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose').addUserOption(o => o.setName('u').setDescription('Partner').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End marriage'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setRequired(true)).addUserOption(o => o.setName('u2').setRequired(true)),
    new SlashCommandBuilder().setName('rank').setDescription('📊 View message stats'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top active members'),
    new SlashCommandBuilder().setName('streak').setDescription('🔥 View daily activity streak'),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Server details'),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ Random images'),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Spam').addStringOption(o => o.setName('t').setRequired(true)).addIntegerOption(o => o.setName('a')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ Wimble Ultimate is Online!");
    } catch (e) { console.error(e); }
});

// Message tracking for Rank/Streaks
client.on('messageCreate', (m) => {
    if (m.author.bot) return;
    const uid = m.author.id;
    db.cash[uid] = (db.cash[uid] || 500) + 5;
    db.messages[uid] = (db.messages[uid] || 0) + 1;
    const now = Date.now();
    const diff = now - (db.lastMsg[uid] || 0);
    if (diff > 86400000 && diff < 172800000) db.streaks[uid] = (db.streaks[uid] || 0) + 1;
    else if (diff > 172800000) db.streaks[uid] = 1;
    db.lastMsg[uid] = now;
});

client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;
    if (!db.items[uid]) db.items[uid] = { padlocks: 0, phones: 0, cars: 0, rolex: 0 };

    if (i.isButton()) {
        // --- PAGINATION / SERVER INFO ---
        if (i.customId === 'server_roles') {
            const roles = i.guild.roles.cache.filter(r => r.name !== '@everyone').sort((a,b)=>b.position-a.position).map(r=>r.toString());
            const embeds = [];
            for (let x=0; x<roles.length; x+=20) {
                if(embeds.length>=5) break;
                embeds.push(new EmbedBuilder().setTitle(`🎭 Roles Page ${embeds.length+1}`).setColor(BOT_COLOR).setDescription(roles.slice(x, x+20).join(' ') || "None"));
            }
            return i.reply({ embeds, ephemeral: true });
        }

        // --- LUXURY SHOP BUYING ---
        const prices = { padlock: 500, iphone: 12000, rolex: 45000, supercar: 250000 };
        if (i.customId.startsWith('buy_')) {
            const item = i.customId.replace('buy_', '');
            if (db.cash[uid] < prices[item]) return i.reply({ content: "❌ Not enough money!", ephemeral: true });
            db.cash[uid] -= prices[item];
            if (item === 'padlock') db.items[uid].padlocks++;
            if (item === 'iphone') db.items[uid].phones++;
            if (item === 'rolex') db.items[uid].rolex++;
            if (item === 'supercar') db.items[uid].cars++;
            return i.reply(`🛍️ Bought a **${item.toUpperCase()}**!`);
        }

        // --- LIVE SLOTS ---
        if (i.customId === 'gamble_slots') {
            if (db.cash[uid] < 100) return i.reply({ content: "❌ Need 100!", ephemeral: true });
            db.cash[uid] -= 100;
            const ems = ['💎', '🍒', '🌟', '🍎'];
            await i.reply("🎰 **SPINNING...**\n[ 🔄 | 🔄 | 🔄 ]");
            setTimeout(async () => {
                const s = [ems[Math.floor(Math.random()*4)], ems[Math.floor(Math.random()*4)], ems[Math.floor(Math.random()*4)]];
                let win = s[0]===s[1] && s[1]===s[2] ? 1500 : (s[0]===s[1] || s[1]===s[2] || s[0]===s[2] ? 200 : 0);
                db.cash[uid] += win;
                await i.editReply(`🎰 **SLOTS**\n[ ${s[0]} | ${s[1]} | ${s[2]} ]\n\n${win > 0 ? `✨ Won **${CURRENCY}${win}**!` : "💀 Lost."}`);
            }, 1000);
            return;
        }

        // --- MARRIAGE ACCEPT ---
        if (i.customId.startsWith('accept_')) {
            const ids = i.customId.split('_');
            if (i.user.id !== ids[2]) return i.reply({ content: "Not for you!", ephemeral: true });
            db.marry[ids[1]] = ids[2]; db.marry[ids[2]] = ids[1];
            return i.update({ content: `🎉 <@${ids[1]}> and <@${ids[2]}> are now married! 💍`, components: [] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- COMMAND LOGIC ---
    if (i.commandName === 'profile') {
        const target = i.options.getUser('u') || i.user;
        const spouse = db.marry[target.id] ? `<@${db.marry[target.id]}>` : "Single";
        const inv = db.items[target.id] || { padlocks:0, phones:0, rolex:0, cars:0 };
        const embed = new EmbedBuilder().setTitle(`👤 ${target.username}`).setColor(BOT_COLOR).setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: '💰 Wallet', value: `${CURRENCY}${db.cash[target.id] || 0}`, inline: true },
                { name: '💍 Partner', value: spouse, inline: true },
                { name: '🎒 Items', value: `🔒 ${inv.padlocks} | 📱 ${inv.phones} | ⌚ ${inv.rolex} | 🏎️ ${inv.cars}` }
            );
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'shop') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('buy_iphone').setLabel('iPhone (12k)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('buy_rolex').setLabel('Rolex (45k)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('buy_supercar').setLabel('Supercar (250k)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('buy_padlock').setLabel('Padlock (500)').setStyle(ButtonStyle.Success)
        );
        return i.reply({ content: "🛍️ **Luxury Shop**", components: [row] });
    }

    if (i.commandName === 'serverinfo') {
        await ghostPing(i.channel, i.user);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('server_roles').setLabel('Roles').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('server_owner').setLabel('Owner').setStyle(ButtonStyle.Secondary)
        );
        const embed = new EmbedBuilder().setTitle(`🏢 ${i.guild.name}`).setThumbnail(i.guild.iconURL()).setColor(BOT_COLOR).addFields(
            { name: '👥 Members', value: `${i.guild.memberCount}`, inline: true },
            { name: '🎭 Roles', value: `${i.guild.roles.cache.size}`, inline: true }
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === 'roulette') {
        const bet = i.options.getInteger('amount');
        const color = i.options.getString('color');
        if (bet > db.cash[uid] || bet <= 0) return i.reply("❌ Broke.");
        await i.reply("🎡 Spinning...");
        setTimeout(() => {
            const res = Math.random() * 37;
            let landed = res < 1 ? 'green' : (res < 19 ? 'red' : 'black');
            if (color === landed) {
                const multi = landed === 'green' ? 14 : 2;
                db.cash[uid] += bet * (multi - 1);
                i.editReply(`🎡 **${landed.toUpperCase()}!** Won **${CURRENCY}${bet * multi}**`);
            } else {
                db.cash[uid] -= bet;
                i.editReply(`🎡 **${landed.toUpperCase()}**. Lost **${CURRENCY}${bet}**`);
            }
        }, 1500);
    }

    if (i.commandName === 'marry') {
        const target = i.options.getUser('u');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`accept_${uid}_${target.id}`).setLabel('Accept').setStyle(ButtonStyle.Success));
        return i.reply({ content: `💍 ${target}, propose from ${i.user.username}?`, components: [row] });
    }

    if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY}${db.cash[uid]}`);
    if (i.commandName === 'work') {
        const g = Math.floor(Math.random()*200)+50;
        db.cash[uid]+=g; return i.reply(`🔨 Earned ${CURRENCY}${g}`);
    }
    if (i.commandName === 'ship') {
        const love = Math.floor(Math.random() * 101);
        return i.reply(`❤️ **Match:** ${i.options.getUser('u1')} x ${i.options.getUser('u2')} is **${love}%**!`);
    }

    if (i.commandName === 'spam' && uid === OWNER_ID) {
        const t = i.options.getString('t');
        const a = Math.min(i.options.getInteger('a') || 5, 15);
        i.reply({ content: "🚀 Running...", ephemeral: true });
        for (let x=0; x<a; x++) { i.channel.send(t); await new Promise(r => setTimeout(r, 500)); }
    }
});

client.login(process.env.DISCORD_TOKEN);

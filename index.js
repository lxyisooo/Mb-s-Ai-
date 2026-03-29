const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios'); 

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ intents: [3276799] });

let db = { cash: {}, marry: {}, items: {}, daily: {}, messages: {}, streaks: {}, lastMsg: {} };

// --- HELPER: GHOST PING ---
async function ghostPing(channel, user) {
    const msg = await channel.send(`${user}`);
    return msg.delete().catch(() => {}); 
}

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('📜 View all bot commands'),
    new SlashCommandBuilder().setName('gamble').setDescription('🎰 Open the Casino Hub'),
    new SlashCommandBuilder().setName('images').setDescription('🖼️ View random images'),
    new SlashCommandBuilder().setName('marry').setDescription('💍 Propose').addUserOption(o => o.setName('u').setDescription('User to propose to').setRequired(true)),
    new SlashCommandBuilder().setName('divorce').setDescription('💔 End marriage'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View stats'),
    new SlashCommandBuilder().setName('ship').setDescription('❤️ Match maker').addUserOption(o => o.setName('u1').setDescription('First person').setRequired(true)).addUserOption(o => o.setName('u2').setDescription('Second person').setRequired(true)),
    new SlashCommandBuilder().setName('rob').setDescription('🔫 Rob someone').addUserOption(o => o.setName('t').setDescription('The target to rob').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Buy items'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check wallet'),
    new SlashCommandBuilder().setName('work').setDescription('🔨 Earn money'),
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim cash'),
    new SlashCommandBuilder().setName('rank').setDescription('📊 View your message stats').addUserOption(o => o.setName('u').setDescription('User to check')),
    new SlashCommandBuilder().setName('messages').setDescription('💬 Your total messages sent'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 Top 10 most active members'),
    new SlashCommandBuilder().setName('streak').setDescription('🔥 View your daily activity streak'),
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Weather').addStringOption(o => o.setName('city').setDescription('City name').setRequired(true)),
    new SlashCommandBuilder().setName('define').setDescription('📖 Dictionary').addStringOption(o => o.setName('word').setDescription('Word to look up').setRequired(true)),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t').setDescription('User to inspect')),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏢 Get details about this server'),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Spam').addStringOption(o => o.setName('t').setDescription('Text to spam').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Amount of messages')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); 
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ Wimble is fully loaded with all commands!");
    } catch (e) { console.error(e); }
});

client.on('messageCreate', (m) => {
    if (m.author.bot) return;
    const uid = m.author.id;
    db.cash[uid] = (db.cash[uid] || 500) + Math.floor(Math.random() * 4) + 2;
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
    if (!db.items[uid]) db.items[uid] = { padlocks: 0 };

    if (i.isButton()) {
        // --- SERVER ROLES PAGINATION (20 ROLES PER EMBED, UP TO 5 EMBEDS) ---
        if (i.customId === 'server_roles') {
            const roles = i.guild.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position).map(r => r.toString());
            const embeds = [];
            for (let x = 0; x < roles.length; x += 20) {
                if (embeds.length >= 5) break;
                embeds.push(new EmbedBuilder().setTitle(`🎭 Roles Page ${embeds.length + 1}`).setColor(BOT_COLOR).setDescription(roles.slice(x, x + 20).join(' ')));
            }
            return i.reply({ embeds, ephemeral: true });
        }

        if (i.customId === 'server_owner') {
            const owner = await i.guild.fetchOwner();
            return i.reply({ content: `👑 **Owner:** ${owner.user.tag}`, ephemeral: true });
        }

        // --- ECONOMY BUTTONS ---
        if (i.customId.startsWith('gamble_') && db.cash[uid] < 100) return i.reply({ content: "❌ You need 100 to gamble!", ephemeral: true });
        
        if (i.customId === 'gamble_slots') {
            const win = Math.random() > 0.7;
            if (win) { db.cash[uid] += 200; return i.reply(`🎰 **WIN!** Won **${CURRENCY}200**!`); }
            else { db.cash[uid] -= 100; return i.reply(`🎰 **LOSS!** Lost **${CURRENCY}100**.`); }
        }

        if (i.customId === 'buy_padlock') {
            if (db.cash[uid] < 500) return i.reply({ content: "❌ You need 500!", ephemeral: true });
            db.cash[uid] -= 500; db.items[uid].padlocks += 1;
            return i.reply(`🛒 Bought a **Padlock**! Total: ${db.items[uid].padlocks}`);
        }

        if (i.customId === 'img_cat') {
            await i.deferUpdate();
            const res = await axios.get('https://api.thecatapi.com/v1/images/search');
            return i.editReply({ embeds: [new EmbedBuilder().setImage(res.data[0].url).setColor(BOT_COLOR)] });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- UTILITY COMMANDS ---
    if (i.commandName === 'serverinfo') {
        await ghostPing(i.channel, i.user);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('server_roles').setLabel('View Roles').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('server_owner').setLabel('Show Owner').setStyle(ButtonStyle.Secondary)
        );
        const embed = new EmbedBuilder().setTitle(`🏢 ${i.guild.name}`).setThumbnail(i.guild.iconURL()).setColor(BOT_COLOR).addFields(
            { name: '👥 Members', value: `${i.guild.memberCount}`, inline: true },
            { name: '🎭 Roles', value: `${i.guild.roles.cache.size}`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(i.guild.createdTimestamp / 1000)}:R>`, inline: true }
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === 'whois') {
        const target = i.options.getUser('t') || i.user;
        const member = await i.guild.members.fetch(target.id);
        const roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString());
        const roleDisplay = roles.length > 20 ? roles.slice(0, 20).join(' ') + ` ... and ${roles.length - 20} more` : roles.join(' ') || "None";
        const embed = new EmbedBuilder().setTitle(`🔍 ${target.username}`).setThumbnail(target.displayAvatarURL()).setColor(BOT_COLOR).addFields(
            { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
            { name: `Roles [${roles.length}]`, value: roleDisplay }
        );
        return i.reply({ embeds: [embed] });
    }

    // --- ECONOMY COMMANDS ---
    if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY}${db.cash[uid]}`);
    if (i.commandName === 'work') {
        const gain = Math.floor(Math.random() * 200) + 50;
        db.cash[uid] += gain; return i.reply(`🔨 Earned **${CURRENCY}${gain}**!`);
    }
    if (i.commandName === 'daily') {
        const last = db.daily[uid] || 0;
        if (Date.now() - last < 86400000) return i.reply("❌ Tomorrow!");
        db.cash[uid] += 1000; db.daily[uid] = Date.now();
        return i.reply(`📆 Claimed **${CURRENCY}1000**!`);
    }
    if (i.commandName === 'shop') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('buy_padlock').setLabel('Buy Padlock (500)').setStyle(ButtonStyle.Success));
        const embed = new EmbedBuilder().setTitle("🛒 Shop").setDescription(`🔒 **Padlock**: ${CURRENCY}500\nStops 1 robbery!`).setColor(BOT_COLOR);
        return i.reply({ embeds: [embed], components: [row] });
    }
    if (i.commandName === 'rob') {
        const target = i.options.getUser('t');
        if (target.id === uid) return i.reply("No.");
        if (db.items[target.id]?.padlocks > 0) { db.items[target.id].padlocks -= 1; return i.reply(`🛡️ Robbery failed! ${target.username} had a padlock!`); }
        if ((db.cash[target.id] || 0) < 200) return i.reply("Too poor.");
        if (Math.random() > 0.5) {
            const stolen = Math.floor(db.cash[target.id] * 0.2);
            db.cash[uid] += stolen; db.cash[target.id] -= stolen;
            return i.reply(`🔫 Stole **${CURRENCY}${stolen}**!`);
        } else { db.cash[uid] -= 100; return i.reply("👮 Busted! Paid 100 fine."); }
    }

    // --- SOCIAL & FUN ---
    if (i.commandName === 'help') {
        const embed = new EmbedBuilder().setTitle("📜 Wimble Commands").setColor(BOT_COLOR).addFields(
            { name: '💰 Economy', value: '`/bal`, `/work`, `/rob`, `/gamble`, `/shop`, `/daily`' },
            { name: '📊 Stats', value: '`/rank`, `/leaderboard`, `/streak`' },
            { name: '❤️ Social', value: '`/marry`, `/ship`, `/profile`, `/whois`' },
            { name: '🖼️ Fun', value: '`/images`, `/weather`, `/define`, `/serverinfo`' }
        );
        return i.reply({ embeds: [embed] });
    }
    if (i.commandName === 'gamble') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gamble_slots').setLabel('Slots').setStyle(ButtonStyle.Primary));
        return i.reply({ content: "🎰 **Casino Hub**", components: [row] });
    }
    if (i.commandName === 'images') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('img_cat').setLabel('🐱 Cat').setStyle(ButtonStyle.Primary));
        return i.reply({ content: "🖼️ Image Hub", components: [row] });
    }
    if (i.commandName === 'spam' && uid === OWNER_ID) {
        const text = i.options.getString('t');
        const amt = Math.min(i.options.getInteger('a') || 5, 15);
        i.reply({ content: "🚀 Running...", ephemeral: true });
        for (let x = 0; x < amt; x++) { i.channel.send(text); await new Promise(r => setTimeout(r, 1000)); }
    }
});

client.login(process.env.DISCORD_TOKEN);

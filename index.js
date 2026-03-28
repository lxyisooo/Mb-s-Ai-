const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; // Money emoji as requested

const client = new Client({ intents: [3276799] });
let db = { cash: {}, lastDaily: {} };

// --- THE 26 COMMANDS ---
const commands = [
    // FUN (9)
    new SlashCommandBuilder().setName('8ball').setDescription('🎱 Oracle').addStringOption(o => o.setName('q').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('🎰 Gamble').addIntegerOption(o => o.setName('bet').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('🪙 Coinflip'),
    new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll 1-100'),
    new SlashCommandBuilder().setName('joke').setDescription('😂 Dad joke'),
    new SlashCommandBuilder().setName('fact').setDescription('🧠 Random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('🎯 Last deleted'),
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Weather').addStringOption(o => o.setName('city').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('✂️ Rock Paper Scissors').addStringOption(o => o.setName('choice').setRequired(true)),
    // ECONOMY (7)
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim daily cash'),
    new SlashCommandBuilder().setName('work').setDescription('💼 Earn money'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check wallet'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View profile'),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 View shop'),
    new SlashCommandBuilder().setName('buy').setDescription('🛍️ Buy item').addStringOption(o => o.setName('item').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('🤝 Send cash').addUserOption(o => o.setName('u').setRequired(true)).addIntegerOption(o => o.setName('a').setRequired(true)),
    // UTILITY (10)
    new SlashCommandBuilder().setName('help').setDescription('📜 Help menu'),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t')),
    new SlashCommandBuilder().setName('avatar').setDescription('🖼️ Get PFP').addUserOption(o => o.setName('u')),
    new SlashCommandBuilder().setName('ping').setDescription('🛰️ Latency'),
    new SlashCommandBuilder().setName('roles').setDescription('📜 Server roles'),
    new SlashCommandBuilder().setName('stats').setDescription('📊 Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏰 Server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('🎂 Set BD (DD/MM)').addStringOption(o => o.setName('d').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('🎈 BD List'),
    new SlashCommandBuilder().setName('calculate').setDescription('🧮 Math').addStringOption(o => o.setName('e').setRequired(true)),
    // OWNER ONLY
    new SlashCommandBuilder().setName('spam').setDescription('🚀 Owner Spam').addStringOption(o => o.setName('t').setRequired(true)).addIntegerOption(o => o.setName('a'))
].map(c => c.toJSON());

// --- THE HARD RESET SYNC ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🧹 Wiping old ghost commands...");
        // This kills the global "ghosts" that usually hide the list
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        // This forces the 26 commands directly into your server
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ Commands refreshed! If they don't show, restart your Discord app.");
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- DYNO STYLE WHOIS ---
    if (i.commandName === 'whois') {
        const member = i.options.getMember('t') || i.member;
        const roles = member.roles.cache.filter(r => r.id !== i.guild.id).map(r => r.name).join(', ') || 'None';
        const embed = new EmbedBuilder()
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setColor(BOT_COLOR)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .addFields(
                { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:f>`, inline: false },
                { name: 'Registered', value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:f>`, inline: false },
                { name: `Roles [${member.roles.cache.size - 1}]`, value: `\`${roles}\``, inline: false }
            ).setFooter({ text: `ID: ${member.id}` }).setTimestamp();
        return i.reply({ embeds: [embed] });
    }

    // --- SPAM ---
    if (i.commandName === 'spam') {
        if (uid !== OWNER_ID) return i.reply({ content: "❌ Owner only!", ephemeral: true });
        const text = i.options.getString('t');
        let amt = i.options.getInteger('a') || 5;
        if (amt > 20) amt = 20; 
        await i.reply({ content: `🚀 Spamming ${amt} times...`, ephemeral: true });
        for (let x = 0; x < amt; x++) {
            await i.channel.send(text);
            await new Promise(r => setTimeout(r, 760));
        }
        return;
    }

    // --- ECONOMY (With Emoji) ---
    if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY} ${db.cash[uid].toLocaleString()}`);
    if (i.commandName === 'daily') {
        db.cash[uid] += 100;
        return i.reply(`💸 You claimed your daily **${CURRENCY} 100**!`);
    }

    if (!i.replied) return i.reply({ content: `✅ **${i.commandName}** is working!`, ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);

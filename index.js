const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');

// 1. UPDATED CONFIG
const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; // Your New ID
const BOT_COLOR = '#ff0000'; // Red sidebar like in your screenshot

const client = new Client({ intents: [3276799] });
let db = { cash: {}, lastDaily: {} };

// --- 2. COMMAND LIST ---
const commands = [
    new SlashCommandBuilder().setName('whois').setDescription('User Information').addUserOption(o => o.setName('target').setDescription('The user')),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server Information'),
    new SlashCommandBuilder().setName('bal').setDescription('Check cash balance'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim daily R 100'),
    new SlashCommandBuilder().setName('spam').setDescription('Owner Only: Spam messages').addStringOption(o => o.setName('text').setRequired(true).setDescription('Message')),
    new SlashCommandBuilder().setName('help').setDescription('View all commands')
].map(c => c.toJSON());

// --- 3. SYNC ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); 
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands }); 
        console.log(`✅ ${client.user.tag} is ready with the new design!`);
    } catch (e) { console.error(e); }
});

// --- 4. THE DESIGNER HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- WHOIS (DYNO STYLE) ---
    if (i.commandName === 'whois') {
        const member = i.options.getMember('target') || i.member;
        const roles = member.roles.cache.filter(r => r.id !== i.guild.id).map(r => r.name).join(', ') || 'None';

        const embed = new EmbedBuilder()
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setColor(BOT_COLOR)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .addFields(
                { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>`, inline: false },
                { name: 'Registered', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:f>`, inline: false },
                { name: `Roles [${member.roles.cache.size - 1}]`, value: `\`${roles}\``, inline: false }
            )
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();

        return i.reply({ embeds: [embed] });
    }

    // --- SERVER INFO (DYNO STYLE) ---
    if (i.commandName === 'serverinfo') {
        const owner = await i.guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setAuthor({ name: i.guild.name, iconURL: i.guild.iconURL() })
            .setColor(BOT_COLOR)
            .setThumbnail(i.guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Owner', value: `${owner.user.tag}`, inline: true },
                { name: 'Members', value: `${i.guild.memberCount}`, inline: true },
                { name: 'Boosts', value: `${i.guild.premiumSubscriptionCount}`, inline: true },
                { name: 'Created', value: `<t:${Math.floor(i.guild.createdTimestamp / 1000)}:D>`, inline: false }
            )
            .setFooter({ text: `ID: ${i.guild.id}` })
            .setTimestamp();

        return i.reply({ embeds: [embed] });
    }

    // --- SPAM (OWNER ONLY) ---
    if (i.commandName === 'spam') {
        if (uid !== OWNER_ID) return i.reply({ content: "❌ Only Mb can use this!", ephemeral: true });
        const text = i.options.getString('text');
        const amt = Math.floor(Math.random() * 6) + 5;
        await i.reply({ content: `Spamming ${amt} times...`, ephemeral: true });
        for (let x = 0; x < amt; x++) {
            await i.channel.send(text);
            await new Promise(r => setTimeout(r, 1000));
        }
        return;
    }

    // --- ECONOMY ---
    if (i.commandName === 'bal') return i.reply({ embeds: [new EmbedBuilder().setColor(BOT_COLOR).setDescription(`💰 **Balance:** R ${db.cash[uid].toLocaleString()}`)] });

    if (i.commandName === 'daily') {
        const last = db.lastDaily[uid] || 0;
        if (Date.now() - last < 86400000) return i.reply("⏳ Try again later!");
        db.cash[uid] += 100; db.lastDaily[uid] = Date.now();
        return i.reply("💵 Claimed R 100!");
    }
});

client.login(process.env.DISCORD_TOKEN);

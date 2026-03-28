const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; // Your ID
const BOT_COLOR = '#ff0000'; // Red sidebar

const client = new Client({ intents: [3276799] });
let db = { cash: {}, lastDaily: {} };

// --- 1. THE EXACT 26 COMMAND LIST ---
const commands = [
    // FUN (9)
    new SlashCommandBuilder().setName('8ball').setDescription('Oracle').addStringOption(o => o.setName('q').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble').addIntegerOption(o => o.setName('bet').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Coinflip'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll 1-100'),
    new SlashCommandBuilder().setName('joke').setDescription('Dad joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('Last deleted'),
    new SlashCommandBuilder().setName('weather').setDescription('Weather').addStringOption(o => o.setName('city').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('RPS').addStringOption(o => o.setName('choice').setRequired(true)),
    // ECONOMY (7)
    new SlashCommandBuilder().setName('daily').setDescription('Claim R 100'),
    new SlashCommandBuilder().setName('work').setDescription('Work'),
    new SlashCommandBuilder().setName('bal').setDescription('Wallet'),
    new SlashCommandBuilder().setName('profile').setDescription('Profile'),
    new SlashCommandBuilder().setName('shop').setDescription('Shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy').addStringOption(o => o.setName('item').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send').addUserOption(o => o.setName('u').setRequired(true)).addIntegerOption(o => o.setName('a').setRequired(true)),
    // UTILITY/SOCIAL (10)
    new SlashCommandBuilder().setName('help').setDescription('Menu'),
    new SlashCommandBuilder().setName('whois').setDescription('User info').addUserOption(o => o.setName('t')),
    new SlashCommandBuilder().setName('avatar').setDescription('PFP').addUserOption(o => o.setName('u')),
    new SlashCommandBuilder().setName('ping').setDescription('Latency'),
    new SlashCommandBuilder().setName('roles').setDescription('Server roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set BD (DD/MM)').addStringOption(o => o.setName('d').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('BD List'),
    new SlashCommandBuilder().setName('calculate').setDescription('Math').addStringOption(o => o.setName('e').setRequired(true)),
    // OWNER ONLY
    new SlashCommandBuilder().setName('spam').setDescription('Owner Spam').addStringOption(o => o.setName('t').setRequired(true)).addIntegerOption(o => o.setName('a'))
].map(c => c.toJSON());

// --- 2. THE "FORCE RESET" SYNC ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🛠️ Resetting all commands...");
        // This clears GLOBAL commands (the ones that take 1 hour to update)
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        // This registers the 26 commands directly to YOUR server (instant update)
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log(`✅ Success! 26 commands registered to House of Mb.`);
    } catch (e) { console.error(e); }
});

// --- 3. THE HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    // PRO WHOIS DESIGN
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

    // SPAM WITH CUSTOM AMOUNT
    if (i.commandName === 'spam') {
        if (i.user.id !== OWNER_ID) return i.reply({ content: "❌ Owner Only.", ephemeral: true });
        const text = i.options.getString('t');
        let amt = i.options.getInteger('a') || 5;
        if (amt > 20) amt = 20; 

        await i.reply({ content: `🚀 Spaming ${amt} times...`, ephemeral: true });
        for (let x = 0; x < amt; x++) {
            await i.channel.send(text);
            await new Promise(r => setTimeout(r, 1000));
        }
        return;
    }

    // Economy & Help Fallbacks
    if (i.commandName === 'bal') return i.reply(`💰 **Balance:** R ${db.cash[i.user.id] || 0}`);
    if (i.commandName === 'help') return i.reply("📋 Commands: `/whois`, `/serverinfo`, `/bal`, `/daily`, `/spam`, and 21 more!");
    
    // Catch-all for other 21 commands
    if (!i.replied) return i.reply({ content: `✅ **${i.commandName}** is coming online!`, ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);

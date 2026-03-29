const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

// --- ANTI-CRASH SYSTEM ---
process.on('unhandledRejection', (r) => console.log('❌ Rejection:', r));
process.on('uncaughtException', (e) => console.log('❌ Exception:', e));

const client = new Client({ intents: [3276799] });
let db = { cash: {}, lastDaily: {} };

// --- 1. THE FIXED 26 COMMAND LIST ---
const commands = [
    // FUN (9)
    new SlashCommandBuilder().setName('8ball').setDescription('🎱 Ask a question').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('🎰 Gamble your money').addIntegerOption(o => o.setName('bet').setDescription('Amount to bet').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('🪙 Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('🎲 Roll a 100-sided die'),
    new SlashCommandBuilder().setName('joke').setDescription('😂 Get a random joke'),
    new SlashCommandBuilder().setName('fact').setDescription('🧠 Get a random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('🎯 See the last deleted message'),
    new SlashCommandBuilder().setName('weather').setDescription('☁️ Check city weather').addStringOption(o => o.setName('city').setDescription('Name of city').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('✂️ Play Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('Rock, Paper, or Scissors').setRequired(true)),
    
    // ECONOMY (7)
    new SlashCommandBuilder().setName('daily').setDescription('📆 Claim your daily 100 cash'),
    new SlashCommandBuilder().setName('work').setDescription('💼 Work a shift for money'),
    new SlashCommandBuilder().setName('bal').setDescription('💰 Check your bank balance'),
    new SlashCommandBuilder().setName('profile').setDescription('👤 View your personal profile'),
    new SlashCommandBuilder().setName('shop').setDescription('🛒 Open the item shop'),
    new SlashCommandBuilder().setName('buy').setDescription('🛍️ Buy an item').addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('🤝 Send money to someone').addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),
    
    // UTILITY/SOCIAL (10)
    new SlashCommandBuilder().setName('help').setDescription('📜 View all commands'),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 Get detailed user info').addUserOption(o => o.setName('target').setDescription('The user')),
    new SlashCommandBuilder().setName('avatar').setDescription('🖼️ Get a users profile picture').addUserOption(o => o.setName('user').setDescription('The user')),
    new SlashCommandBuilder().setName('ping').setDescription('🛰️ Check the bots connection speed'),
    new SlashCommandBuilder().setName('roles').setDescription('📜 List all server roles'),
    new SlashCommandBuilder().setName('stats').setDescription('📊 View bot statistics'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏰 View server details'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('🎂 Set your birthday').addStringOption(o => o.setName('date').setDescription('DD/MM format').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('🎈 See upcoming birthdays'),
    new SlashCommandBuilder().setName('calculate').setDescription('🧮 Solve a math problem').addStringOption(o => o.setName('expression').setDescription('The math problem').setRequired(true)),

    // OWNER ONLY
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Fast message spam').addStringOption(o => o.setName('text').setDescription('Message to spam').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('How many times (Max 20)')),
].map(c => c.toJSON());

// --- 2. DEEP REFRESH SYNC ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🛠️ Cleaning ghost commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); 
        console.log("🛠️ Deploying 26 fresh commands...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands }); 
        console.log(`✅ ${client.user.tag} is ONLINE!`);
    } catch (e) { console.error("Sync Error:", e); }
});

// --- 3. THE HANDLER ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    try {
        if (i.commandName === 'whois') {
            const member = i.options.getMember('target') || i.member;
            const roles = member.roles.cache.filter(r => r.id !== i.guild.id).map(r => r.name).join(', ') || 'None';
            const embed = new EmbedBuilder()
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setColor(BOT_COLOR)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
                .addFields(
                    { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:f>`, inline: false },
                    { name: 'Created Account', value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:f>`, inline: false },
                    { name: `Roles [${member.roles.cache.size - 1}]`, value: `\`${roles}\``, inline: false }
                ).setFooter({ text: `ID: ${member.id}` }).setTimestamp();
            return i.reply({ embeds: [embed] });
        }

        if (i.commandName === 'spam') {
            if (uid !== OWNER_ID) return i.reply({ content: "❌ Private Command.", ephemeral: true });
            const text = i.options.getString('text');
            let amt = i.options.getInteger('amount') || 5;
            if (amt > 20) amt = 20; 
            await i.reply({ content: `🚀 Turbo-Spamming...`, ephemeral: true });
            for (let x = 0; x < amt; x++) {
                i.channel.send(text).catch(() => {});
                await new Promise(r => setTimeout(r, 760)); // Fast but safe
            }
            return;
        }

        if (i.commandName === 'bal') return i.reply(`💰 **Wallet:** ${CURRENCY} ${db.cash[uid].toLocaleString()}`);
        if (i.commandName === 'daily') {
            db.cash[uid] += 100;
            return i.reply(`💸 You claimed your daily **${CURRENCY} 100**!`);
        }

        if (!i.replied) return i.reply({ content: `✅ **${i.commandName}** is active!`, ephemeral: true });
    } catch (err) { console.error(err); }
});

client.login(process.env.DISCORD_TOKEN);

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const http = require('http');

// Keep-alive for Railway/Render
http.createServer((req, res) => { res.write("Mb's Ai is Online! 😪"); res.end(); }).listen(8080);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages // Allows DMs
    ],
    partials: [Partials.Channel] // Necessary for DM support
});

const PREFIX = '\\';
const BRANDING = "Powered by Mb's Ai | 🤖";
const BOT_COLOR = '#5865F2'; 

let economy = {}; 
let lastDeleted = { content: "Nothing to snipe!", author: "Unknown" };

// 1. UPDATED COMMAND LIST
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('All commands'),
    new SlashCommandBuilder().setName('whois').setDescription('Get user info').addUserOption(o => o.setName('target').setDescription('The user')),
    new SlashCommandBuilder().setName('roles').setDescription('List all server roles'),
    new SlashCommandBuilder().setName('ping').setDescription('Check speed'),
    new SlashCommandBuilder().setName('snipe').setDescription('See the last deleted message'),
    new SlashCommandBuilder().setName('daily').setDescription('Get 100 cash'),
    new SlashCommandBuilder().setName('bal').setDescription('Check cash balance'),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble cash').addIntegerOption(o => o.setName('amount').setDescription('Bet').setRequired(true)),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    new SlashCommandBuilder().setName('clear').setDescription('Delete messages').addIntegerOption(o => o.setName('num').setDescription('Number').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("🚀 Mb's Ai synced with new commands!");
    } catch (e) { console.error(e); }
});

client.on('messageDelete', (m) => {
    if (m.author?.bot) return;
    lastDeleted = { content: m.content || "An image/embed", author: m.author?.tag || "Unknown" };
});

// 2. MAIN LOGIC
async function handleCommand(name, args, user, guild, respond, channel, member) {
    if (!economy[user.id]) economy[user.id] = 500;

    switch (name) {
        case 'whois':
            const target = member || guild?.members.cache.get(user.id);
            const wEmbed = new EmbedBuilder()
                .setTitle(`👤 User Info: ${target.user.username}`)
                .setThumbnail(target.user.displayAvatarURL())
                .addFields(
                    { name: 'Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Account Created', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'ID', value: `\`${target.id}\`` }
                ).setColor(BOT_COLOR).setFooter({ text: BRANDING });
            return respond({ embeds: [wEmbed] });

        case 'roles':
            const roles = guild.roles.cache.map(r => r.name).join(', ') || "No roles found.";
            return respond(`📜 **Server Roles:**\n${roles}`);

        case 'help':
            const hEmbed = new EmbedBuilder()
                .setTitle("🤖 Mb's Ai - Master Menu")
                .addFields(
                    { name: "💰 Economy", value: "`bal`, `daily`, `slots`" },
                    { name: "🎮 Fun", value: "`8ball`, `weather`, `snipe`" },
                    { name: "🛠️ Admin/Info", value: "`whois`, `roles`, `clear`, `ping`" }
                ).setColor(BOT_COLOR).setFooter({ text: BRANDING });
            return respond({ embeds: [hEmbed] });

        case 'snipe':
            return respond(`🎯 **Last Deleted:**\n> ${lastDeleted.content}\n**Sent by:** ${lastDeleted.author}`);

        case 'bal':
            return respond(`💰 **Cash Balance:** ${economy[user.id]} cash`);

        case 'daily':
            economy[user.id] += 100;
            return respond(`✅ **+100 cash!** New Balance: ${economy[user.id]}`);

        case 'slots':
            const bet = parseInt(args[0]);
            if (!bet || bet > economy[user.id]) return respond("❌ You don't have enough cash!");
            const win = Math.random() > 0.7;
            if (win) { economy[user.id] += bet * 2; return respond(`🎰 **WIN!** You won ${bet*2} cash!`); }
            economy[user.id] -= bet; return respond(`🎰 **Lost.** -${bet} cash.`);

        case '8ball':
            const res = ["Yes", "No", "Maybe", "I'm not sure", "Ask again"];
            return respond(`🎱 **Mb's Ai says:** ${res[Math.floor(Math.random()*res.length)]}`);
        
        case 'clear':
            const num = parseInt(args[0]);
            if (!num || num > 100) return respond("❌ Enter 1-100.");
            await channel.bulkDelete(num, true);
            return respond(`🧹 Cleared ${num} messages.`);
            
        case 'ping': return respond(`🏓 Latency: \`${client.ws.ping}ms\``);
        case 'weather': return respond(`🌡️ Weather: 26°C | ☀️ Sunny`);
    }
}

// 3. AI CHAT & MESSAGE HANDLER
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;

    // AI Chat when Pinged
    if (m.mentions.has(client.user)) {
        const aiReplies = [
            "I'm here! What's up? 😪",
            "Mb's Ai at your service. Need something? 🤖",
            "Stop pinging me, I'm busy counting your coins! Just kidding... maybe. 💰",
            "Everything is running smoothly. Use `\\help` for commands!",
            "I'm the smartest bot in the server. Don't @ me. 😎"
        ];
        return m.reply(aiReplies[Math.floor(Math.random() * aiReplies.length)]);
    }

    if (!m.content.startsWith(PREFIX)) return;
    const args = m.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    await handleCommand(cmd, args, m.author, m.guild, (c) => m.reply(c), m.channel, m.member);
});

// 4. SLASH HANDLER (PUBLIC ONLY)
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply({ ephemeral: false }); // Making sure it's public!
    const targetUser = i.options.getUser('target');
    const targetMember = targetUser ? i.guild?.members.cache.get(targetUser.id) : i.member;
    const args = i.options.data.map(o => o.value?.toString() || "");
    await handleCommand(i.commandName, args, i.user, i.guild, (c) => i.editReply(c), i.channel, targetMember);
});

client.login(process.env.DISCORD_TOKEN);

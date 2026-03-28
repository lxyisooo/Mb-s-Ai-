const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, Partials } = require('discord.js');
const http = require('http');
const { createDuckDuckGoChat } = require('free-chatbot'); // Run: npm install free-chatbot

// 1. KEEP-ALIVE & ANTI-CRASH
http.createServer((req, res) => { res.write("Mb's Ai is Online! 🦆"); res.end(); }).listen(8080);
process.on('unhandledRejection', (r) => console.log('Error:', r));
process.on("uncaughtException", (e) => console.log('Error:', e));

const client = new Client({
    intents: [3276799], 
    partials: [Partials.Channel, Partials.Message, Partials.User] 
});

const CLIENT_ID = '1482790365621915759'; 
const GUILD_ID = '1385034268438433906'; 
const BOT_COLOR = '#00FFFF';

// Initialize the Smart Brain (GPT-4o-mini via DuckDuckGo)
const brain = createDuckDuckGoChat();

let db = { cash: {}, lastDaily: {}, birthdays: {}, suggestions: [] };
let lastDeleted = { content: "Nothing to snipe!", author: "Unknown" };

// --- 2. THE CLEAN 26 COMMAND LIST ---
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('The full menu'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask a question').addStringOption(o => o.setName('q').setDescription('Question').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Gamble').addIntegerOption(o => o.setName('bet').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('flip').setDescription('Flip a coin'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a die'),
    new SlashCommandBuilder().setName('joke').setDescription('Random joke'),
    new SlashCommandBuilder().setName('fact').setDescription('Random fact'),
    new SlashCommandBuilder().setName('snipe').setDescription('See last deleted'),
    new SlashCommandBuilder().setName('weather').setDescription('Check weather').addStringOption(o => o.setName('city').setDescription('City').setRequired(true)),
    new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('R, P, or S').setRequired(true)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim 100 cash (24h)'),
    new SlashCommandBuilder().setName('work').setDescription('Earn money'),
    new SlashCommandBuilder().setName('bal').setDescription('Check wallet'),
    new SlashCommandBuilder().setName('profile').setDescription('View profile'),
    new SlashCommandBuilder().setName('shop').setDescription('View shop'),
    new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(o => o.setName('item').setDescription('Item').setRequired(true)),
    new SlashCommandBuilder().setName('pay').setDescription('Send cash').addUserOption(o => o.setName('user').setDescription('Target').setRequired(true)).addIntegerOption(o => o.setName('amt').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('whois').setDescription('User lookup').addUserOption(o => o.setName('target').setDescription('User')),
    new SlashCommandBuilder().setName('avatar').setDescription('Get avatar').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('ping').setDescription('Check speed'),
    new SlashCommandBuilder().setName('roles').setDescription('List roles'),
    new SlashCommandBuilder().setName('stats').setDescription('Bot stats'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Server info'),
    new SlashCommandBuilder().setName('setbirthday').setDescription('Set birthday (DD/MM)').addStringOption(o => o.setName('date').setDescription('DD/MM').setRequired(true)),
    new SlashCommandBuilder().setName('checkbirthday').setDescription('Check birthday').addUserOption(o => o.setName('user').setDescription('User')),
    new SlashCommandBuilder().setName('calculate').setDescription('Math solver').addStringOption(o => o.setName('exp').setDescription('Expression').setRequired(true)),
    new SlashCommandBuilder().setName('suggest').setDescription('Suggestion').addStringOption(o => o.setName('msg').setDescription('Idea').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log("🧹 DELETING ALL COMMANDS TO FIX DUPLICATES...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] }); 
        
        console.log("🚀 REGISTERING 26 FRESH COMMANDS...");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ DONE! Mb's Ai is clean and smart.");
    } catch (e) { console.error(e); }
});

// --- 3. THE LOGIC ---
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    await i.deferReply(); 
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    switch (i.commandName) {
        case 'help':
            return i.editReply({ embeds: [new EmbedBuilder().setTitle("🤖 Mb's Ai Menu").addFields(
                { name: "🎮 Fun", value: "`8ball`, `slots`, `flip`, `roll`, `joke`, `fact`, `snipe`, `rps`, `weather`" },
                { name: "💰 Economy", value: "`daily`, `work`, `bal`, `profile`, `shop`, `buy`, `pay`" },
                { name: "🛠️ Utility", value: "`whois`, `avatar`, `ping`, `roles`, `stats`, `serverinfo`, `setbirthday`, `checkbirthday`, `calculate`, `suggest`" }
            ).setColor(BOT_COLOR)] });

        case '8ball': return i.editReply(`🎱 **Answer:** ${["Yes", "No", "Maybe", "Definitely", "Forget it"][Math.floor(Math.random()*5)]}`);
        case 'slots':
            const bet = i.options.getInteger('bet');
            if (db.cash[uid] < bet) return i.editReply("❌ You're broke!");
            const win = Math.random() > 0.65;
            db.cash[uid] += win ? bet : -bet;
            return i.editReply(win ? `🎰 **WIN!** Won **${bet*2}**!` : `🎰 **LOST** **${bet}**.`);
        case 'flip': return i.editReply(`🪙 **${Math.random() > 0.5 ? "Heads" : "Tails"}**`);
        case 'roll': return i.editReply(`🎲 You rolled a **${Math.floor(Math.random()*6)+1}**`);
        case 'joke': return i.editReply("Why do programmers prefer dark mode? Because light attracts bugs! 💻");
        case 'fact': return i.editReply("A day on Venus is longer than a year on Venus. 🪐");
        case 'snipe': return i.editReply(`🎯 **Last Deleted:** ${lastDeleted.content} (by ${lastDeleted.author})`);
        case 'weather': return i.editReply(`🌤️ Checking weather for **${i.options.getString('city')}**... (Simulated: 24°C)`);
        case 'rps': return i.editReply(`✂️ I chose **Rock**! Did you win?`);
        case 'daily':
            if (Date.now() - (db.lastDaily[uid] || 0) < 86400000) return i.editReply("⏳ Too early!");
            db.cash[uid] += 100; db.lastDaily[uid] = Date.now();
            return i.editReply("💵 +100 cash! ✅");
        case 'work': 
            const e = Math.floor(Math.random()*60)+30; db.cash[uid] += e;
            return i.editReply(`💼 Earned **${e} cash**!`);
        case 'bal': return i.editReply(`💰 **Wallet:** ${db.cash[uid]}`);
        case 'profile': return i.editReply(`👤 **User:** ${i.user.username}\n💰 **Cash:** ${db.cash[uid]}`);
        case 'shop': return i.editReply("🛒 **Shop:** VIP (1000), Supercar (5000)");
        case 'buy': return i.editReply(`✅ Bought **${i.options.getString('item')}**!`);
        case 'pay':
            const target = i.options.getUser('user'); const amt = i.options.getInteger('amt');
            if (db.cash[uid] < amt) return i.editReply("❌ Not enough cash.");
            db.cash[uid] -= amt; db.cash[target.id] = (db.cash[target.id] || 0) + amt;
            return i.editReply(`💸 Sent **${amt}** to ${target.username}!`);
        case 'whois': return i.editReply(`👤 **User:** ${i.options.getUser('target')?.username || i.user.username}\n🆔 **ID:** \`${i.options.getUser('target')?.id || uid}\``);
        case 'avatar': return i.editReply(i.options.getUser('user')?.displayAvatarURL() || i.user.displayAvatarURL());
        case 'ping': return i.editReply(`🏓 Speed: \`${client.ws.ping}ms\``);
        case 'roles': return i.editReply(`📜 Roles: ${i.guild.roles.cache.size}`);
        case 'stats': return i.editReply(`📊 Servers: **${client.guilds.cache.size}**`);
        case 'serverinfo': return i.editReply(`🏰 **${i.guild.name}**\n👥 **Members:** ${i.guild.memberCount}`);
        case 'setbirthday': db.birthdays[uid] = i.options.getString('date'); return i.editReply("🎂 Saved!");
        case 'checkbirthday': return i.editReply(`📅 Birthday: ${db.birthdays[i.options.getUser('user')?.id || uid] || "Unknown"}`);
        case 'calculate': 
            try { return i.editReply(`🧮 Result: **${eval(i.options.getString('exp').replace(/[^-()\d/*+.]/g, ''))}**`); } 
            catch { return i.editReply("❌ Error in math."); }
        case 'suggest': db.suggestions.push(i.options.getString('msg')); return i.editReply("✅ Suggestion sent!");
    }
});

// --- 4. SMART DUCKDUCKGO AI (GPT-4o-mini) ---
client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    if (m.mentions.has(client.user) || !m.guild) {
        await m.react('🧠'); // Brain react instead of eyes
        const thinking = await m.reply("💭 *Processing...*");
        try {
            // Using DuckDuckGo's high-quality response
            const response = await brain.chat(m.content, { model: "gpt-4o-mini" });
            return thinking.edit(response || "I'm a bit lost, try again! 🦆");
        } catch (err) {
            console.error(err);
            return thinking.edit("My brain is a bit tired right now. 🦆");
        }
    }
});

client.on('messageDelete', (m) => {
    if (m.author?.bot) return;
    lastDeleted = { content: m.content || "Image", author: m.author?.tag || "Unknown" };
});

client.login(process.env.DISCORD_TOKEN);

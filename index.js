const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Using a Map for stats (Note: Resets on bot restart unless using a DB)
const players = new Map();
const PREFIX = '!';

const getProfile = (id) => {
    if (!players.has(id)) {
        players.set(id, { 
            hp: 100, maxHp: 100, xp: 0, level: 1, 
            wins: 0, class: 'Civilian', lastTrain: 0 
        });
    }
    return players.get(id);
};

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online and ready for war!`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const user = getProfile(message.author.id);

    // --- HELP COMMAND ---
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('⚔️ War RPG - Command Center')
            .setColor('#2b2d31')
            .setDescription('Welcome to the frontline. No economy, just skill.')
            .addFields(
                { name: '👤 Identity', value: '`!class <type>` - Choose Infantry, Tank, or Ghost.\n`!stats` - Check your vitals.', inline: false },
                { name: '🔥 Action', value: '`!attack @user` - Duel another player.\n`!train` - Heal and gain XP.', inline: false }
            )
            .setFooter({ text: 'Train hard, fight harder.' });
        return message.reply({ embeds: [embed] });
    }

    // --- CLASS SELECTION ---
    if (command === 'class') {
        const classes = {
            infantry: { name: 'Infantry', hp: 120, emoji: '🎖️' },
            tank: { name: 'Tank', hp: 200, emoji: '🛡️' },
            ghost: { name: 'Ghost', hp: 80, emoji: '👤' }
        };
        const choice = args[0]?.toLowerCase();
        if (!classes[choice]) return message.reply("❌ Usage: `!class Infantry`, `!class Tank`, or `!class Ghost`.");

        user.class = classes[choice].name;
        user.maxHp = classes[choice].hp;
        user.hp = user.maxHp;
        return message.reply(`${classes[choice].emoji} You are now a **${user.class}**! HP set to **${user.hp}**.`);
    }

    // --- TRAINING & HEALING ---
    if (command === 'train') {
        const now = Date.now();
        if (now - user.lastTrain < 45000) return message.reply("⏳ You are recovering. Wait 45s.");

        const xpGain = 20;
        user.xp += xpGain;
        user.hp = Math.min(user.maxHp, user.hp + 30);
        user.lastTrain = now;

        let levelMsg = "";
        if (user.xp >= user.level * 100) {
            user.level++;
            user.xp = 0;
            levelMsg = "\n🆙 **LEVEL UP!** You are now more powerful.";
        }

        return message.reply(`🏋️ Training finished! +${xpGain} XP. HP is now **${user.hp}/${user.maxHp}**${levelMsg}`);
    }

    // --- COMBAT SYSTEM ---
    if (command === 'attack') {
        const targetUser = message.mentions.users.first();
        if (!targetUser || targetUser.id === message.author.id) return message.reply("⚠️ Mention an enemy to duel.");
        
        const target = getProfile(targetUser.id);
        if (user.hp <= 0) return message.reply("❌ You are downed! Use `!train` to get back up.");
        if (target.hp <= 0) return message.reply("❌ That enemy is already unconscious.");

        const myDmg = Math.floor(Math.random() * 25) + 5;
        const enemyDmg = Math.floor(Math.random() * 15);

        target.hp -= myDmg;
        user.hp -= enemyDmg;

        const battleEmbed = new EmbedBuilder()
            .setTitle('⚔️ Combat Engagement')
            .setColor(user.hp > 0 ? '#57f287' : '#ed4245')
            .addFields(
                { name: 'You', value: `Dealt **${myDmg}** dmg`, inline: true },
                { name: 'Enemy', value: `Dealt **${enemyDmg}** dmg`, inline: true },
                { name: 'Health Remaining', value: `You: **${Math.max(0, user.hp)}** | Them: **${Math.max(0, target.hp)}**` }
            );

        if (target.hp <= 0) {
            user.xp += 60;
            user.wins++;
            battleEmbed.setDescription(`🏆 **KNOCKOUT!** You defeated ${targetUser.username}!`);
        }

        return message.reply({ embeds: [battleEmbed] });
    }

    // --- STATS ---
    if (command === 'stats') {
        const embed = new EmbedBuilder()
            .setTitle(`${message.author.username}'s Dossier`)
            .setColor('#2b2d31')
            .addFields(
                { name: 'Level', value: `${user.level} (${user.class})`, inline: true },
                { name: 'Wins', value: `${user.wins}`, inline: true },
                { name: 'HP', value: `❤️ ${user.hp}/${user.maxHp}`, inline: false },
                { name: 'XP Progress', value: `⭐ ${user.xp}/${user.level * 100}`, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }
});

// Use process.env for security on GitHub/Railway
client.login(process.env.TOKEN);

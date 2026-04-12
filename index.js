const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "mb";
const db = new Map(); // Global player storage

// --- DATA INITIALIZER ---
const getData = (id) => db.get(id) || {
    bal: 1000, 
    luck: 1.0, 
    inv: [], 
    zoo: [], 
    weapon: "Rusty Dagger", 
    hp: 100, 
    lvl: 1, 
    xp: 0,
    marriedTo: "Nobody",
    accepted: false,
    dailyLast: 0
};

client.once('ready', () => console.log('✅ Wimble Omega is Online! Use mb help.'));

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;
    let user = getData(userId);

    // --- HELPER: SAVE DATA ---
    const save = () => db.set(userId, user);

    // --- COMMAND: HELP (CLEAN & ADVANCED) ---
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle("💎 WIMBLE OMEGA | DASHBOARD")
            .setDescription("Welcome! Please select a category to view commands and details.")
            .setColor("#2b2d31")
            .setImage('https://i.imgur.com/your-cool-banner.png');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('h_nav').setPlaceholder('Navigate...')
                .addOptions([
                    { label: 'Casino & Money', value: 'c1', emoji: '🎰' },
                    { label: 'RPG & Hunting', value: 'c2', emoji: '⚔️' },
                    { label: 'Social & Items', value: 'c3', emoji: '💍' }
                ])
        );

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('acc').setLabel(user.accepted ? 'Verified' : 'Accept Rules').setStyle(user.accepted ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(user.accepted)
        );

        const msg = await message.reply({ embeds: [helpEmbed], components: [menu, btn] });
        const coll = msg.createMessageComponentCollector({ time: 60000 });

        coll.on('collect', async i => {
            if (i.user.id !== userId) return;
            if (i.customId === 'acc') {
                user.accepted = true; save();
                return i.update({ content: "✅ Rules Accepted!", components: [menu] });
            }
            const embeds = {
                c1: new EmbedBuilder().setTitle("💰 Casino & Economy").addFields({ name: "Commands", value: "`bal`, `daily`, `give`, `shop`, `buy`, `sell`, `vote`" }).setColor("#FFD700"),
                c2: new EmbedBuilder().setTitle("⚔️ RPG Wilderness").addFields({ name: "Commands", value: "`hunt`, `lootbox`, `crate`, `battle`, `autohunt`, `sacrifice`, `zoo`" }).setColor("#ff4500"),
                c3: new EmbedBuilder().setTitle("💍 Social & Gear").addFields({ name: "Commands", value: "`profile`, `marry`, `inv`, `equip`, `pray`, `curse`, `cookie`" }).setColor("#00ffff")
            };
            await i.update({ embeds: [embeds[i.values[0]]] });
        });
        return;
    }

    // --- GATE: MUST ACCEPT ---
    if (!user.accepted) return message.reply("⚠️ You must type `mb help` and click **Accept Rules** first!");

    // --- COMMAND: DAILY ---
    if (command === 'daily') {
        const now = Date.now();
        if (now - user.dailyLast < 86400000) return message.reply("⏳ Calm down! Your daily mb cash is still cooling down.");
        const reward = Math.floor(Math.random() * 1600) + 100;
        user.bal += reward;
        user.dailyLast = now;
        save();
        message.reply({ embeds: [new EmbedBuilder().setTitle("💸 Daily Drop").setDescription(`You found **${reward} mb cash**!`).setColor("#00ff00")] });
    }

    // --- COMMAND: PROFILE ---
    if (command === 'profile') {
        const pEmbed = new EmbedBuilder()
            .setTitle(`${message.author.username}'s Profile`)
            .addFields(
                { name: "💰 Balance", value: `${user.bal} mb cash`, inline: true },
                { name: "💍 Married To", value: user.marriedTo, inline: true },
                { name: "⚔️ Weapon", value: user.weapon, inline: true },
                { name: "🍀 Luck", value: `${user.luck.toFixed(1)}x`, inline: true },
                { name: "🦁 Zoo Size", value: `${user.zoo.length} animals`, inline: true }
            ).setThumbnail(message.author.displayAvatarURL()).setColor("#2b2d31");
        message.reply({ embeds: [pEmbed] });
    }

    // --- COMMAND: HUNT & ZOO ---
    if (command === 'hunt') {
        const prey = ["🐰 Rabbit", "🦌 Deer", "🐗 Boar", "🦁 Lion"];
        const find = prey[Math.floor(Math.random() * prey.length)];
        const reward = Math.floor(Math.random() * 400) + 50;
        user.bal += reward;
        user.zoo.push(find);
        save();
        message.reply(`🏹 You hunted a **${find}** and earned **${reward} mb cash**! (Added to your zoo)`);
    }

    if (command === 'zoo') {
        const animals = user.zoo.length > 0 ? user.zoo.join(", ") : "Empty";
        message.reply({ embeds: [new EmbedBuilder().setTitle("🦁 Your Zoo").setDescription(animals).setColor("#4b5320")] });
    }

    // --- COMMAND: BATTLE ---
    if (command === 'battle') {
        const win = Math.random() < (user.weapon.includes("Sword") ? 0.7 : 0.4);
        const prize = 1500;
        if (win) {
            user.bal += prize;
            message.reply(`🏆 **Victory!** You defeated the enemy and looted **${prize} mb cash**!`);
        } else {
            user.hp -= 20;
            message.reply(`💀 **Defeat!** You lost 20 HP. Get a better weapon at the shop.`);
        }
        save();
    }

    // --- COMMAND: PRAY / CURSE / COOKIE ---
    if (command === 'pray') {
        user.luck += 0.1; save();
        message.reply("🙏 You prayed. Your luck multiplier increased by **0.1x**!");
    }
    if (command === 'cookie') {
        message.reply("🍪 You ate a cookie. It was delicious but did nothing. (Buy Luck Potions in the shop for real boosts!)");
    }

    // --- COMMAND: SHOP & BUY ---
    if (command === 'shop') {
        const sEmbed = new EmbedBuilder().setTitle("🛒 MB OMEGA MARKET")
            .addFields(
                { name: "💍 Diamond Ring", value: "5000 mbc", inline: true },
                { name: "⚔️ Iron Sword", value: "3000 mbc", inline: true },
                { name: "📦 Lootbox", value: "1000 mbc", inline: true }
            ).setColor("#2b2d31");
        message.reply({ embeds: [sEmbed] });
    }

    if (command === 'buy') {
        const item = args[0]?.toLowerCase();
        if (item === 'ring') {
            if (user.bal < 5000) return message.reply("❌ Not enough mb cash!");
            user.bal -= 5000; user.inv.push("Diamond Ring");
            message.reply("✅ Bought a **Diamond Ring**! You can now use `mb marry`.");
        } else if (item === 'sword') {
            if (user.bal < 3000) return message.reply("❌ Not enough mb cash!");
            user.bal -= 3000; user.weapon = "Iron Sword";
            message.reply("✅ Equipped **Iron Sword**! Your battle win rate is now 70%.");
        }
        save();
    }

    // --- COMMAND: INV ---
    if (command === 'inv') {
        message.reply(`🎒 **Inventory:** ${user.inv.join(", ") || "Nothing yet."}`);
    }
});

client.login(process.env.TOKEN);

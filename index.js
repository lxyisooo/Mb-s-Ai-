const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "mb";
const db = new Map(); // Global player storage

client.once('ready', () => console.log(`🔥 Wimble Omega Online | Powered by mb cash`));

// --- ADVANCED DATA STRUCTURE ---
const getUser = (id) => db.get(id) || { 
    bal: 1000, luck: 1.0, inv: [], zoo: [], 
    weapon: "Rusty Knife", hp: 100, lvl: 1, 
    marriedTo: null, zooLevel: 1, accepted: false 
};

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;
    let user = getUser(userId);

    // --- GATE CHECK ---
    if (!user.accepted && command !== 'help') return message.reply("⚠️ Accept the rules in `mb help` first!");

    // --- 1. THE SHOP (Gems, Rings, Weapons, Layouts) ---
    if (command === 'shop') {
        const shopEmbed = new EmbedBuilder()
            .setTitle("🛒 WIMBLE OMEGA SHOP")
            .setDescription("Upgrade your life with **mb cash**.")
            .addFields(
                { name: "💍 Diamond Ring", value: "5,000 mbc | Use to `mb marry`", inline: true },
                { name: "⚔️ Iron Sword", value: "2,500 mbc | Boosts Battle wins", inline: true },
                { name: "🏗️ Zoo Layout", value: "4,000 mbc | Catch Legendary beasts", inline: true },
                { name: "📦 Lootbox", value: "1,200 mbc | Random high-tier weapon/gem", inline: true }
            ).setColor("#FFD700");

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('shop_select').setPlaceholder('Buy something...')
                .addOptions([
                    { label: 'Diamond Ring', value: 'ring', emoji: '💍' },
                    { label: 'Iron Sword', value: 'sword', emoji: '⚔️' },
                    { label: 'Zoo Layout', value: 'zoo_up', emoji: '🏗️' },
                    { label: 'Lootbox', value: 'crate', emoji: '📦' }
                ])
        );

        const msg = await message.reply({ embeds: [shopEmbed], components: [row] });
        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return;
            let price = 0; let item = i.values[0];
            if (item === 'ring') price = 5000;
            if (item === 'sword') price = 2500;
            if (item === 'zoo_up') price = 4000;
            if (item === 'crate') price = 1200;

            if (user.bal < price) return i.reply({ content: "❌ Poor! You need more mb cash.", ephemeral: true });
            
            user.bal -= price;
            if (item === 'sword') user.weapon = "Iron Sword";
            if (item === 'zoo_up') user.zooLevel += 1;
            user.inv.push(item);
            db.set(userId, user);
            await i.update({ content: `✅ Bought ${item}!`, embeds: [], components: [] });
        });
    }

    // --- 2. BATTLE SYSTEM ---
    if (command === 'battle') {
        const monsters = ["Shadow Stalker", "Corrupted Guard", "Wild Hydra"];
        const m = monsters[Math.floor(Math.random() * monsters.length)];
        const winChance = user.weapon === "Iron Sword" ? 0.75 : 0.45;
        const win = Math.random() < winChance;

        const bEmbed = new EmbedBuilder().setTitle("⚔️ BATTLE").setDescription(`Fighting **${m}**...`).setColor("#ff0000");
        const msg = await message.reply({ embeds: [bEmbed] });

        setTimeout(() => {
            if (win) {
                const gain = Math.floor(Math.random() * 1000) + 500;
                user.bal += gain;
                bEmbed.setDescription(`🏆 **VICTORY!** Defeated ${m}.\nEarned: **${gain} mb cash**`).setColor("#00ff00");
            } else {
                user.hp -= 25;
                bEmbed.setDescription(`💀 **DEFEAT!** The ${m} crushed you. Your HP is low.`).setColor("#000000");
            }
            db.set(userId, user);
            msg.edit({ embeds: [bEmbed] });
        }, 1500);
    }

    // --- 3. MARRY SYSTEM ---
    if (command === 'marry') {
        const target = message.mentions.users.first();
        if (!target) return message.reply("💍 Mention someone to marry!");
        if (!user.inv.includes('ring')) return message.reply("❌ Buy a **Diamond Ring** from the shop first!");

        const mEmbed = new EmbedBuilder()
            .setTitle("💍 PROPOSAL")
            .setDescription(`${message.author.username} has proposed to ${target.username}!\nDo you accept?`)
            .setColor("#ff69b4");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('yes').setLabel('I Do').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('no').setLabel('Reject').setStyle(ButtonStyle.Danger)
        );

        const msg = await message.reply({ embeds: [mEmbed], components: [row] });
        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== target.id) return i.reply({ content: "Not your proposal!", ephemeral: true });
            if (i.customId === 'yes') {
                user.marriedTo = target.username;
                user.inv = user.inv.filter(it => it !== 'ring'); // Use up the ring
                db.set(userId, user);
                await i.update({ content: `🎊 **CONGRATS!** ${message.author.username} and ${target.username} are married!`, embeds: [], components: [] });
            } else {
                await i.update({ content: "💔 Rejected.", embeds: [], components: [] });
            }
        });
    }

    // --- 4. LOOTBOX SYSTEM ---
    if (command === 'lootbox' || command === 'crate') {
        if (!user.inv.includes('crate')) return message.reply("❌ Buy a Lootbox from the shop!");
        
        user.inv = user.inv.filter(it => it !== 'crate');
        const loot = ["Legendary Sword", "5000 mbc", "Dragon Egg", "Ruby"];
        const win = loot[Math.floor(Math.random() * loot.length)];

        if (win === "5000 mbc") user.bal += 5000;
        else if (win === "Legendary Sword") user.weapon = "Legendary Sword";
        else user.inv.push(win);

        db.set(userId, user);
        message.reply(`📦 **UNBOXED:** You found a **${win}**!`);
    }

    // --- 5. HELP & VERIFICATION ---
    if (command === 'help') {
        user.accepted = true; // For testing, clicking help auto-verifies
        db.set(userId, user);
        const hEmbed = new EmbedBuilder()
            .setTitle("📜 WIMBLE COMMANDS")
            .addFields(
                { name: "💰 Money", value: "`bal`, `shop`, `give`, `daily`" },
                { name: "🏹 RPG", value: "`hunt`, `loot`, `battle`, `lootbox`" },
                { name: "💍 Social", value: "`marry`, `zoo`, `profile`, `inv`" }
            ).setColor("#2b2d31");
        message.reply({ embeds: [hEmbed] });
    }

    // --- 6. BAL & INV ---
    if (command === 'bal') message.reply(`💳 **Wallet:** ${user.bal} mb cash`);
    if (command === 'inv') message.reply(`🎒 **Inventory:** ${user.inv.join(", ") || "Empty"}\n⚔️ **Weapon:** ${user.weapon}`);

    db.set(userId, user);
});

client.login(process.env.TOKEN);

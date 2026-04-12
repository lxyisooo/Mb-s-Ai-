const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ActivityType 
} = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers
    ]
});

// ================= DATABASE MODELS =================
const User = mongoose.model("User", new mongoose.Schema({
    userId: String,
    stars: { type: Number, default: 0 },
    inventory: { type: Array, default: [] }
}));

const TriviaStats = mongoose.model("TriviaStats", new mongoose.Schema({
    usedIds: { type: Array, default: [] } 
}));

const theme = "#5865F2"; 
let activeEvent = null; 

// ================= THE 100+ UNIQUE TRIVIA POOL =================
const triviaPool = [
    { id: 1, q: "Science: What is the most common element in the universe?", a: "hydrogen" },
    { id: 2, q: "Science: What part of the cell is the powerhouse?", a: "mitochondria" },
    { id: 3, q: "Science: What is the boiling point of water (Celsius)?", a: "100" },
    { id: 4, q: "Math: Solve for x: 3x - 9 = 21", a: "10" },
    { id: 5, q: "History: In what year did WWI start?", a: "1914" },
    { id: 6, q: "Science: What gas do plants absorb from the air?", a: "carbon dioxide" },
    { id: 7, q: "Geography: What is the capital of Japan?", a: "tokyo" },
    { id: 8, q: "Math: What is the square root of 144?", a: "12" },
    { id: 9, q: "History: Who was the first US President?", a: "george washington" },
    { id: 10, q: "Science: H2O is the chemical formula for what?", a: "water" },
    { id: 11, q: "Math: How many degrees are in a right angle?", a: "90" },
    { id: 12, q: "Science: What is the hardest natural substance?", a: "diamond" },
    { id: 13, q: "History: Who painted the Mona Lisa?", a: "da vinci" },
    { id: 14, q: "Geography: Which is the largest ocean?", a: "pacific" },
    { id: 15, q: "Math: What is 15% of 200?", a: "30" },
    { id: 16, q: "Science: What is the closest star to Earth?", a: "sun" },
    { id: 17, q: "History: What year did the Berlin Wall fall?", a: "1989" },
    { id: 18, q: "Geography: What is the capital of France?", a: "paris" },
    { id: 19, q: "Science: Which blood type is the universal donor?", a: "o" },
    { id: 20, q: "Math: How many sides does a heptagon have?", a: "7" },
    // ... [Include all 100+ unique questions here] ...
    { id: 100, q: "Misc: What is the largest planet in our solar system?", a: "jupiter" }
];

// ================= READY EVENT =================
client.once("ready", async () => {
    console.log(`💫 MB STARS SYSTEM V16 | ECONOMY LIMITS APPLIED`);
    client.user.setPresence({ activities: [{ name: "MB Stars Drops", type: ActivityType.Watching }], status: "online" });

    const startLoop = () => {
        const randomTime = (Math.random() * (10 - 5) + 5) * 60 * 1000;
        setTimeout(async () => {
            await triggerEvent();
            startLoop(); 
        }, randomTime);
    };
    startLoop();
});

// ================= EVENT ENGINE =================
async function triggerEvent() {
    const channel = client.channels.cache.get(process.env.GAME_CHANNEL_ID);
    if (!channel) return;

    const chance = Math.random() * 100;

    if (chance <= 5) { 
        // 5% CHANCE: MEGA JACKPOT (MAX 67k)
        const reward = Math.floor(Math.random() * 37000) + 30000; // Ranges 30k to 67k
        const code = "MB-JACKPOT-" + Math.floor(Math.random() * 99);
        activeEvent = { answer: code.toLowerCase(), reward, type: "JACKPOT" };
        
        const embed = new EmbedBuilder()
            .setTitle("🔥 MEGA JACKPOT DROP 🔥")
            .setColor("#ff0000")
            .setDescription(`Type the code fast!\n\n📝 Code: **${code}**\n💰 Reward: **${reward.toLocaleString()} 💫 Stars**`)
            .setFooter({ text: "For help type ;help" });
        await channel.send({ embeds: [embed] });

    } else if (chance <= 35) {
        // 30% CHANCE: UNIQUE TRIVIA (MAX 1.5k)
        let stats = await TriviaStats.findOne() || await TriviaStats.create({ usedIds: [] });
        const availableTrivia = triviaPool.filter(t => !stats.usedIds.includes(t.id));

        if (availableTrivia.length === 0) return triggerRegularDrop(channel);

        const trivia = availableTrivia[Math.floor(Math.random() * availableTrivia.length)];
        const reward = Math.floor(Math.random() * 500) + 1000; // Ranges 1k to 1.5k
        activeEvent = { answer: trivia.a.toLowerCase(), reward, type: "TRIVIA", id: trivia.id };

        const embed = new EmbedBuilder()
            .setTitle("🧠 MB ACADEMIC TRIVIA")
            .setColor("#00fbff")
            .setDescription(`**QUESTION:** ${trivia.q}\n\n💰 Reward: **${reward.toLocaleString()} 💫 Stars**`)
            .setFooter({ text: "Checkout the chicken bot aswell by using m help" });
        await channel.send({ embeds: [embed] });

    } else {
        triggerRegularDrop(channel);
    }
}

async function triggerRegularDrop(channel) {
    const reward = Math.floor(Math.random() * 130) + 200; // Ranges 200 to 330
    const code = "MB" + Math.floor(Math.random() * 9999);
    activeEvent = { answer: code.toLowerCase(), reward, type: "DROP" };

    const embed = new EmbedBuilder()
        .setTitle("💫 MB STARS DROP")
        .setColor(theme)
        .setDescription(`Type the code fast!\n\n📝 Code: **${code}**\n💰 Reward: **${reward} 💫 Stars**`)
        .setFooter({ text: "For help type ;help" });
    await channel.send({ embeds: [embed] });
}

// ================= MESSAGE HANDLER =================
client.on("messageCreate", async (m) => {
    if (m.author.bot || !m.guild) return;

    if (activeEvent && m.content.toLowerCase().includes(activeEvent.answer)) {
        const { reward, type, id } = activeEvent;
        activeEvent = null; 

        if (type === "TRIVIA") {
            await TriviaStats.updateOne({}, { $push: { usedIds: id } });
        }

        let user = await User.findOne({ userId: m.author.id }) || await User.create({ userId: m.author.id });
        user.stars += reward;
        await user.save();

        const winEmbed = new EmbedBuilder()
            .setColor("Green")
            .setDescription(type === "TRIVIA" 
                ? `🧠 **${m.author.username}** correctly answered! **+${reward.toLocaleString()} 💫 Stars**` 
                : `✅ **${m.author.username}** claimed the stars! **+${reward.toLocaleString()} 💫 Stars**`)
            .setFooter({ text: type === "TRIVIA" ? "Checkout the chicken bot aswell by using m help" : "For help type ;help" });

        return m.reply({ embeds: [winEmbed] });
    }

    if (!m.content.startsWith(";")) return;
    const args = m.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "help") {
        const helpEmbed = new EmbedBuilder()
            .setTitle("🔱 MB Stars | God-Mode System")
            .setColor(theme)
            .setDescription("The ultimate engagement system. Earn **💫 MB Stars** by being the fastest.")
            .addFields(
                { name: "🎯 Economy", value: "Drops: 330 Max\nTrivia: 1.5k Max\nJackpot: 67k Max", inline: false },
                { name: "💸 Commands", value: "`;bal` - Your Balance\n`;shop` - Premium Items", inline: true }
            );
        return m.reply({ embeds: [helpEmbed] });
    }

    if (cmd === "bal" || cmd === "stars") {
        let user = await User.findOne({ userId: m.author.id }) || await User.create({ userId: m.author.id });
        return m.reply(`💳 **${m.author.username}**, you have **${user.stars.toLocaleString()} 💫 MB Stars**.`);
    }

    if (cmd === "shop") {
        const shopEmbed = new EmbedBuilder()
            .setTitle("🛒 MB STARS PREMIUM VAULT")
            .setColor(theme)
            .addFields(
                { name: "🛡️ Star Shield", value: "2,500 💫", inline: true },
                { name: "🧬 XP Mutator", value: "5,000 💫", inline: true },
                { name: "🛰️ Satellite", value: "8,500 💫", inline: true },
                { name: "🧪 Growth Serum", value: "12,000 💫", inline: true },
                { name: "🔮 Ancient Relic", value: "20,000 💫", inline: true },
                { name: "🏎️ Velocity Engine", value: "35,000 💫", inline: true },
                { name: "💎 Void Diamond", value: "50,000 💫", inline: true },
                { name: "🌌 Galaxy Map", value: "75,000 💫", inline: true },
                { name: "👑 Star Crown", value: "150,000 💫", inline: true },
                { name: "🌀 Black Hole", value: "500,000 💫", inline: true }
            );

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("buy_shield").setLabel("Shield").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("buy_mutator").setLabel("Mutator").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("buy_relic").setLabel("Relic").setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("buy_diamond").setLabel("Diamond").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("buy_hole").setLabel("Black Hole").setStyle(ButtonStyle.Danger)
        );

        return m.reply({ embeds: [shopEmbed], components: [row1, row2] });
    }
});

client.on("interactionCreate", async (i) => {
    if (!i.isButton()) return;
    const prices = {
        buy_shield: 2500, buy_mutator: 5000, buy_relic: 20000, 
        buy_diamond: 50000, buy_hole: 500000
    };
    const cost = prices[i.customId];
    if (!cost) return;

    let user = await User.findOne({ userId: i.user.id }) || await User.create({ userId: i.user.id });
    if (user.stars < cost) return i.reply({ content: `❌ You need more 💫 stars!`, ephemeral: true });

    user.stars -= cost;
    user.inventory.push(i.component.label);
    await user.save();
    await i.reply({ content: `✅ Purchased **${i.component.label}**!`, ephemeral: true });
});

mongoose.connect(process.env.MONGO_URI).then(() => client.login(process.env.TOKEN));

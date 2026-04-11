const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, PermissionsBitField, REST, Routes, ActivityType, ChannelType 
} = require("discord.js");
const mongoose = require("mongoose");
const https = require("https");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ================= DATABASE MODELS =================
const User = mongoose.model("User", new mongoose.Schema({
    userId: String,
    warns: { type: Array, default: [] },
    afk: { type: String, default: null },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 }
}));

const GuildConfig = mongoose.model("Guild", new mongoose.Schema({
    guildId: String,
    logs: String,
    ticketCategory: String
}));

// ================= UTILS & AI =================
const theme = "#2b2d31";
const log = async (guild, text) => {
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    const ch = guild.channels.cache.get(cfg?.logs || process.env.LOG_CHANNEL_ID);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setColor("Red").setDescription(text).setTimestamp()] });
};

async function ai(prompt) {
    const key = process.env.OPENAI_KEY;
    if (!key) return "🤖 AI is offline.";
    return new Promise((resolve) => {
        const data = JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] });
        const req = https.request({
            hostname: "api.openai.com", path: "/v1/chat/completions", method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` }
        }, res => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => { try { resolve(JSON.parse(body).choices[0].message.content); } catch { resolve("AI Error."); } });
        });
        req.write(data); req.end();
    });
}

// ================= BOT READY =================
client.once("ready", async () => {
    console.log(`😈 ${client.user.tag} IS LOADED`);
    client.user.setPresence({ activities: [{ name: "MB's Videos", type: ActivityType.Watching }], status: "dnd" });
    
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), {
        body: [
            { name: "help", description: "Premium Menu" },
            { name: "ai", description: "Ask AI", options: [{ name: "query", type: 3, description: "Your question", required: true }] },
            { name: "ping", description: "Check speed" }
        ]
    });
});

// ================= MESSAGE EVENT (LEVELS, AFK, CMDS) =================
client.on("messageCreate", async (m) => {
    if (m.author.bot || !m.guild) return;

    // AFK Check & Removal
    const afkData = await User.findOne({ userId: m.author.id });
    if (afkData?.afk) {
        afkData.afk = null; await afkData.save();
        m.reply("👋 **AFK Removed.**").then(msg => setTimeout(() => msg.delete(), 3000));
    }
    m.mentions.users.forEach(async (u) => {
        const targetAfk = await User.findOne({ userId: u.id });
        if (targetAfk?.afk) m.reply(`😴 **${u.username}** is AFK: ${targetAfk.afk}`);
    });

    // XP System
    let user = await User.findOne({ userId: m.author.id }) || await User.create({ userId: m.author.id });
    user.xp += Math.floor(Math.random() * 10) + 5;
    if (user.xp >= (user.level + 1) * 100) {
        user.level++;
        m.channel.send(`✨ **Level Up!** ${m.author} is now level **${user.level}**`);
    }
    await user.save();

    // Command Handler
    const prefix = process.env.PREFIX || ";";
    if (!m.content.startsWith(prefix)) return;
    const args = m.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // --- CMDS ---
    if (cmd === "help") {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("h_mod").setLabel("Moderation").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("h_util").setLabel("Utility").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("h_social").setLabel("Socials").setStyle(ButtonStyle.Primary)
        );
        m.reply({ embeds: [new EmbedBuilder().setTitle("🔱 God Mode Control").setColor(theme).setDescription("Select a module below.")], components: [row] });
    }

    if (cmd === "ticketpanel") {
        if (!m.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("t_open").setLabel("Create Ticket").setStyle(ButtonStyle.Success).setEmoji("🎫"));
        m.channel.send({ embeds: [new EmbedBuilder().setTitle("Support Tickets").setDescription("Click below to open a private ticket.").setColor(theme)], components: [row] });
    }

    if (cmd === "ban") {
        const target = m.mentions.members.first();
        if (!target || !m.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return m.reply("❌ Error.");
        await target.ban().catch(() => m.reply("❌ Hierarchy error."));
        log(m.guild, `🔨 **Ban**: ${target.user.tag}`);
    }

    if (cmd === "ai") m.reply(`🤖 ${await ai(args.join(" "))}`);
    
    // Social Lookups
    const socials = ["roblox", "tiktok", "youtube", "snapchat", "twitch", "github", "twitter"];
    if (socials.includes(cmd)) m.reply(`🌐 Searching **${cmd}** for: \`${args.join(" ")}\`... (Module Ready)`);
});

// ================= INTERACTION HANDLER (TICKETS & BUTTONS) =================
client.on("interactionCreate", async (i) => {
    if (i.isButton()) {
        if (i.customId === "t_open") {
            const ch = await i.guild.channels.create({
                name: `ticket-${i.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("t_close").setLabel("Close").setStyle(ButtonStyle.Danger));
            ch.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setTitle("Ticket Opened").setDescription("Support will be with you shortly.").setColor("Green")], components: [row] });
            await i.reply({ content: `✅ Ticket created: ${ch}`, ephemeral: true });
        }
        if (i.customId === "t_close") {
            await i.reply("🔒 Closing ticket in 5s...");
            setTimeout(() => i.channel.delete(), 5000);
        }
        // Help Menu Pages
        if (i.customId.startsWith("h_")) {
            const map = { h_mod: "🛡️ `;ban` `;kick` `;purge` `;warn`", h_util: "⚙️ `;help` `;afk` `;ai` `;ping` `;level`", h_social: "🌐 `;roblox` `;tiktok` `;youtube` `;github`" };
            await i.update({ embeds: [new EmbedBuilder().setTitle("Module Info").setDescription(map[i.customId]).setColor(theme)] });
        }
    }
});

mongoose.connect(process.env.MONGO_URI).then(() => client.login(process.env.TOKEN));

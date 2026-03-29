const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CLIENT_ID = '1482790365621915759'; 
const OWNER_ID = '1451533934130364467'; 
const BOT_COLOR = '#ff0000'; 
const CURRENCY = '💸'; 

const client = new Client({ intents: [3276799] });

// --- DATABASE MOCKUP ---
let db = { 
    cash: {}, 
    lastDaily: {}, 
    jobs: {}, // User ID: Job Name
    lastWork: {} 
};

const jobList = [
    { name: '🚗 Uber Driver', pay: 150, req: 0 },
    { name: '🏗️ Builder', pay: 300, req: 1000 },
    { name: '💻 Developer', pay: 600, req: 5000 }
];

// --- 1. CLEAN SLASH COMMANDS (Triggers for Buttons) ---
const commands = [
    new SlashCommandBuilder().setName('economy').setDescription('💰 Wallet & Banking'),
    new SlashCommandBuilder().setName('jobs').setDescription('💼 Job Center: Apply, List, Quit'),
    new SlashCommandBuilder().setName('fun').setDescription('🎮 Entertainment Hub'),
    new SlashCommandBuilder().setName('whois').setDescription('🔍 User info').addUserOption(o => o.setName('t').setDescription('Target')),
    new SlashCommandBuilder().setName('serverinfo').setDescription('🏰 Server stats'),
    new SlashCommandBuilder().setName('spam').setDescription('🚀 [OWNER] Turbo Spam').addStringOption(o => o.setName('t').setRequired(true).setDescription('Text')).addIntegerOption(o => o.setName('a').setDescription('Amount')),
].map(c => c.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("✅ 35-Command Interaction System Ready!");
    } catch (e) { console.error(e); }
});

// --- 2. THE INTERACTION MASTER ---
client.on('interactionCreate', async (i) => {
    const uid = i.user.id;
    if (!db.cash[uid]) db.cash[uid] = 500;

    // --- BUTTON HANDLER ---
    if (i.isButton()) {
        // JOB LIST BUTTON
        if (i.customId === 'job_list') {
            const list = jobList.map(j => `**${j.name}** - Pay: ${CURRENCY}${j.pay} (Requires: ${CURRENCY}${j.req})`).join('\n');
            return i.reply({ content: `### Available Jobs:\n${list}`, ephemeral: true });
        }

        // JOB APPLY BUTTON (Logic)
        if (i.customId === 'job_apply') {
            const currentJob = db.jobs[uid];
            if (currentJob) return i.reply({ content: `❌ You already work as a ${currentJob}! Quit first.`, ephemeral: true });
            
            // Auto-assign first job for this example
            db.jobs[uid] = jobList[0].name;
            return i.reply({ content: `✅ You are now an **${jobList[0].name}**! Use \`/economy\` and click Work.`, ephemeral: true });
        }

        // JOB QUIT BUTTON
        if (i.customId === 'job_quit') {
            if (!db.jobs[uid]) return i.reply({ content: "❌ You don't even have a job!", ephemeral: true });
            delete db.jobs[uid];
            return i.reply({ content: "👋 You quit your job. You are now unemployed.", ephemeral: true });
        }

        // ECONOMY: WORK BUTTON
        if (i.customId === 'eco_work') {
            if (!db.jobs[uid]) return i.reply({ content: "❌ You need to apply for a job first! Use `/jobs`", ephemeral: true });
            const last = db.lastWork[uid] || 0;
            if (Date.now() - last < 3600000) return i.reply({ content: "⏳ You're tired! Work again in 1 hour.", ephemeral: true });
            
            const jobObj = jobList.find(j => j.name === db.jobs[uid]);
            db.cash[uid] += jobObj.pay;
            db.lastWork[uid] = Date.now();
            return i.reply({ content: `🔨 You worked as a **${jobObj.name}** and earned **${CURRENCY}${jobObj.pay}**!`, ephemeral: true });
        }

        // ROLES BUTTON (Whois/Serverinfo)
        if (i.customId === 'view_roles') {
            const roles = i.guild.roles.cache.filter(r => r.id !== i.guild.id).map(r => `<@&${r.id}>`).join(', ');
            return i.reply({ embeds: [new EmbedBuilder().setTitle("📜 Server Roles").setColor(BOT_COLOR).setDescription(roles.substring(0, 2000))], ephemeral: true });
        }
    }

    if (!i.isChatInputCommand()) return;

    // --- SLASH COMMAND HANDLERS ---

    // /JOBS
    if (i.commandName === 'jobs') {
        const embed = new EmbedBuilder()
            .setTitle("💼 Job Center")
            .setDescription(`**Current Job:** ${db.jobs[uid] || 'Unemployed'}\n\nApply for a job to start earning more than just daily rewards!`)
            .setColor(BOT_COLOR);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('job_list').setLabel('List Jobs').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('job_apply').setLabel('Apply for Job').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('job_quit').setLabel('Quit Job').setStyle(ButtonStyle.Danger)
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    // /ECONOMY
    if (i.commandName === 'economy') {
        const embed = new EmbedBuilder()
            .setTitle(`💰 ${i.user.username}'s Wallet`)
            .setDescription(`**Balance:** ${CURRENCY} ${db.cash[uid].toLocaleString()}\n**Job:** ${db.jobs[uid] || 'None'}`)
            .setColor(BOT_COLOR);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('eco_work').setLabel('Work').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('eco_bal').setLabel('Refresh Bal').setStyle(ButtonStyle.Secondary)
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    // /SERVERINFO
    if (i.commandName === 'serverinfo') {
        const owner = await i.guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setAuthor({ name: i.guild.name, iconURL: i.guild.iconURL() })
            .setThumbnail(i.guild.iconURL({ dynamic: true }))
            .setColor(BOT_COLOR)
            .addFields(
                { name: 'Owner', value: `${owner.user.tag}`, inline: true },
                { name: 'Members', value: `👤 ${i.guild.memberCount}`, inline: true }
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('view_roles').setLabel('View Roles').setStyle(ButtonStyle.Primary)
        );
        return i.reply({ embeds: [embed], components: [row] });
    }

    // /SPAM
    if (i.commandName === 'spam') {
        if (uid !== OWNER_ID) return i.reply({ content: "❌ Owner only!", ephemeral: true });
        const text = i.options.getString('t');
        let amt = i.options.getInteger('a') || 5;
        if (amt > 20) amt = 20;
        await i.reply({ content: `🚀 Turbo-Spamming...`, ephemeral: true });
        for (let x = 0; x < amt; x++) {
            i.channel.send(text).catch(() => {});
            await new Promise(r => setTimeout(r, 740)); 
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

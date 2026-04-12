const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "mb"; 
const balances = new Map(); 
const dailyCooldown = new Set();
const acceptedUsers = new Set(); // Tracks who clicked "Accept"

client.once('ready', () => {
    console.log(`✅ Wimble Pro Online | Prefix: ${PREFIX}`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    // Helper Functions
    const getBal = (id) => balances.get(id) || 1000;
    const addBal = (id, amt) => balances.set(id, getBal(id) + amt);

    // --- ACCEPTANCE GATE ---
    // If they haven't accepted and aren't trying to run the help command, block them.
    if (!acceptedUsers.has(userId) && command !== 'help') {
        return message.reply("⚠️ You must accept the **Wimble Rules** before playing! Type `mb help` to begin.");
    }

    // --- HELP COMMAND WITH ACCEPT BUTTON ---
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle("🎰 WIMBLE CASINO | DASHBOARD")
            .setDescription("Welcome! Before you start gambling, please accept our terms.\n\n**Rules:**\n1. No begging for coins.\n2. Have fun and gamble responsibly!\n3. Luck boosts from `mb pray` are temporary.")
            .setColor("#2b2d31");

        // Category Menu
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('help_nav')
                .setPlaceholder('Choose a Category...')
                .setDisabled(!acceptedUsers.has(userId)) // Disabled until they accept
                .addOptions([
                    { label: 'Casino Floor', value: 'gamble', emoji: '🎰' },
                    { label: 'Social Lounge', value: 'social', emoji: '💎' },
                ])
        );

        // Accept Button
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accept_rules')
                .setLabel(acceptedUsers.has(userId) ? 'Accepted' : 'Accept Rules')
                .setStyle(acceptedUsers.has(userId) ? ButtonStyle.Success : ButtonStyle.Primary)
                .setDisabled(acceptedUsers.has(userId))
        );

        const msg = await message.reply({ embeds: [helpEmbed], components: [menu, buttons] });
        
        const collector = msg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) return i.reply({ content: "Not your menu!", ephemeral: true });

            if (i.customId === 'accept_rules') {
                acceptedUsers.add(userId);
                const updatedEmbed = EmbedBuilder.from(helpEmbed).setDescription("✅ **Terms Accepted!** You can now use the menu above to see commands.");
                
                // Enable the menu now that they accepted
                menu.components[0].setDisabled(false);
                buttons.components[0].setLabel('Accepted').setStyle(ButtonStyle.Success).setDisabled(true);

                await i.update({ embeds: [updatedEmbed], components: [menu, buttons] });
            }

            if (i.customId === 'help_nav') {
                const e = new EmbedBuilder().setColor("#2b2d31");
                if (i.values[0] === 'gamble') {
                    e.setTitle("🎰 Casino Floor").addFields(
                        { name: "mb slots [amt]", value: "Animated slot machine", inline: true },
                        { name: "mb coinflip [h/t] [amt]", value: "Double or nothing", inline: true }
                    );
                } else {
                    e.setTitle("💎 Social Lounge").addFields(
                        { name: "mb daily", value: "Get daily Cash", inline: true },
                        { name: "mb bal", value: "Check your wallet", inline: true }
                    );
                }
                await i.update({ embeds: [e] });
            }
        });
        return;
    }

    // --- UPDATED RANDOM DAILY ---
    if (command === 'daily') {
        if (dailyCooldown.has(userId)) return message.reply("⏳ Come back tomorrow for more coins!");
        
        // Random amount between 100 and 1700
        const reward = Math.floor(Math.random() * (1700 - 100 + 1)) + 100;
        addBal(userId, reward);
        dailyCooldown.add(userId);
        
        setTimeout(() => dailyCooldown.delete(userId), 86400000);
        
        const dailyEmbed = new EmbedBuilder()
            .setTitle("💰 Daily Reward")
            .setDescription(`You found **${reward}** coins! Check your balance with \`mb bal\`.`)
            .setColor("#00FF00");
            
        message.reply({ embeds: [dailyEmbed] });
    }

    // --- BAL COMMAND ---
    if (command === 'bal') {
        message.reply(`💳 **Balance:** ${getBal(userId)} coins`);
    }

    // --- SLOTS (Simplified for All-in-One) ---
    if (command === 'slots') {
        const bet = parseInt(args[0]);
        if (!bet || bet <= 0 || getBal(userId) < bet) return message.reply("❌ Invalid bet!");
        
        addBal(userId, -bet);
        const win = Math.random() < 0.3; // 30% win chance
        
        if (win) {
            addBal(userId, bet * 3);
            message.reply(`🎰 **JACKPOT!** You won **${bet * 3}** coins!`);
        } else {
            message.reply(`🎰 You lost **${bet}** coins. Better luck next time!`);
        }
    }
});

client.login(process.env.TOKEN);

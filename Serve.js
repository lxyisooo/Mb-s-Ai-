const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, savePlayer } = require('../systems/database');
const { MENU_ITEMS, getItemCost } = require('../systems/economy');
const { getStaffBonus } = require('../systems/staffSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serve')
    .setDescription('🍔 Serve a waiting customer')
    .addStringOption(opt =>
      opt.setName('id')
        .setDescription('Last 6 characters of the customer ID (from /customers)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    const inputId = interaction.options.getString('id').toLowerCase();
    const waiting = (player.activeOrders || []).filter(o => o.status === 'waiting');
    const customer = waiting.find(o => o.id.endsWith(inputId) || o.id.slice(-6) === inputId);

    if (!customer) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Customer Not Found')
          .setDescription(`No waiting customer with ID ending in \`${inputId}\`.\nUse \`/customers\` to see current IDs.`)
        ],
        ephemeral: true
      });
    }

    // Check if customer already left
    if (Date.now() > customer.expiresAt) {
      customer.status = 'left';
      savePlayer(interaction.user.id, player);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('😤 Too Late!')
          .setDescription(`**${customer.name}** got tired of waiting and left. Next time serve faster!\n-2 reputation`)
        ]
      });
    }

    // Check menu — does restaurant have the items?
    const restaurant = player.restaurants.find(r => r.id === customer.restaurantId) || player.restaurants[0];
    const missingItems = customer.order.filter(item => !(restaurant.menu || []).includes(item));

    if (missingItems.length > 0) {
      const names = missingItems.map(k => MENU_ITEMS[k]?.name || k).join(', ');
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Missing Menu Items')
          .setDescription(`Your restaurant doesn't serve: **${names}**\nUpgrade to unlock more menu items!`)
        ],
        ephemeral: true
      });
    }

    // Calculate earnings with staff bonus
    const { qualityBonus } = getStaffBonus(player.staff || [], restaurant.id);

    // Time bonus — faster serve = better tip
    const timeRemaining = customer.expiresAt - Date.now();
    const totalPatience = customer.patience * 60 * 1000;
    const timeRatio = timeRemaining / totalPatience; // 0-1
    const speedBonus = timeRatio > 0.7 ? 1.3 : timeRatio > 0.4 ? 1.1 : 1.0;

    const baseRevenue = customer.orderValue;
    const tip = +(baseRevenue * customer.tipMultiplier * timeRatio * 0.25).toFixed(2);
    const totalEarned = +(baseRevenue + tip).toFixed(2);

    // Ingredient costs
    const ingredientCost = customer.order.reduce((sum, key) => {
      const item = getItemCost(key, player.marketMultiplier || 1.0);
      return sum + (item?.currentCost || 0);
    }, 0);

    const profit = +(totalEarned - ingredientCost).toFixed(2);

    // Reputation change
    let repChange = 2;
    if (customer.isCritic) repChange = timeRatio > 0.5 ? 8 : -5;
    else if (timeRatio > 0.7) repChange = 4;
    else if (timeRatio < 0.2) repChange = -1;

    // Apply changes
    player.cash = +(player.cash + profit).toFixed(2);
    player.totalEarned = +((player.totalEarned || 0) + totalEarned).toFixed(2);
    player.completedOrders = (player.completedOrders || 0) + 1;
    player.reputation = Math.min(100, Math.max(0, (player.reputation || 50) + repChange));

    // Update restaurant stats
    restaurant.totalRevenue = +((restaurant.totalRevenue || 0) + totalEarned).toFixed(2);
    restaurant.totalOrders = (restaurant.totalOrders || 0) + 1;

    // Mark customer as served
    customer.status = 'served';
    savePlayer(interaction.user.id, player);

    // Build receipt embed
    const orderNames = customer.order.map(k => MENU_ITEMS[k]?.name || k).join('\n');
    const timeLeft = Math.floor((customer.expiresAt - Date.now()) / 1000);
    const speedLabel = timeRatio > 0.7 ? '⚡ Lightning Fast!' : timeRatio > 0.4 ? '✅ On Time' : '🐌 Just in time...';

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`✅ Order Complete — ${customer.name} Served!`)
      .setDescription(`${customer.personalityLabel} **${customer.name}** got their food!`)
      .addFields(
        {
          name: '🧾 Order',
          value: orderNames,
          inline: true
        },
        {
          name: '💰 Receipt',
          value: [
            `Subtotal: $${baseRevenue.toFixed(2)}`,
            `Tip: +$${tip.toFixed(2)}`,
            `Ingredients: -$${ingredientCost.toFixed(2)}`,
            `**Net Profit: $${profit.toFixed(2)}**`
          ].join('\n'),
          inline: true
        },
        {
          name: '📊 Stats',
          value: [
            `${speedLabel}`,
            `Reputation: ${repChange >= 0 ? '+' : ''}${repChange} → **${player.reputation}/100**`,
            `Your Cash: **$${player.cash.toFixed(2)}**`
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: customer.isCritic ? '🧐 The food critic left satisfied. Reputation greatly boosted!' : 'Keep serving to grow your empire!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

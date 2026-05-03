const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, savePlayer } = require('../systems/database');
const { RESTAURANT_TIERS } = require('../systems/economy');

const TIER_ORDER = ['foodcart', 'kiosk', 'diner', 'chain'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('🏗️ Upgrade your restaurant to the next tier'),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    if (!player.restaurants || player.restaurants.length === 0) {
      return interaction.reply({ content: '❌ No restaurants to upgrade!', ephemeral: true });
    }

    const restaurant = player.restaurants[0];
    const currentIndex = TIER_ORDER.indexOf(restaurant.tier);

    if (currentIndex === TIER_ORDER.length - 1) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('🏆 Maximum Tier Reached!')
          .setDescription(`**${restaurant.name}** is already a **Chain Location** — the pinnacle of fast food!\n\nConsider opening a second location with \`/open\`!`)
        ]
      });
    }

    const nextTierKey = TIER_ORDER[currentIndex + 1];
    const nextTier = RESTAURANT_TIERS[nextTierKey];
    const currentTier = RESTAURANT_TIERS[restaurant.tier];

    if (player.cash < nextTier.cost) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('💸 Not Enough Cash')
          .setDescription(`Upgrading to **${nextTier.name}** costs **$${nextTier.cost.toLocaleString()}**.\nYou have: **$${player.cash.toFixed(2)}**\nYou need: **$${(nextTier.cost - player.cash).toFixed(2)}** more.`)
        ],
        ephemeral: true
      });
    }

    // Perform upgrade
    const oldName = restaurant.name;
    restaurant.tier = nextTierKey;
    restaurant.name = `${player.name}'s ${nextTier.name.replace(/[^\w\s]/g, '').trim()}`;

    // Unlock new menu items
    const TIER_MENUS = {
      foodcart: ['burger', 'fries', 'soda'],
      kiosk: ['burger', 'fries', 'soda', 'hotdog', 'shake'],
      diner: ['burger', 'fries', 'soda', 'hotdog', 'shake', 'chicken', 'pizza'],
      chain: ['burger', 'fries', 'soda', 'hotdog', 'shake', 'chicken', 'pizza', 'wrap']
    };
    restaurant.menu = TIER_MENUS[nextTierKey];

    player.cash = +(player.cash - nextTier.cost).toFixed(2);
    savePlayer(interaction.user.id, player);

    const newItems = restaurant.menu.filter(i => !(TIER_MENUS[TIER_ORDER[currentIndex]] || []).includes(i));
    const { MENU_ITEMS } = require('../systems/economy');

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🏗️ Restaurant Upgraded!')
      .setDescription(`**${oldName}** has been upgraded!`)
      .addFields(
        {
          name: '📊 Upgrade',
          value: `${currentTier.name} → **${nextTier.name}**`,
          inline: false
        },
        {
          name: '🆕 New Capabilities',
          value: [
            `👥 Max Staff: ${currentTier.maxStaff} → **${nextTier.maxStaff}**`,
            `📦 Order Capacity: ${currentTier.capacity} → **${nextTier.capacity}**`,
            `🍽️ Menu Slots: ${currentTier.menuSlots} → **${nextTier.menuSlots}**`,
            `💵 Daily Rent: $${nextTier.dailyRent}/day`
          ].join('\n'),
          inline: true
        },
        {
          name: '🆕 New Menu Items',
          value: newItems.length > 0
            ? newItems.map(k => MENU_ITEMS[k]?.name || k).join('\n')
            : '*No new items at this tier*',
          inline: true
        },
        {
          name: '💰 Transaction',
          value: `Cost: -$${nextTier.cost.toLocaleString()}\nRemaining Cash: **$${player.cash.toFixed(2)}**`,
          inline: false
        }
      )
      .setFooter({ text: nextTier.description })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

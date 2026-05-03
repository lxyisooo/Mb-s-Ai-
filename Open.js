const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, savePlayer } = require('../systems/database');
const { RESTAURANT_TIERS } = require('../systems/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open')
    .setDescription('🏪 Open a new restaurant location')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for your new restaurant')
        .setRequired(true)
        .setMaxLength(40)
    ),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    const MAX_LOCATIONS = 5;
    if ((player.restaurants || []).length >= MAX_LOCATIONS) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Location Cap Reached')
          .setDescription(`You can own up to **${MAX_LOCATIONS}** locations. You're at the limit!`)
        ],
        ephemeral: true
      });
    }

    const OPEN_COST = 1000;
    if (player.cash < OPEN_COST) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('💸 Not Enough Cash')
          .setDescription(`Opening a new Food Cart costs **$${OPEN_COST}**.\nYou have: **$${player.cash.toFixed(2)}**`)
        ],
        ephemeral: true
      });
    }

    if (player.reputation < 40) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('⭐ Reputation Too Low')
          .setDescription(`You need at least **40 reputation** to open a second location.\nCurrent: **${player.reputation}/100**\n\nServe more customers well to build your brand!`)
        ],
        ephemeral: true
      });
    }

    const customName = interaction.options.getString('name');
    const newRestaurant = {
      id: `rest_${Date.now()}`,
      name: customName,
      tier: 'foodcart',
      menu: ['burger', 'fries', 'soda'],
      openedAt: Date.now(),
      totalRevenue: 0,
      totalOrders: 0
    };

    player.cash = +(player.cash - OPEN_COST).toFixed(2);
    player.restaurants.push(newRestaurant);
    savePlayer(interaction.user.id, player);

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🎉 New Location Opened!')
      .setDescription(`**${customName}** is now open for business!`)
      .addFields(
        {
          name: '🏪 New Location',
          value: [
            `Name: **${customName}**`,
            `Tier: 🛒 Food Cart`,
            `Menu: Burger, Fries, Soda`
          ].join('\n'),
          inline: true
        },
        {
          name: '💰 Cost',
          value: [
            `Opening Fee: -$${OPEN_COST}`,
            `Remaining: **$${player.cash.toFixed(2)}**`
          ].join('\n'),
          inline: true
        },
        {
          name: '📋 Your Empire',
          value: player.restaurants.map((r, i) => `${i + 1}. **${r.name}** — ${RESTAURANT_TIERS[r.tier]?.name}`).join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Hire staff and upgrade your new location to maximize profits!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

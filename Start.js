const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, savePlayer } = require('../systems/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('🍔 Start your Fast Food Empire!'),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (player.name) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B35')
          .setTitle('🍔 Already Started!')
          .setDescription(`You already have an empire, **${player.name}**! Use \`/status\` to check in.`)
        ],
        ephemeral: true
      });
    }

    // Give starter restaurant
    const startRestaurant = {
      id: `rest_${Date.now()}`,
      name: `${interaction.user.username}'s Food Cart`,
      tier: 'foodcart',
      menu: ['burger', 'fries', 'soda'],
      openedAt: Date.now(),
      totalRevenue: 0,
      totalOrders: 0
    };

    player.name = interaction.user.username;
    player.restaurants = [startRestaurant];
    player.cash = 500;
    savePlayer(interaction.user.id, player);

    const embed = new EmbedBuilder()
      .setColor('#FF6B35')
      .setTitle('🍔 Welcome to Fast Food Tycoon!')
      .setDescription(`**${player.name}**, your empire begins now!`)
      .addFields(
        {
          name: '🛒 Your First Location',
          value: `**${startRestaurant.name}**\nTier: Food Cart | Menu: Burger, Fries, Soda`,
          inline: false
        },
        {
          name: '💵 Starting Cash',
          value: `**$${player.cash}**`,
          inline: true
        },
        {
          name: '⭐ Reputation',
          value: `**${player.reputation}/100**`,
          inline: true
        },
        {
          name: '📋 Getting Started',
          value: [
            '`/status` — View your empire overview',
            '`/customers` — See waiting NPC customers',
            '`/serve` — Serve a customer and earn cash',
            '`/hire` — Hire your first staff member',
            '`/upgrade` — Upgrade your restaurant',
            '`/market` — Check ingredient prices'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Customers arrive every 30 seconds. Don\'t let them leave hungry!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

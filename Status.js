const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../systems/database');
const { RESTAURANT_TIERS, calcRestaurantUpkeep } = require('../systems/economy');
const { calcHourlyWages } = require('../systems/staffSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('📊 View your Fast Food Empire status'),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({
        content: '❌ You haven\'t started yet! Use `/start` to begin your empire.',
        ephemeral: true
      });
    }

    const waitingCustomers = (player.activeOrders || []).filter(o => o.status === 'waiting').length;
    const hourlyWages = calcHourlyWages(player.staff || []);
    const dailyUpkeep = (player.restaurants || []).reduce((sum, r) => sum + calcRestaurantUpkeep(r), 0);

    // Reputation bar
    const repBar = buildBar(player.reputation, 100, 12);
    const repEmoji = player.reputation >= 75 ? '🌟' : player.reputation >= 50 ? '⭐' : player.reputation >= 25 ? '💫' : '⚠️';

    // Cash trend color
    const color = player.cash >= 1000 ? '#2ECC71' : player.cash >= 200 ? '#FF6B35' : '#E74C3C';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🍔 ${player.name}'s Fast Food Empire`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: '💰 Finances',
          value: [
            `**Cash:** $${player.cash.toFixed(2)}`,
            `**Total Earned:** $${(player.totalEarned || 0).toFixed(2)}`,
            `**Hourly Wages:** $${hourlyWages}/hr`,
            `**Daily Rent:** $${dailyUpkeep}/day`
          ].join('\n'),
          inline: true
        },
        {
          name: '📈 Performance',
          value: [
            `**Orders Done:** ${player.completedOrders || 0}`,
            `**Orders Missed:** ${player.failedOrders || 0}`,
            `**Success Rate:** ${calcSuccessRate(player)}%`,
            `**Waiting Now:** ${waitingCustomers} 🧍`
          ].join('\n'),
          inline: true
        },
        {
          name: `${repEmoji} Reputation`,
          value: `${repBar} **${player.reputation}/100**\n${getRepText(player.reputation)}`,
          inline: false
        },
        {
          name: '🏪 Restaurants',
          value: buildRestaurantList(player),
          inline: false
        },
        {
          name: '👥 Staff',
          value: buildStaffSummary(player),
          inline: false
        }
      )
      .setFooter({ text: `Use /customers to see who's waiting • /serve to earn cash` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

function buildBar(value, max, length) {
  const filled = Math.round((value / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function calcSuccessRate(player) {
  const total = (player.completedOrders || 0) + (player.failedOrders || 0);
  if (total === 0) return 100;
  return +((player.completedOrders / total) * 100).toFixed(1);
}

function getRepText(rep) {
  if (rep >= 90) return '*Legendary status! Customers come from miles away.*';
  if (rep >= 75) return '*Well-loved spot. Regulars bring their friends.*';
  if (rep >= 50) return '*Decent reputation. Room to grow.*';
  if (rep >= 25) return '*People are talking... not always nicely.*';
  return '*Your reputation is struggling. Serve customers faster!*';
}

function buildRestaurantList(player) {
  if (!player.restaurants || player.restaurants.length === 0) return '*No restaurants yet.*';
  return player.restaurants.map(r => {
    const tier = RESTAURANT_TIERS[r.tier];
    return `**${r.name}** — ${tier?.name || r.tier} | Revenue: $${(r.totalRevenue || 0).toFixed(2)}`;
  }).join('\n');
}

function buildStaffSummary(player) {
  if (!player.staff || player.staff.length === 0) return '*No staff hired. Use `/hire` to get help!*';
  const counts = {};
  for (const s of player.staff) {
    counts[s.roleName] = (counts[s.roleName] || 0) + 1;
  }
  return Object.entries(counts).map(([role, count]) => `${role} ×${count}`).join('  |  ');
  }

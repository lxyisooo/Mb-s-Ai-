const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../systems/database');
const { STAFF_ROLES, calcHourlyWages, getStaffBonus } = require('../systems/staffSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('👥 View your staff roster and performance'),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    if (!player.staff || player.staff.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#95A5A6')
          .setTitle('👥 No Staff Hired')
          .setDescription('You\'re running solo! Hire staff to serve customers faster and unlock bonuses.\n\n`/hire cashier` — Speeds up orders\n`/hire cook` — Better food quality\n`/hire manager` — Boosts all staff\n`/hire cleaner` — Passive reputation boost\n`/hire delivery` — Unlocks delivery orders')
        ]
      });
    }

    const totalWages = calcHourlyWages(player.staff);
    const restaurant = (player.restaurants || [])[0];

    let staffBonus = { speedBonus: 1, qualityBonus: 1 };
    if (restaurant) {
      staffBonus = getStaffBonus(player.staff, restaurant.id);
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`👥 Your Staff — ${player.staff.length} Employee(s)`)
      .addFields(
        {
          name: '📊 Team Bonuses',
          value: [
            `⚡ Speed Bonus: +${((staffBonus.speedBonus - 1) * 100).toFixed(0)}%`,
            `🍽️ Quality Bonus: +${((staffBonus.qualityBonus - 1) * 100).toFixed(0)}%`,
            `💸 Total Wages: $${totalWages}/hr`
          ].join('\n'),
          inline: false
        }
      );

    for (const s of player.staff) {
      const role = STAFF_ROLES[s.roleKey] || {};
      const stars = '⭐'.repeat(s.skillLevel) + '☆'.repeat(5 - s.skillLevel);
      const moraleEmoji = s.morale >= 75 ? '😊' : s.morale >= 50 ? '😐' : '😟';
      const rest = (player.restaurants || []).find(r => r.id === s.restaurantId);

      embed.addFields({
        name: `${s.roleName} — **${s.name}**`,
        value: [
          `Skill: ${stars}`,
          `Morale: ${moraleEmoji} ${s.morale}/100`,
          `Wage: $${role.hourlyWage || '?'}/hr`,
          `Location: ${rest?.name || 'Unknown'}`,
          `Orders Helped: ${s.ordersHelped || 0}`
        ].join(' | '),
        inline: false
      });
    }

    embed.addFields({
      name: '💡 Hire More',
      value: 'Use `/hire [role]` to expand your team!',
      inline: false
    });

    await interaction.reply({ embeds: [embed] });
  }
};

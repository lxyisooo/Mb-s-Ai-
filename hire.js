const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, savePlayer } = require('../systems/database');
const { STAFF_ROLES, generateStaff, canHireRole } = require('../systems/staffSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hire')
    .setDescription('👔 Hire staff for your restaurant')
    .addStringOption(opt =>
      opt.setName('role')
        .setDescription('Which role to hire')
        .setRequired(true)
        .addChoices(
          { name: '💳 Cashier ($100)', value: 'cashier' },
          { name: '👨‍🍳 Cook ($200)', value: 'cook' },
          { name: '📋 Manager ($800)', value: 'manager' },
          { name: '🧹 Cleaner ($80)', value: 'cleaner' },
          { name: '🛵 Delivery Driver ($300)', value: 'delivery' }
        )
    ),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    if (!player.restaurants || player.restaurants.length === 0) {
      return interaction.reply({ content: '❌ You need a restaurant first!', ephemeral: true });
    }

    const roleKey = interaction.options.getString('role');
    const role = STAFF_ROLES[roleKey];
    const restaurant = player.restaurants[0]; // Hire to first restaurant for simplicity

    const check = canHireRole(player, restaurant.id, roleKey);
    if (!check.ok) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Cannot Hire')
          .setDescription(check.reason)
        ],
        ephemeral: true
      });
    }

    // Hire the staff member
    const newStaff = generateStaff(roleKey, restaurant.id);
    player.cash = +(player.cash - role.hireCost).toFixed(2);
    if (!player.staff) player.staff = [];
    player.staff.push(newStaff);
    savePlayer(interaction.user.id, player);

    const skillStars = '⭐'.repeat(newStaff.skillLevel) + '☆'.repeat(5 - newStaff.skillLevel);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`✅ ${role.name} Hired!`)
      .setDescription(`**${newStaff.name}** has joined your team at **${restaurant.name}**!`)
      .addFields(
        {
          name: '👤 New Employee',
          value: [
            `Name: **${newStaff.name}**`,
            `Role: ${role.name}`,
            `Skill: ${skillStars} (Lv.${newStaff.skillLevel})`,
            `Morale: ${newStaff.morale}/100 😊`
          ].join('\n'),
          inline: true
        },
        {
          name: '💰 Cost',
          value: [
            `Hire Fee: -$${role.hireCost}`,
            `Hourly Wage: $${role.hourlyWage}/hr`,
            `Your Cash: **$${player.cash.toFixed(2)}**`
          ].join('\n'),
          inline: true
        },
        {
          name: '💡 What They Do',
          value: role.description,
          inline: false
        },
        {
          name: '👥 Your Team Now',
          value: buildTeamSummary(player.staff, restaurant.id),
          inline: false
        }
      )
      .setFooter({ text: 'Staff bonuses apply automatically when you serve orders!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

function buildTeamSummary(staff, restaurantId) {
  const team = staff.filter(s => s.restaurantId === restaurantId);
  if (team.length === 0) return '*Empty*';
  return team.map(s => `${s.roleName} — **${s.name}** (Lv.${s.skillLevel})`).join('\n');
        }

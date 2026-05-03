const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../systems/database');
const { MENU_ITEMS } = require('../systems/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customers')
    .setDescription('👀 See who\'s waiting at your restaurants'),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    const waiting = (player.activeOrders || []).filter(o => o.status === 'waiting');

    if (waiting.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#95A5A6')
          .setTitle('🏪 No Customers Waiting')
          .setDescription('Your restaurants are quiet right now. Customers arrive based on your reputation.\n\nTip: Improve reputation by serving orders quickly!')
          .setFooter({ text: 'New customers arrive every 30 seconds' })
        ]
      });
    }

    const now = Date.now();

    const embed = new EmbedBuilder()
      .setColor('#FF6B35')
      .setTitle(`🧍 ${waiting.length} Customer(s) Waiting`)
      .setDescription('Use `/serve [customer_id]` to serve them before they leave!\n━━━━━━━━━━━━━━━━━━━━━━━');

    for (const customer of waiting.slice(0, 6)) { // Show up to 6
      const timeLeft = Math.max(0, Math.floor((customer.expiresAt - now) / 1000));
      const timeEmoji = timeLeft > 120 ? '🟢' : timeLeft > 60 ? '🟡' : '🔴';
      const orderNames = customer.order.map(key => MENU_ITEMS[key]?.name || key).join(', ');
      const hungerBar = buildHungerBar(customer.hungerLevel);

      embed.addFields({
        name: `${customer.personalityLabel} **${customer.name}** \`ID: ${customer.id.slice(-6)}\``,
        value: [
          `🍽️ Order: ${orderNames}`,
          `💵 Bill: **$${customer.orderValue.toFixed(2)}** ${customer.tipMultiplier > 1.5 ? '+ big tip! 🤑' : customer.tipMultiplier > 0 ? '+ tip 💰' : '(no tip)'}`,
          `🍽️ Hunger: ${hungerBar} ${customer.hungerLevel}%`,
          `${timeEmoji} Patience: **${formatTime(timeLeft)}** left`
        ].join('\n'),
        inline: false
      });
    }

    if (waiting.length > 6) {
      embed.setFooter({ text: `...and ${waiting.length - 6} more customers waiting` });
    }

    embed.addFields({
      name: '💡 Serve Command',
      value: '`/serve [last 6 chars of ID]` — e.g. `/serve abc123`',
      inline: false
    });

    await interaction.reply({ embeds: [embed] });
  }
};

function buildHungerBar(value) {
  const filled = Math.round(value / 10);
  const colors = value >= 80 ? '🟥' : value >= 50 ? '🟧' : '🟩';
  return colors.repeat(filled) + '⬛'.repeat(10 - filled);
}

function formatTime(seconds) {
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
  }

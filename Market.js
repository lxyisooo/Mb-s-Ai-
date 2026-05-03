const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, savePlayer } = require('../systems/database');
const { MENU_ITEMS, getMarketMultiplier, getItemCost } = require('../systems/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('📈 Check ingredient market prices and profit margins'),

  async execute(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player.name) {
      return interaction.reply({ content: '❌ Use `/start` first!', ephemeral: true });
    }

    // Refresh market multiplier
    const newMultiplier = getMarketMultiplier();
    player.marketMultiplier = newMultiplier;
    savePlayer(interaction.user.id, player);

    const marketStatus = newMultiplier > 1.2 ? '📈 HIGH' : newMultiplier < 0.85 ? '📉 LOW' : '📊 NORMAL';
    const marketColor = newMultiplier > 1.2 ? '#E74C3C' : newMultiplier < 0.85 ? '#2ECC71' : '#FF6B35';

    let itemLines = '';
    for (const [key, item] of Object.entries(MENU_ITEMS)) {
      const priced = getItemCost(key, newMultiplier);
      const marginEmoji = priced.margin >= 65 ? '🟢' : priced.margin >= 45 ? '🟡' : '🔴';
      itemLines += `${item.name}\n`;
      itemLines += `  Price: $${item.basePrice} | Cost: $${priced.currentCost} | Margin: ${marginEmoji} ${priced.margin}%\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(marketColor)
      .setTitle('📊 Ingredient Market Report')
      .setDescription(
        `**Market Conditions: ${marketStatus}** (×${newMultiplier})\n` +
        `${newMultiplier > 1.2 ? '⚠️ High ingredient costs today — margins are tight!' : newMultiplier < 0.85 ? '✅ Low ingredient costs — great day to serve big orders!' : 'Normal market conditions.'}\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '🛒 All Menu Items',
          value: itemLines || 'No items',
          inline: false
        },
        {
          name: '💡 Tips',
          value: [
            '🟢 Green margin = great profit (65%+)',
            '🟡 Yellow margin = okay profit (45-65%)',
            '🔴 Red margin = thin profit (under 45%)',
            'Market refreshes every time you check!'
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: `Your market multiplier: ×${newMultiplier} | Prices reset on each /market check` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

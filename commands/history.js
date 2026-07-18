import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View recent transactions')
    .addIntegerOption(option => option.setName('limit').setDescription('Number of transactions to show (default: 10, max: 25)').setMinValue(1).setMaxValue(25)),
  async execute(interaction) {
    try {
      const limit = interaction.options.getInteger('limit') || 10;
      const transactions = db.data.transactions.filter(t => t.is_deleted === 0).reverse().slice(0, limit);
      if (transactions.length === 0) return interaction.reply({ content: 'No transactions found.', ephemeral: true });

      const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`📜 Last ${transactions.length} Transactions`);
      for (const tx of transactions) {
        const sign = tx.type === 'INCOME' ? '+' : '-';
        const formattedAmount = formatUSD(tx.amount);
        const emoji = tx.type === 'INCOME' ? '🟢' : '🔴';
        embed.addFields({ name: `${emoji} ${tx.tx_id} | ${new Date(tx.timestamp).toLocaleDateString()}`, value: `**Amount:** ${sign}${formattedAmount}\n**Reason:** ${tx.reason}`, inline: false });
      }
      await interaction.reply({ embeds: [embed] });
    } catch (error) { logger.error('Error executing /history:', error); await interaction.reply({ content: 'Failed to retrieve history.', ephemeral: true }); }
  }
};
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatINR, formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View recent transaction history')
    .addIntegerOption(option => 
      option.setName('limit')
        .setDescription('Number of transactions to show (default 10, max 50)')
        .setMinValue(1)
        .setMaxValue(50)),
        
  async execute(interaction) {
    try {
      const limit = interaction.options.getInteger('limit') || 10;
      
      const transactions = db.data.transactions
        .filter(t => t.is_deleted === 0)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
      
      if (transactions.length === 0) {
        return interaction.reply({ content: 'No transactions found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle(`📜 Transaction History (Last ${transactions.length})`)
        .setDescription(transactions.map(tx => {
          const sign = tx.type === 'INCOME' ? '+' : '-';
          const amt = tx.original_currency === 'USD' ? formatUSD(tx.original_amount) : formatINR(tx.original_amount);
          return `**${tx.tx_id}** | ${sign}${amt} | ${tx.reason}`;
        }).join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error executing /history:', error);
      await interaction.reply({ content: 'Failed to retrieve history.', ephemeral: true });
    }
  }
};
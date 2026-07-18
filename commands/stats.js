import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View detailed financial statistics'),
  async execute(interaction) {
    try {
      let totalIncome = 0; let totalExpense = 0; let incomeCount = 0; let expenseCount = 0;
      for (const tx of db.data.transactions) {
        if (tx.is_deleted === 0) {
          if (tx.type === 'INCOME') { totalIncome += tx.amount; incomeCount++; } else { totalExpense += tx.amount; expenseCount++; }
        }
      }
      const netProfit = totalIncome - totalExpense;
      const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📊 Financial Statistics')
        .addFields(
          { name: '🟢 Total Income', value: formatUSD(totalIncome), inline: true },
          { name: '🔴 Total Expenses', value: formatUSD(totalExpense), inline: true },
          { name: '💰 Net Profit', value: formatUSD(netProfit), inline: true },
          { name: 'Transactions', value: `${incomeCount} Income | ${expenseCount} Expenses`, inline: false }
        ).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (error) { logger.error('Error executing /stats:', error); await interaction.reply({ content: 'Failed to retrieve statistics.', ephemeral: true }); }
  }
};
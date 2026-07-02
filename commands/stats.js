import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatINR } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View overall statistics and reports')
    .addStringOption(option => 
      option.setName('period')
        .setDescription('Optional time period filter')
        .addChoices(
          { name: 'All Time', value: 'all' },
          { name: 'This Month', value: 'month' },
          { name: 'Today', value: 'today' }
        )),
        
  async execute(interaction) {
    try {
      const period = interaction.options.getString('period') || 'all';
      
      let sql = 'SELECT * FROM transactions WHERE is_deleted = 0';
      const params = [];
      
      if (period === 'month') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0,0,0,0);
        sql += ' AND timestamp >= ?';
        params.push(startOfMonth.getTime());
      } else if (period === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        sql += ' AND timestamp >= ?';
        params.push(startOfDay.getTime());
      }

      const transactions = db.prepare(sql).all(...params);
      
      let totalIncome = 0;
      let totalExpense = 0;
      let largestIncome = 0;
      let largestExpense = 0;

      for (const tx of transactions) {
        if (tx.type === 'INCOME') {
          totalIncome += tx.converted_inr;
          if (tx.converted_inr > largestIncome) largestIncome = tx.converted_inr;
        } else {
          totalExpense += tx.converted_inr;
          if (tx.converted_inr > largestExpense) largestExpense = tx.converted_inr;
        }
      }

      const netProfit = totalIncome - totalExpense;

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle(`📊 Financial Statistics (${period.toUpperCase()})`)
        .addFields(
          { name: 'Total Income', value: formatINR(totalIncome), inline: true },
          { name: 'Total Expenses', value: formatINR(totalExpense), inline: true },
          { name: 'Net Profit', value: formatINR(netProfit), inline: true },
          { name: 'Largest Income', value: formatINR(largestIncome), inline: true },
          { name: 'Largest Expense', value: formatINR(largestExpense), inline: true },
          { name: 'Transaction Count', value: String(transactions.length), inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error executing /stats:', error);
      await interaction.reply({ content: 'Failed to retrieve stats.', ephemeral: true });
    }
  }
};
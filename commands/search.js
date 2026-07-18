import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search transactions by keyword')
    .addStringOption(option => option.setName('keyword').setDescription('Keyword to search for in reason').setRequired(true)),
  async execute(interaction) {
    try {
      const keyword = interaction.options.getString('keyword').toLowerCase();
      const transactions = db.data.transactions.filter(t => t.is_deleted === 0 && t.reason.toLowerCase().includes(keyword)).reverse().slice(0, 10);
      if (transactions.length === 0) return interaction.reply({ content: `No transactions found containing "${keyword}".`, ephemeral: true });

      const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🔍 Search Results for "${keyword}"`);
      for (const tx of transactions) {
        const sign = tx.type === 'INCOME' ? '+' : '-';
        const formattedAmount = formatUSD(tx.amount);
        const emoji = tx.type === 'INCOME' ? '🟢' : '🔴';
        embed.addFields({ name: `${emoji} ${tx.tx_id} | ${new Date(tx.timestamp).toLocaleDateString()}`, value: `**Amount:** ${sign}${formattedAmount}\n**Reason:** ${tx.reason}`, inline: false });
      }
      await interaction.reply({ embeds: [embed] });
    } catch (error) { logger.error('Error executing /search:', error); await interaction.reply({ content: 'Failed to search transactions.', ephemeral: true }); }
  }
};
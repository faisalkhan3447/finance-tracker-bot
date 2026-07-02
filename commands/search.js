import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatINR, formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for transactions using advanced filters')
    .addStringOption(option => 
      option.setName('query')
        .setDescription('Search query (e.g., amount>500, reason:hosting, user:@name)')
        .setRequired(true)),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const query = interaction.options.getString('query').trim().toLowerCase();
      
      let results = db.data.transactions.filter(t => t.is_deleted === 0);

      if (query.startsWith('amount>')) {
        const val = parseFloat(query.split('>')[1]);
        results = results.filter(t => t.original_amount > val);
      } else if (query.startsWith('amount<')) {
        const val = parseFloat(query.split('<')[1]);
        results = results.filter(t => t.original_amount < val);
      } else if (query.startsWith('reason:')) {
        const val = query.split(':')[1];
        results = results.filter(t => t.reason.toLowerCase().includes(val));
      } else if (query.startsWith('txid:')) {
        const val = query.split(':')[1].toUpperCase();
        results = results.filter(t => t.tx_id === val);
      } else if (query === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const start = startOfDay.getTime();
        results = results.filter(t => t.timestamp >= start);
      } else {
        results = results.filter(t => t.reason.toLowerCase().includes(query));
      }

      results = results.sort((a, b) => b.id - a.id).slice(0, 15);
      
      if (results.length === 0) {
        return interaction.editReply('No transactions found matching your query.');
      }

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle(`🔍 Search Results: ${query}`)
        .setDescription(results.map(tx => {
          const sign = tx.type === 'INCOME' ? '+' : '-';
          const amt = tx.original_currency === 'USD' ? formatUSD(tx.original_amount) : formatINR(tx.original_amount);
          return `**${tx.tx_id}** | ${sign}${amt} | ${tx.reason}`;
        }).join('\n'));

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error executing /search:', error);
      await interaction.editReply('Failed to execute search.');
    }
  }
};
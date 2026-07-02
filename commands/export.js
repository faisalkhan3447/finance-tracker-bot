import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatINR, formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';
import { writeToString } from 'csv-writer/src/lib/csv-stringifier-factory.js'; 

export default {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('Export transaction history to CSV or JSON')
    .setDefaultMemberPermissions(8)
    .addStringOption(option => 
      option.setName('format')
        .setDescription('The export format')
        .setRequired(true)
        .addChoices(
          { name: 'CSV', value: 'csv' },
          { name: 'JSON', value: 'json' }
        )),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const format = interaction.options.getString('format');
      
      const transactions = db.data.transactions;
      
      let fileContent = '';
      let fileExtension = format;

      if (format === 'json') {
        fileContent = JSON.stringify(transactions, null, 2);
      } else {
        const headers = ['ID', 'TX ID', 'Message ID', 'User ID', 'Username', 'Type', 'Original Amount', 'Original Currency', 'Converted INR', 'Balance After', 'Reason', 'Is Deleted', 'Timestamp'];
        const escapeCsv = (str) => {
          if (str === null || str === undefined) return '';
          const s = String(str);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };
        
        fileContent += headers.map(escapeCsv).join(',') + '\n';
        for (const tx of transactions) {
          const row = [
            tx.id, tx.tx_id, tx.message_id, tx.user_id, tx.username, tx.type, 
            tx.original_amount, tx.original_currency, tx.converted_inr, tx.balance_after, 
            tx.reason, tx.is_deleted ? 'Yes' : 'No', 
            new Date(tx.timestamp).toISOString()
          ];
          fileContent += row.map(escapeCsv).join(',') + '\n';
        }
      }

      const buffer = Buffer.from(fileContent, 'utf-8');
      
      await interaction.editReply({
        content: `✅ Exported ${transactions.length} transactions as ${format.toUpperCase()}.`,
        files: [{
          attachment: buffer,
          name: `finance-export-${Date.now()}.${fileExtension}`
        }]
      });

    } catch (error) {
      logger.error('Error executing /export:', error);
      const reply = interaction.deferred ? 'editReply' : 'reply';
      await interaction[reply](`Failed to export transactions: ${error.message}`);
    }
  }
};
import { SlashCommandBuilder } from 'discord.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Restore a previously undone/deleted transaction')
    .setDefaultMemberPermissions(8)
    .addStringOption(option => 
      option.setName('txid')
        .setDescription('The TX ID to restore (e.g., TX-000001)')
        .setRequired(true)),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getString('txid').trim().toUpperCase();
      const oldBalance = parseFloat(db.getConfig('balance_inr', '0'));
      
      const restoredTx = await TransactionService.restoreTransaction(target);

      await NotificationService.dispatchAuditLog('RESTORED', restoredTx, oldBalance);
      await NotificationService.refreshDashboard();
      
      await interaction.editReply(`✅ Successfully restored transaction **${restoredTx.tx_id}**.`);
    } catch (error) {
      logger.error('Error executing /restore:', error);
      await interaction.editReply(`❌ Failed to restore transaction: ${error.message}`);
    }
  }
};
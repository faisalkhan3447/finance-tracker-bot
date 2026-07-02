import { SlashCommandBuilder } from 'discord.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('undo')
    .setDescription('Undo a transaction')
    .setDefaultMemberPermissions(8)
    .addStringOption(option => 
      option.setName('target')
        .setDescription('The TX ID to undo, or "latest"')
        .setRequired(true)),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getString('target').trim().toUpperCase();
      const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
      
      let deletedTx;
      
      if (target === 'LATEST') {
        deletedTx = await TransactionService.undoLatestTransaction();
      } else {
        deletedTx = await TransactionService.deleteTransaction(target, 'tx_id');
      }

      await NotificationService.dispatchAuditLog('UNDONE', deletedTx, oldBalance);
      await NotificationService.refreshDashboard();
      
      await interaction.editReply(`✅ Successfully undone transaction **${deletedTx.tx_id}**.`);
    } catch (error) {
      logger.error('Error executing /undo:', error);
      await interaction.editReply(`❌ Failed to undo transaction: ${error.message}`);
    }
  }
};
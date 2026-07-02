import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    const txChannelId = db.getConfig('transaction_channel');
    if (!txChannelId || message.channel.id !== txChannelId) return;

    const existingTx = db.data.transactions.find(t => t.message_id === message.id && t.is_deleted === 0);

    if (existingTx) {
      try {
        logger.info(`Valid transaction message ${message.id} deleted. Reversing transaction.`);
        const oldBalance = parseFloat(db.getConfig('balance_inr', '0'));
        const deletedTx = await TransactionService.deleteTransaction(message.id, 'message_id');
        
        await NotificationService.dispatchAuditLog('DELETED', deletedTx, oldBalance);
        await NotificationService.refreshDashboard();
      } catch (error) {
        logger.error(`Error processing messageDelete for ${message.id}:`, error);
      }
    }
  }
};
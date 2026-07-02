import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    // Check if this is the transaction channel
    const txChannelId = db.prepare("SELECT value FROM configuration WHERE key = 'transaction_channel'").get()?.value;
    if (!txChannelId || message.channel.id !== txChannelId) return;

    // Check if the deleted message was a processed transaction
    const existingTx = db.prepare('SELECT * FROM transactions WHERE message_id = ? AND is_deleted = 0').get(message.id);

    if (existingTx) {
      try {
        logger.info(`Valid transaction message ${message.id} deleted. Reversing transaction.`);
        const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
        const deletedTx = await TransactionService.deleteTransaction(message.id, 'message_id');
        
        await NotificationService.dispatchAuditLog('DELETED', deletedTx, oldBalance);
        await NotificationService.refreshDashboard();
      } catch (error) {
        logger.error(`Error processing messageDelete for ${message.id}:`, error);
      }
    }
  }
};
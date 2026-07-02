import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage, formatINR, formatUSD } from '../utils/currency.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (newMessage.author?.bot || !newMessage.guild) return;

    // Check if this is the transaction channel
    const txChannelId = db.prepare("SELECT value FROM configuration WHERE key = 'transaction_channel'").get()?.value;
    if (!txChannelId || newMessage.channel.id !== txChannelId) return;

    // Fetch full message if partial (it's possible if the bot restarted)
    if (newMessage.partial) {
      try {
        await newMessage.fetch();
      } catch (err) {
        logger.error('Failed to fetch partial edited message', err);
        return;
      }
    }

    const newParsed = parseTransactionMessage(newMessage.content);
    
    // Check if the old message was previously processed as a transaction
    const existingTx = db.prepare('SELECT * FROM transactions WHERE message_id = ? AND is_deleted = 0').get(newMessage.id);

    try {
      if (existingTx) {
        if (!newParsed) {
          // Changed from valid -> invalid. We should reverse the old transaction.
          logger.info(`Message ${newMessage.id} changed from valid to invalid. Reversing transaction.`);
          const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
          const deletedTx = await TransactionService.deleteTransaction(newMessage.id, 'message_id');
          await NotificationService.dispatchAuditLog('DELETED', deletedTx, oldBalance);
          await NotificationService.refreshDashboard();
          return;
        }

        // It was valid and is still valid. Let's update it.
        const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
        const updatedTx = await TransactionService.updateTransaction(newMessage.id, {
          type: newParsed.type,
          originalAmount: newParsed.amount,
          originalCurrency: newParsed.currency,
          reason: newParsed.reason
        });
        
        await NotificationService.dispatchAuditLog('UPDATED', updatedTx, oldBalance);
        await NotificationService.refreshDashboard();
      } else {
        if (newParsed) {
          // Changed from invalid -> valid. Create new transaction.
          logger.info(`Message ${newMessage.id} changed from invalid to valid. Creating transaction.`);
          const oldBalance = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
          const newTx = await TransactionService.createTransaction({
            messageId: newMessage.id,
            userId: newMessage.author.id,
            username: newMessage.author.username,
            type: newParsed.type,
            originalAmount: newParsed.amount,
            originalCurrency: newParsed.currency,
            reason: newParsed.reason
          });
          await NotificationService.dispatchAuditLog('ADDED', newTx, oldBalance);
          await NotificationService.refreshDashboard();
        }
      }
    } catch (error) {
      logger.error(`Error processing messageUpdate for ${newMessage.id}:`, error);
      
      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Transaction Edit Failed')
        .setDescription(error.message || 'An unknown error occurred while updating the transaction.');
        
      const reply = await newMessage.reply({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 8000);
    }
  }
};
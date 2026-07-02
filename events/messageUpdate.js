import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage } from '../utils/currency.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (newMessage.author?.bot || !newMessage.guild) return;

    const txChannelId = db.getConfig('transaction_channel');
    if (!txChannelId || newMessage.channel.id !== txChannelId) return;

    if (newMessage.partial) {
      try {
        await newMessage.fetch();
      } catch (err) {
        logger.error('Failed to fetch partial edited message', err);
        return;
      }
    }

    const newParsed = parseTransactionMessage(newMessage.content);
    
    const existingTx = db.data.transactions.find(t => t.message_id === newMessage.id && t.is_deleted === 0);

    try {
      if (existingTx) {
        if (!newParsed) {
          logger.info(`Message ${newMessage.id} changed from valid to invalid. Reversing transaction.`);
          const oldBalance = parseFloat(db.getConfig('balance_inr', '0'));
          const deletedTx = await TransactionService.deleteTransaction(newMessage.id, 'message_id');
          await NotificationService.dispatchAuditLog('DELETED', deletedTx, oldBalance);
          await NotificationService.refreshDashboard();
          return;
        }

        const oldBalance = parseFloat(db.getConfig('balance_inr', '0'));
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
          logger.info(`Message ${newMessage.id} changed from invalid to valid. Creating transaction.`);
          const oldBalance = parseFloat(db.getConfig('balance_inr', '0'));
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
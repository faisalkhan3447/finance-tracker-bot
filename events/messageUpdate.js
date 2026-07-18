import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage, formatUSD } from '../utils/currency.js';
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
      try { await newMessage.fetch(); } catch (err) { logger.error('Failed to fetch partial edited message', err); return; }
    }

    const newParsed = parseTransactionMessage(newMessage.content);
    const existingTx = db.data.transactions.find(t => t.message_id === newMessage.id && t.is_deleted === 0);

    try {
      if (existingTx) {
        if (!newParsed) {
          logger.info(`Message ${newMessage.id} changed from valid to invalid. Reversing transaction.`);
          const deletedTx = await TransactionService.deleteTransaction(newMessage.id, 'message_id');
          await newMessage.reactions.removeAll().catch(() => {}); 
          const oldBalance = deletedTx.balance_after + (deletedTx.type === 'INCOME' ? -deletedTx.amount : deletedTx.amount);
          await NotificationService.dispatchAuditLog('DELETED', deletedTx, oldBalance);
          await NotificationService.refreshDashboard();
          return;
        }

        const oldBalance = existingTx.balance_after - (existingTx.type === 'INCOME' ? existingTx.amount : -existingTx.amount);
        const updatedTx = await TransactionService.updateTransaction(newMessage.id, {
          type: newParsed.type,
          amount: newParsed.amount,
          reason: newParsed.reason
        });
        
        await NotificationService.dispatchAuditLog('UPDATED', updatedTx, oldBalance);
        await NotificationService.refreshDashboard();
      } else {
        if (newParsed) {
          logger.info(`Message ${newMessage.id} changed from invalid to valid. Creating transaction.`);
          await newMessage.delete().catch(() => {});
          const tx = await TransactionService.createTransaction({
            messageId: newMessage.id,
            userId: newMessage.author.id,
            username: newMessage.author.username,
            type: newParsed.type,
            amount: newParsed.amount,
            reason: newParsed.reason
          });
          
          const currentBalance = tx.balance_after;
          const embed = new EmbedBuilder().setColor(tx.type === 'INCOME' ? '#00FF00' : '#FF0000').setTitle(`✅ Transaction Recorded (Edited)`)
            .addFields(
              { name: 'Amount', value: `**${tx.type === 'INCOME' ? '+' : '-'}${formatUSD(tx.amount)}**`, inline: true },
              { name: 'New Balance', value: `**${formatUSD(currentBalance)}**`, inline: true },
              { name: 'Reason', value: tx.reason, inline: false }
            ).setFooter({ text: `TX ID: ${tx.tx_id} | Logged by ${newMessage.author.username}` });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`undo_${tx.tx_id}`).setLabel('Undo').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`pdf_${tx.tx_id}`).setLabel('📄 Download PDF').setStyle(ButtonStyle.Primary)
          );

          const logChannelId = db.getConfig('transactionlog_channel');
          if (logChannelId) {
            const logChannel = await newMessage.client.channels.fetch(logChannelId).catch(() => null);
            if (logChannel) await logChannel.send({ embeds: [embed], components: [row] });
          }

          const previousBalance = currentBalance - (tx.type === 'INCOME' ? tx.amount : -tx.amount);
          await NotificationService.dispatchAuditLog('ADDED', tx, previousBalance);
          await NotificationService.refreshDashboard();
        }
      }
    } catch (error) {
      logger.error(`Error processing messageUpdate for ${newMessage.id}:`, error);
    }
  }
};
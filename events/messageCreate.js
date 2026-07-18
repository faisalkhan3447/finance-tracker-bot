import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage, formatUSD } from '../utils/currency.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';
import EmbedService from '../services/EmbedService.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const txChannelId = db.getConfig('transaction_channel');
    if (!txChannelId || message.channel.id !== txChannelId) return;

    const parsed = parseTransactionMessage(message.content);
    if (!parsed) return; 

    const deleted = await message.delete().catch(err => {
      logger.warn(`Failed to delete message: ${err.message}. Ensure bot has Manage Messages permission.`);
      return false;
    });

    try {
      const tx = await TransactionService.createTransaction({
        messageId: message.id, 
        userId: message.author.id,
        username: message.author.username,
        type: parsed.type,
        amount: parsed.amount,
        reason: parsed.reason
      });

      const currentBalance = tx.balance_after;
      const previousBalance = currentBalance - (tx.type === 'INCOME' ? tx.amount : -tx.amount);
      
      const { embeds, components } = EmbedService.generateAuditLog('ADDED', tx, previousBalance);

      const logChannelId = db.getConfig('transactionlog_channel');
      if (logChannelId) {
        const logChannel = await message.client.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          await logChannel.send({ embeds, components });
        } else {
          await message.channel.send({ embeds, components });
        }
      } else {
        await message.channel.send({ embeds, components });
      }
      
      if (deleted === false) {
        const warnEmbed = new EmbedBuilder().setColor('#FEE75C').setDescription('⚠️ Please give the bot **Manage Messages** permission in this channel to auto-delete your transaction logs!');
        const wMsg = await message.channel.send({ embeds: [warnEmbed] });
        setTimeout(() => wMsg.delete().catch(()=>null), 10000);
      }

      await NotificationService.refreshDashboard();

    } catch (error) {
      logger.error('Error processing transaction message:', error);
      const embed = new EmbedBuilder().setColor('#FF0000').setTitle('❌ Transaction Failed').setDescription(error.message || 'An unknown error occurred while saving the transaction.');
      const reply = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 15000);
    }
  }
};
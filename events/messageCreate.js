import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage, formatUSD } from '../utils/currency.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import db from '../database/db.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    const txChannelId = db.getConfig('transaction_channel');
    if (!txChannelId || message.channel.id !== txChannelId) return;

    const parsed = parseTransactionMessage(message.content);
    if (!parsed) return; 

    await message.delete().catch(() => {});

    try {
      const tx = await TransactionService.createTransaction({ messageId: message.id, userId: message.author.id, username: message.author.username, type: parsed.type, amount: parsed.amount, reason: parsed.reason });
      const currentBalance = tx.balance_after;

      const embed = new EmbedBuilder().setColor(tx.type === 'INCOME' ? '#00FF00' : '#FF0000').setTitle(`🧾 Transaction Receipt: ${tx.tx_id}`)
        .addFields(
          { name: 'Type', value: tx.type === 'INCOME' ? '🟢 INCOME' : '🔴 EXPENSE', inline: true },
          { name: 'Amount', value: `**${tx.type === 'INCOME' ? '+' : '-'}${formatUSD(parsed.amount)}**`, inline: true },
          { name: 'New Balance', value: `**${formatUSD(currentBalance)}**`, inline: true },
          { name: 'Reason', value: tx.reason, inline: false },
          { name: 'Logged By', value: `<@${message.author.id}>`, inline: true }
        ).setFooter({ text: 'Finance Tracker Bot' }).setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`undo_${tx.tx_id}`).setLabel('Undo').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`pdf_${tx.tx_id}`).setLabel('📄 Download PDF').setStyle(ButtonStyle.Primary)
      );

      const logChannelId = db.getConfig('transactionlog_channel');
      if (logChannelId) {
        const logChannel = await message.client.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          await logChannel.send({ embeds: [embed], components: [row] });
        } else {
          await message.channel.send({ embeds: [embed], components: [row] });
        }
      } else {
        await message.channel.send({ embeds: [embed], components: [row] });
      }

      const previousBalance = currentBalance - (tx.type === 'INCOME' ? tx.amount : -tx.amount);
      await NotificationService.dispatchAuditLog('ADDED', tx, previousBalance);
      await NotificationService.refreshDashboard();

    } catch (error) {
      logger.error('Error processing transaction message:', error);
      const embed = new EmbedBuilder().setColor('#FF0000').setTitle('❌ Transaction Failed').setDescription(error.message || 'An unknown error occurred while saving the transaction.');
      const reply = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 15000);
    }
  }
};
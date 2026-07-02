import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { parseTransactionMessage, formatINR, formatUSD } from '../utils/currency.js';
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

    try {
      const tx = await TransactionService.createTransaction({
        messageId: message.id,
        userId: message.author.id,
        username: message.author.username,
        type: parsed.type,
        originalAmount: parsed.amount,
        originalCurrency: parsed.currency,
        reason: parsed.reason
      });

      const { EmbedBuilder } = await import('discord.js');
      const exchangeRate = parseFloat(db.getConfig('exchange_rate', '82.00'));
      
      const currentBalanceInr = tx.balance_after;
      const currentBalanceUsd = currentBalanceInr / exchangeRate;

      const embed = new EmbedBuilder()
        .setColor(tx.type === 'INCOME' ? '#00FF00' : '#FF0000')
        .setTitle(`✅ ${tx.type === 'INCOME' ? 'Income' : 'Expense'} Recorded`)
        .setDescription(`**Amount:** ${tx.type === 'INCOME' ? '+' : '-'}${parsed.currency === 'USD' ? formatUSD(parsed.amount) : formatINR(parsed.amount)}\n**Converted:** ${formatINR(tx.converted_inr)}\n**Reason:** ${tx.reason}\n\n**Current Balance**\n${formatINR(currentBalanceInr)}\n${formatUSD(currentBalanceUsd)}`)
        .setFooter({ text: `TX ID: ${tx.tx_id} | Logged by ${message.author.username}` });

      await message.react('✅').catch(() => {});

      const logChannelId = db.getConfig('transactionlog_channel');
      if (logChannelId) {
        const logChannel = await message.client.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          await logChannel.send({ embeds: [embed] });
        } else {
          const reply = await message.reply({ embeds: [embed] });
          setTimeout(() => reply.delete().catch(() => {}), 15000);
        }
      } else {
        const reply = await message.reply({ embeds: [embed] });
        setTimeout(() => reply.delete().catch(() => {}), 15000);
      }

      const previousBalanceInr = currentBalanceInr - tx.converted_inr;
      await NotificationService.dispatchAuditLog('ADDED', tx, previousBalanceInr);
      await NotificationService.refreshDashboard();

    } catch (error) {
      logger.error('Error processing transaction message:', error);
      
      const errorEmbed = (await import('discord.js')).EmbedBuilder;
      const embed = new errorEmbed()
        .setColor('#FF0000')
        .setTitle('❌ Transaction Failed')
        .setDescription(error.message || 'An unknown error occurred while saving the transaction.');
        
      const reply = await message.reply({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 10000);
    }
  }
};
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

    // Check if this is the transaction channel
    const txChannelId = db.prepare("SELECT value FROM configuration WHERE key = 'transaction_channel'").get()?.value;
    if (!txChannelId || message.channel.id !== txChannelId) return;

    const parsed = parseTransactionMessage(message.content);
    if (!parsed) return; // Not a valid transaction message, ignore it

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

      // Send the beautiful auto-deleting confirmation embed
      const { EmbedBuilder } = await import('discord.js');
      const exchangeRate = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'exchange_rate'").get()?.value || '82.00');
      
      // We know tx contains the new balance_after. Convert to USD as well.
      const currentBalanceInr = tx.balance_after;
      const currentBalanceUsd = currentBalanceInr / exchangeRate;

      const embed = new EmbedBuilder()
        .setColor(tx.type === 'INCOME' ? '#00FF00' : '#FF0000')
        .setTitle(`✅ ${tx.type === 'INCOME' ? 'Income' : 'Expense'} Recorded`)
        .setDescription(`
**Amount:** ${tx.type === 'INCOME' ? '+' : '-'}${parsed.currency === 'USD' ? formatUSD(parsed.amount) : formatINR(parsed.amount)}
**Converted:** ${formatINR(tx.converted_inr)}
**Reason:** ${tx.reason}
━━━━━━━━━━━━━━━━━━━━━━
**Current Balance**
${formatINR(currentBalanceInr)}
${formatUSD(currentBalanceUsd)}
        `)
        .setFooter({ text: `TX ID: ${tx.tx_id}` });

      const reply = await message.reply({ embeds: [embed] });
      
      setTimeout(() => reply.delete().catch(() => {}), 8000);

      // Trigger Dashboard & Audit Log updates
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
      setTimeout(() => reply.delete().catch(() => {}), 8000);
    }
  }
};
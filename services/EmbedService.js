import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/db.js';
import { formatINR, formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

class EmbedService {
  /**
   * Generates the main Balance Dashboard embed.
   * 
   * @returns {EmbedBuilder}
   */
  generateDashboardEmbed() {
    const exchangeRate = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'exchange_rate'").get()?.value || '82.00');
    const balanceInr = parseFloat(db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get()?.value || '0');
    const balanceUsd = balanceInr / exchangeRate;
    
    // Calculate today's activity
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();
    
    const todaysTransactions = db.prepare('SELECT type, converted_inr FROM transactions WHERE is_deleted = 0 AND timestamp >= ?').all(startTimestamp);
    let todayIncome = 0;
    let todayExpense = 0;
    
    for (const tx of todaysTransactions) {
      if (tx.type === 'INCOME') todayIncome += tx.converted_inr;
      else todayExpense += tx.converted_inr;
    }

    // Get total transactions count
    const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE is_deleted = 0').get().count;
    
    // Get last transaction
    const lastTx = db.prepare('SELECT * FROM transactions WHERE is_deleted = 0 ORDER BY id DESC LIMIT 1').get();
    let lastTxString = 'No transactions yet.';
    if (lastTx) {
      const sign = lastTx.type === 'INCOME' ? '+' : '-';
      const formattedAmount = lastTx.original_currency === 'USD' ? formatUSD(lastTx.original_amount) : formatINR(lastTx.original_amount);
      lastTxString = `${sign}${formattedAmount}\n${lastTx.reason}`;
    }

    const embed = new EmbedBuilder()
      .setColor('#2F3136')
      .setTitle('💰 Finance Dashboard')
      .setDescription(`━━━━━━━━━━━━━━━━━━━━━━━\n**Current Balance**\n${formatINR(balanceInr)}\n${formatUSD(balanceUsd)}\n━━━━━━━━━━━━━━━━━━━━━━━\n📈 **Today's Income**\n${formatINR(todayIncome)}\n📉 **Today's Expenses**\n${formatINR(todayExpense)}\n━━━━━━━━━━━━━━━━━━━━━━━\n💱 **Exchange Rate**\n$1 = ${formatINR(exchangeRate)}\n━━━━━━━━━━━━━━━━━━━━━━━\n🕒 **Last Transaction**\n${lastTxString}\n━━━━━━━━━━━━━━━━━━━━━━━`)
      .setFooter({ text: `Finance Tracker v1.0.0 | ${txCount} Transactions | Updated` })
      .setTimestamp(new Date());

    return embed;
  }

  /**
   * Generates the Audit Log embed for a transaction action.
   * 
   * @param {string} action - Action type ('ADDED', 'UPDATED', 'DELETED', 'RESTORED', 'UNDONE')
   * @param {Object} tx - The transaction object
   * @param {number} previousBalanceInr - The balance prior to this action
   * @returns {Object} { embeds: [EmbedBuilder], components: [ActionRowBuilder] }
   */
  generateAuditLog(action, tx, previousBalanceInr) {
    let color = '#5865F2'; // Blurple default
    let title = 'Transaction Audit';
    
    if (action === 'ADDED') {
      color = tx.type === 'INCOME' ? '#00FF00' : '#FF0000';
      title = `💰 Transaction Added`;
    } else if (action === 'DELETED' || action === 'UNDONE') {
      color = '#ED4245'; // Red
      title = `🗑️ Transaction ${action === 'UNDONE' ? 'Undone' : 'Deleted'}`;
    } else if (action === 'RESTORED') {
      color = '#57F287'; // Green
      title = `♻️ Transaction Restored`;
    } else if (action === 'UPDATED') {
      color = '#FEE75C'; // Yellow
      title = `✏️ Transaction Updated`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .addFields(
        { name: 'Transaction ID', value: tx.tx_id, inline: true },
        { name: 'User', value: `<@${tx.user_id}> (${tx.username})`, inline: true },
        { name: 'Type', value: tx.type, inline: true },
        { name: 'Original Amount', value: tx.original_currency === 'USD' ? formatUSD(tx.original_amount) : formatINR(tx.original_amount), inline: true },
        { name: 'Converted Amount', value: formatINR(tx.converted_inr), inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Previous Balance', value: formatINR(previousBalanceInr), inline: true },
        { name: 'New Balance', value: formatINR(tx.balance_after), inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Reason', value: tx.reason, inline: false }
      )
      .setTimestamp(tx.timestamp);

    const row = new ActionRowBuilder();
    
    if (action === 'ADDED' || action === 'RESTORED' || action === 'UPDATED') {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`undo_${tx.tx_id}`)
          .setLabel('Undo')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`view_${tx.tx_id}`)
          .setLabel('View details')
          .setStyle(ButtonStyle.Secondary)
      );
    } else if (action === 'DELETED' || action === 'UNDONE') {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`restore_${tx.tx_id}`)
          .setLabel('Restore')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`view_${tx.tx_id}`)
          .setLabel('View details')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    return { embeds: [embed], components: [row] };
  }
}

export default new EmbedService();
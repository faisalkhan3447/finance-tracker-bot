import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/db.js';
import { formatINR, formatUSD } from '../utils/currency.js';

class EmbedService {
  generateDashboardEmbed() {
    const exchangeRate = parseFloat(db.getConfig('exchange_rate', '82.00'));
    const balanceInr = parseFloat(db.getConfig('balance_inr', '0'));
    const balanceUsd = balanceInr / exchangeRate;
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();
    
    let todayIncome = 0;
    let todayExpense = 0;
    let txCount = 0;
    let lastTx = null;

    for (const tx of db.data.transactions) {
      if (tx.is_deleted === 0) {
        txCount++;
        lastTx = tx; 
        
        if (tx.timestamp >= startTimestamp) {
          if (tx.type === 'INCOME') todayIncome += tx.converted_inr;
          else todayExpense += tx.converted_inr;
        }
      }
    }

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

  generateAuditLog(action, tx, previousBalanceInr) {
    let color = '#5865F2'; 
    let title = 'Transaction Audit';
    
    if (action === 'ADDED') {
      color = tx.type === 'INCOME' ? '#00FF00' : '#FF0000';
      title = `💰 Transaction Added`;
    } else if (action === 'DELETED' || action === 'UNDONE') {
      color = '#ED4245'; 
      title = `🗑️ Transaction ${action === 'UNDONE' ? 'Undone' : 'Deleted'}`;
    } else if (action === 'RESTORED') {
      color = '#57F287'; 
      title = `♻️ Transaction Restored`;
    } else if (action === 'UPDATED') {
      color = '#FEE75C'; 
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
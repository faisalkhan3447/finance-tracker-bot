import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/db.js';
import { formatUSD } from '../utils/currency.js';

class EmbedService {
  _renderProgressBar(value, max, length = 10) {
    if (max <= 0) return '';
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const filledLength = Math.round((length * percent) / 100);
    const emptyLength = length - filledLength;
    return `${'🟩'.repeat(filledLength)}${'⬛'.repeat(emptyLength)} **${percent.toFixed(1)}%**`;
  }

  _generateSparklineUrl(transactions) {
    const last30 = transactions.filter(t => t.is_deleted === 0).sort((a, b) => a.timestamp - b.timestamp).slice(-30);
    if (last30.length < 2) return null;
    const data = last30.map(t => t.balance_after);
    const config = { type: 'sparkline', data: { datasets: [{ data, borderColor: '#5865F2', fill: true, backgroundColor: 'rgba(88, 101, 242, 0.1)', borderWidth: 2 }] }, options: { legend: { display: false }, elements: { point: { radius: 0 } } } };
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&bkg=transparent&w=300&h=100`;
  }

  generateDashboardEmbed() {
    const balance = parseFloat(db.getConfig('balance', '0'));
    const goalTarget = parseFloat(db.getConfig('goal', '0'));
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0); const startOfMonthTs = startOfMonth.getTime();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0); const startOfDayTs = startOfDay.getTime();
    
    let todayIncome = 0; let todayExpense = 0; let monthIncome = 0; let txCount = 0; let lastTx = null;
    for (const tx of db.data.transactions) {
      if (tx.is_deleted === 0) {
        txCount++; lastTx = tx; 
        if (tx.timestamp >= startOfDayTs) { if (tx.type === 'INCOME') todayIncome += tx.amount; else todayExpense += tx.amount; }
        if (tx.timestamp >= startOfMonthTs && tx.type === 'INCOME') monthIncome += tx.amount;
      }
    }
    
    let lastTxString = '*No transactions logged yet.*';
    if (lastTx) { 
      const sign = lastTx.type === 'INCOME' ? '+' : '-'; 
      lastTxString = `**${sign}${formatUSD(lastTx.amount)}** — ${lastTx.reason}`; 
    }
    
    let goalDisplay = '*Not configured. Use `/goal set`*';
    if (goalTarget > 0) {
      const progressBar = this._renderProgressBar(monthIncome, goalTarget);
      goalDisplay = `${formatUSD(monthIncome)} / ${formatUSD(goalTarget)}\n${progressBar}`;
    }

    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('🏦 Financial Overview')
      .setDescription('*Live synchronized financial tracking.*')
      .addFields(
        { name: '💵 Current Balance', value: `\`\`\`diff\n${balance >= 0 ? '+' : '-'}${formatUSD(Math.abs(balance))}\n\`\`\``, inline: true },
        { name: '🎯 Monthly Income Goal', value: goalDisplay, inline: true },
        { name: '\u200b', value: '\u200b', inline: false },
        { name: '🟩 Today\'s Income', value: `**${formatUSD(todayIncome)}**`, inline: true },
        { name: '🟥 Today\'s Expenses', value: `**${formatUSD(todayExpense)}**`, inline: true },
        { name: '\u200b', value: '\u200b', inline: false },
        { name: '🕒 Latest Activity', value: lastTxString, inline: false }
      )
      .setFooter({ text: `Finance Bot v2.0 | Total TX: ${txCount}` })
      .setTimestamp(new Date());

    const sparklineUrl = this._generateSparklineUrl(db.data.transactions);
    if (sparklineUrl) embed.setImage(sparklineUrl);
    
    return embed;
  }

  generateAuditLog(action, tx, previousBalance) {
    let color = '#2b2d31'; let title = 'Transaction Audit';
    if (action === 'ADDED') { color = tx.type === 'INCOME' ? '#57F287' : '#ED4245'; title = `💰 New Transaction`; } 
    else if (action === 'DELETED' || action === 'UNDONE') { color = '#ED4245'; title = `🗑️ Transaction ${action === 'UNDONE' ? 'Undone' : 'Deleted'}`; } 
    else if (action === 'RESTORED') { color = '#57F287'; title = `♻️ Transaction Restored`; } 
    else if (action === 'UPDATED') { color = '#FEE75C'; title = `✏️ Transaction Updated`; }
    
    const embed = new EmbedBuilder().setColor(color).setTitle(title)
      .addFields(
        { name: 'Receipt ID', value: `\`${tx.tx_id}\``, inline: true }, 
        { name: 'User', value: `<@${tx.user_id}>`, inline: true }, 
        { name: 'Type', value: tx.type === 'INCOME' ? '🟩 INCOME' : '🟥 EXPENSE', inline: true },
        { name: 'Amount', value: `**${formatUSD(tx.amount)}**`, inline: true }, 
        { name: 'Previous Balance', value: formatUSD(previousBalance), inline: true }, 
        { name: 'New Balance', value: `**${formatUSD(tx.balance_after)}**`, inline: true },
        { name: 'Reason', value: `*${tx.reason}*`, inline: false }
      ).setTimestamp(tx.timestamp);
      
    const row = new ActionRowBuilder();
    if (action === 'ADDED' || action === 'RESTORED' || action === 'UPDATED') {
      row.addComponents(
        new ButtonBuilder().setCustomId(`undo_${tx.tx_id}`).setLabel('Undo').setStyle(ButtonStyle.Danger), 
        new ButtonBuilder().setCustomId(`pdf_${tx.tx_id}`).setLabel('📄 Download PDF').setStyle(ButtonStyle.Secondary)
      );
    } else if (action === 'DELETED' || action === 'UNDONE') {
      row.addComponents(
        new ButtonBuilder().setCustomId(`restore_${tx.tx_id}`).setLabel('Restore').setStyle(ButtonStyle.Success)
      );
    }
    return { embeds: [embed], components: [row] };
  }

  generateMilestoneAnnouncement(milestone, monthIncome, goalTarget) {
    const progressBar = this._renderProgressBar(monthIncome, goalTarget);
    return new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Goal Milestone Reached!')
      .setDescription(`Congratulations! We just crossed **${milestone}0%** of our monthly income goal! 🎉`)
      .addFields(
        { name: 'Current Progress', value: `${formatUSD(monthIncome)} / ${formatUSD(goalTarget)}\n${progressBar}`, inline: false }
      )
      .setImage('https://i.imgur.com/8z3vQ8C.gif')
      .setTimestamp();
  }

  generateHighValueAnnouncement(tx) {
    return new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🚀 Massive Income Alert!')
      .setDescription(`A high-value transaction was just logged!`)
      .addFields(
        { name: 'Amount', value: `**+${formatUSD(tx.amount)}**`, inline: true },
        { name: 'Reason', value: `*${tx.reason}*`, inline: true },
        { name: 'Logged By', value: `<@${tx.user_id}>`, inline: true }
      )
      .setTimestamp(tx.timestamp);
  }
}

export default new EmbedService();
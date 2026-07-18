import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/db.js';
import { formatUSD } from '../utils/currency.js';

class EmbedService {
  _renderProgressBar(value, max, length = 12) {
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

  generateDashboardMessage() {
    const balance = parseFloat(db.getConfig('balance', '0'));
    const goalTarget = parseFloat(db.getConfig('goal', '0'));
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0); const startOfDayTs = startOfDay.getTime();
    
    let todayIncome = 0; let todayExpense = 0; let currentMonthIncome = 0;
    let txCount = 0; let lastTx = null;

    for (const tx of db.data.transactions) {
      if (tx.is_deleted === 0) {
        txCount++; lastTx = tx; 
        if (tx.timestamp >= startOfDayTs) { 
          if (tx.type === 'INCOME') todayIncome += tx.amount; 
          else todayExpense += tx.amount; 
        }
        if (tx.timestamp >= startOfMonth) {
          if (tx.type === 'INCOME') currentMonthIncome += tx.amount;
        }
      }
    }
    
    let lastTxString = '*No transactions logged yet.*';
    if (lastTx) { 
      const sign = lastTx.type === 'INCOME' ? '+' : '-'; 
      lastTxString = `**${sign}${formatUSD(lastTx.amount)}** — ${lastTx.reason}`; 
    }
    
    let goalDisplay = '*Not configured. Use `/goal set`*';
    if (goalTarget > 0) {
      const progressBar = this._renderProgressBar(currentMonthIncome, goalTarget);
      goalDisplay = `${formatUSD(currentMonthIncome)} / ${formatUSD(goalTarget)}\n${progressBar}`;
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
      .setTimestamp(now);

    const chartUrl = this._generateSparklineUrl(db.data.transactions);
    if (chartUrl) embed.setImage(chartUrl);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('stats_current_month').setLabel('📅 Current Month').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('stats_past_month').setLabel('⏪ Last Month').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }

  generateMonthStatsEmbed(monthOffset = 0) {
    const goalTarget = parseFloat(db.getConfig('goal', '0'));
    const now = new Date();
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const startTs = startOfMonth.getTime();
    
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    const endTs = endOfMonth.getTime();

    let income = 0; let expense = 0;
    for (const tx of db.data.transactions) {
      if (tx.is_deleted === 0 && tx.timestamp >= startTs && tx.timestamp <= endTs) {
        if (tx.type === 'INCOME') income += tx.amount;
        else expense += tx.amount;
      }
    }

    const monthName = startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    let percentStr = '';
    if (goalTarget > 0) {
      const p = ((income / goalTarget) * 100).toFixed(1);
      percentStr = `\n**Goal Completed:** ${p}%`;
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`📊 Monthly Statistics: ${monthName}`)
      .setDescription(`Detailed breakdown of your finances for ${monthName}.`)
      .addFields(
        { name: '🟩 Total Income', value: `**${formatUSD(income)}**`, inline: true },
        { name: '🟥 Total Spend', value: `**${formatUSD(expense)}**`, inline: true },
        { name: '💰 Net Profit', value: `**${formatUSD(income - expense)}**${percentStr}`, inline: false }
      )
      .setTimestamp();
      
    return embed;
  }

  generateAuditLog(action, tx, previousBalance) {
    let color = '#2b2d31'; let title = 'Receipt';
    let icon = '🧾';
    if (action === 'ADDED') { color = tx.type === 'INCOME' ? '#57F287' : '#ED4245'; icon = tx.type === 'INCOME' ? '🟩' : '🟥'; } 
    else if (action === 'DELETED' || action === 'UNDONE') { color = '#ED4245'; title = 'Transaction Undone'; icon = '🗑️'; } 
    else if (action === 'RESTORED') { color = '#57F287'; title = 'Transaction Restored'; icon = '♻️'; } 
    else if (action === 'UPDATED') { color = '#FEE75C'; title = 'Transaction Updated'; icon = '✏️'; }
    
    const embed = new EmbedBuilder().setColor(color).setTitle(`${icon} ${title}: ${tx.tx_id}`)
      .setDescription(`**Amount:** ${tx.type === 'INCOME' ? '+' : '-'}${formatUSD(tx.amount)}\n**Reason:** ${tx.reason}`)
      .addFields(
        { name: 'User', value: `<@${tx.user_id}>`, inline: true }, 
        { name: 'Previous Balance', value: formatUSD(previousBalance), inline: true }, 
        { name: 'New Balance', value: `**${formatUSD(tx.balance_after)}**`, inline: true }
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
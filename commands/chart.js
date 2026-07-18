import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('Generate a visual chart of your recent balance history')
    .addIntegerOption(option => option.setName('days').setDescription('Number of days to show (default: 30)').setMinValue(7).setMaxValue(90)),
  async execute(interaction) {
    try {
      await interaction.deferReply();
      const days = interaction.options.getInteger('days') || 30;
      const msPerDay = 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - (days * msPerDay);
      
      const transactions = db.data.transactions.filter(t => t.is_deleted === 0 && t.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
      if (transactions.length < 2) return interaction.editReply(`Not enough transactions in the last ${days} days to generate a chart.`);

      const labels = transactions.map(t => { const d = new Date(t.timestamp); return `${d.getMonth() + 1}/${d.getDate()}`; });
      const data = transactions.map(t => t.balance_after);

      const config = { type: 'line', data: { labels: labels, datasets: [{ label: 'Balance (USD)', data: data, borderColor: 'rgb(88, 101, 242)', backgroundColor: 'rgba(88, 101, 242, 0.1)', fill: true, tension: 0.4 }] }, options: { title: { display: true, text: `Balance History (Last ${days} days)` } } };
      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&w=600&h=300`;

      const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📈 Financial History Chart').setImage(chartUrl).setFooter({ text: `Showing last ${transactions.length} transactions` });
      await interaction.editReply({ embeds: [embed] });
    } catch (error) { logger.error('Error executing /chart:', error); await interaction.editReply(`Failed to generate chart: ${error.message}`); }
  }
};
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('Generate a premium visual chart of your recent balance history')
    .addIntegerOption(option => 
      option.setName('days')
        .setDescription('Number of days to show (default: 30)')
        .setMinValue(7)
        .setMaxValue(90)
    ),
        
  async execute(interaction) {
    try {
      await interaction.deferReply();
      const days = interaction.options.getInteger('days') || 30;
      
      const msPerDay = 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - (days * msPerDay);
      
      const transactions = db.data.transactions
        .filter(t => t.is_deleted === 0 && t.timestamp >= cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (transactions.length < 2) {
        return interaction.editReply(`Not enough transactions in the last ${days} days to generate a chart.`);
      }

      const labels = transactions.map(t => {
        const d = new Date(t.timestamp);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });
      const data = transactions.map(t => t.balance_after);

      // Premium Chart Configuration
      const config = {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Balance (USD)',
            data: data,
            borderColor: '#5865F2', // Discord Blurple
            backgroundColor: 'rgba(88, 101, 242, 0.15)', // Light fill
            borderWidth: 3,
            fill: true,
            tension: 0.4, // Smooth bezier curve
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#5865F2',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          legend: { display: false },
          title: { 
            display: true, 
            text: `Balance History (Last ${days} Days)`, 
            fontColor: '#ffffff', 
            fontSize: 18, 
            fontFamily: 'Helvetica Neue' 
          },
          layout: { padding: 20 },
          scales: {
            xAxes: [{ 
              gridLines: { color: 'rgba(255, 255, 255, 0.1)', zeroLineColor: 'rgba(255, 255, 255, 0.2)' }, 
              ticks: { fontColor: '#a1a1aa', fontFamily: 'Helvetica Neue' } 
            }],
            yAxes: [{ 
              gridLines: { color: 'rgba(255, 255, 255, 0.1)', zeroLineColor: 'rgba(255, 255, 255, 0.2)' }, 
              ticks: { 
                fontColor: '#a1a1aa', 
                fontFamily: 'Helvetica Neue',
                callback: (value) => '$' + value
              } 
            }]
          }
        }
      };

      const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}&w=800&h=400&bkg=%232b2d31`;

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📈 Advanced Financial Chart')
        .setDescription(`A comprehensive overview of your net balance over the past **${days} days**.`)
        .setImage(chartUrl)
        .setFooter({ text: `Finance Bot v2.0 | Based on ${transactions.length} recent transactions` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error executing /chart:', error);
      await interaction.editReply(`Failed to generate chart: ${error.message}`);
    }
  }
};
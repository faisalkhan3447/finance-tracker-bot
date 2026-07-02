import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatINR, formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Quickly check the current running balance without disturbing the channel.'),
    
  async execute(interaction) {
    try {
      const exchangeRate = parseFloat(db.getConfig('exchange_rate', '82.00'));
      const balanceInr = parseFloat(db.getConfig('balance_inr', '0'));
      const balanceUsd = balanceInr / exchangeRate;

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('💰 Current Balance')
        .setDescription(`**INR:** ${formatINR(balanceInr)}\n**USD:** ${formatUSD(balanceUsd)}\n\n*Exchange Rate: $1 = ${formatINR(exchangeRate)}*`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error executing /balance command:', error);
      await interaction.reply({ content: 'Failed to retrieve balance.', ephemeral: true });
    }
  }
};
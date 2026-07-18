import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { formatUSD } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check the current bot balance'),
  async execute(interaction) {
    try {
      const balance = parseFloat(db.getConfig('balance', '0'));
      const embed = new EmbedBuilder().setColor(balance >= 0 ? '#00FF00' : '#FF0000').setTitle('💰 Current Balance').setDescription(`**${formatUSD(balance)}**`).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch (error) { logger.error('Error executing /balance:', error); await interaction.reply({ content: 'Failed to retrieve balance.', ephemeral: true }); }
  }
};
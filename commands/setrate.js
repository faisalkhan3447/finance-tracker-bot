import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import NotificationService from '../services/NotificationService.js';
import { formatINR } from '../utils/currency.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setrate')
    .setDescription('Update the USD to INR exchange rate')
    .setDefaultMemberPermissions(8)
    .addNumberOption(option => 
      option.setName('rate')
        .setDescription('The new exchange rate (e.g., 83.50)')
        .setRequired(true)),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const rate = interaction.options.getNumber('rate');
      
      if (rate <= 0) {
        return interaction.editReply('❌ Rate must be greater than zero.');
      }

      db.prepare('INSERT OR REPLACE INTO configuration (key, value) VALUES (?, ?)').run('exchange_rate', String(rate));
      
      await NotificationService.refreshDashboard();
      
      await interaction.editReply(`✅ Exchange rate updated to **$1 = ${formatINR(rate)}**.\n\n*Note: This only affects future transactions and the dashboard display. Past transactions retain their original converted value.*`);
    } catch (error) {
      logger.error('Error executing /setrate:', error);
      await interaction.editReply(`❌ Failed to set exchange rate.`);
    }
  }
};
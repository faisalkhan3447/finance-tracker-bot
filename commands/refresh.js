import { SlashCommandBuilder } from 'discord.js';
import NotificationService from '../services/NotificationService.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Force refresh the Balance Dashboard')
    .setDefaultMemberPermissions(8),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      await NotificationService.refreshDashboard();
      await interaction.editReply(`✅ Dashboard refreshed.`);
    } catch (error) {
      logger.error('Error executing /refresh:', error);
      await interaction.editReply(`❌ Failed to refresh dashboard: ${error.message}`);
    }
  }
};
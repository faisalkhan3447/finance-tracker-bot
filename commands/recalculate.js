import { SlashCommandBuilder } from 'discord.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('recalculate')
    .setDescription('Fully recalculates the running balance from transaction history')
    .setDefaultMemberPermissions(8),
        
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      await TransactionService.recalculateEverything();
      await NotificationService.refreshDashboard();
      
      await interaction.editReply(`✅ Successfully recalculated all balances and fixed any historical desynchronizations.`);
    } catch (error) {
      logger.error('Error executing /recalculate:', error);
      await interaction.editReply(`❌ Failed to recalculate: ${error.message}`);
    }
  }
};
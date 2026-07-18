import { SlashCommandBuilder } from 'discord.js';
import TransactionService from '../services/TransactionService.js';
import NotificationService from '../services/NotificationService.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('recalculate')
    .setDescription('Force recalculate all balances from the ground up')
    .setDefaultMemberPermissions(8),
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      await TransactionService.recalculateEverything();
      await NotificationService.refreshDashboard();
      await interaction.editReply('✅ Successfully recalculated all balances. Dashboard has been updated.');
    } catch (error) { logger.error('Error executing /recalculate:', error); const method = interaction.deferred ? 'editReply' : 'reply'; await interaction[method](`Failed to recalculate balances: ${error.message}`); }
  }
};
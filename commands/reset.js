import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';
import NotificationService from '../services/NotificationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('DANGER: Reset the entire database')
    .setDefaultMemberPermissions(8)
    .addStringOption(option => 
      option.setName('confirm')
        .setDescription('Type "CONFIRM" to proceed')
        .setRequired(true)),
        
  async execute(interaction) {
    try {
      const confirm = interaction.options.getString('confirm');
      
      if (confirm !== 'CONFIRM') {
        return interaction.reply({ content: '❌ You must type exactly "CONFIRM" to reset.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      db.data.transactions = [];
      db.setConfig('balance_inr', '0');
      db.save();

      await NotificationService.refreshDashboard();

      await interaction.editReply('✅ Database successfully reset.');
      logger.warn(`User ${interaction.user.tag} reset the database.`);
    } catch (error) {
      logger.error('Error executing /reset:', error);
      const reply = interaction.deferred ? 'editReply' : 'reply';
      await interaction[reply]({ content: 'Failed to reset database.', ephemeral: true });
    }
  }
};
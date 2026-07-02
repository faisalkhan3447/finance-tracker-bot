import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import NotificationService from '../services/NotificationService.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balancesetup')
    .setDescription('Set the current channel as the Balance Dashboard')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const channelId = interaction.channel.id;
      db.setConfig('balance_channel', channelId);
      db.setConfig('balance_message_id', ''); 
      
      await interaction.editReply(`✅ Set <#${channelId}> as the Balance Dashboard channel. Spawning embed...`);
      
      await NotificationService.refreshDashboard();

    } catch (error) {
      logger.error('Error executing /balancesetup:', error);
      await interaction.editReply('Failed to setup balance channel.');
    }
  }
};
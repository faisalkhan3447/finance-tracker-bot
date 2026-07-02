import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('auditsetup')
    .setDescription('Set the current channel as the Audit Log channel')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      const channelId = interaction.channel.id;
      db.setConfig('audit_channel', channelId);
      
      await interaction.reply({ content: `✅ Set <#${channelId}> as the Audit Log channel. All deleted, restored, and undone transactions will be logged here.`, ephemeral: true });

    } catch (error) {
      logger.error('Error executing /auditsetup:', error);
      await interaction.reply({ content: 'Failed to setup audit channel.', ephemeral: true });
    }
  }
};
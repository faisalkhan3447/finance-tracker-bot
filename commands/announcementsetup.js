import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('announcementsetup')
    .setDescription('Set the current channel to receive automated goal and milestone announcements')
    .setDefaultMemberPermissions(8),
        
  async execute(interaction) {
    try {
      db.setConfig('announcement_channel', interaction.channelId);
      await interaction.reply({ content: `✅ This channel (<#${interaction.channelId}>) has been set as the **Announcement** channel. All milestone celebrations and high-value alerts will be posted here!`, ephemeral: true });
    } catch (error) {
      logger.error('Error executing /announcementsetup:', error);
      await interaction.reply({ content: 'Failed to configure announcement channel.', ephemeral: true });
    }
  }
};
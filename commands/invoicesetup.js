import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('invoicesetup')
    .setDescription('Set the current channel to receive all PDF invoices')
    .setDefaultMemberPermissions(8),
        
  async execute(interaction) {
    try {
      db.setConfig('invoice_channel', interaction.channelId);
      await interaction.reply({ content: `✅ This channel (<#${interaction.channelId}>) has been set as the **Invoice / Receipt** channel. All PDF downloads will be sent here!`, ephemeral: true });
    } catch (error) {
      logger.error('Error executing /invoicesetup:', error);
      await interaction.reply({ content: 'Failed to configure invoice channel.', ephemeral: true });
    }
  }
};
import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('settransactionlog')
    .setDescription('Set the current channel as the Transaction Log channel for receipts')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      const channelId = interaction.channel.id;
      db.setConfig('transactionlog_channel', channelId);
      
      await interaction.reply({ content: `✅ Set <#${channelId}> as the Transaction Log channel. All receipts will be sent here instead of cluttering the transaction chat.`, ephemeral: true });

    } catch (error) {
      logger.error('Error executing /settransactionlog:', error);
      await interaction.reply({ content: 'Failed to setup transaction log channel.', ephemeral: true });
    }
  }
};
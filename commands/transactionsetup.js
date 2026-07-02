import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('transactionsetup')
    .setDescription('Set the current channel as the Transaction Logging channel')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      const channelId = interaction.channel.id;
      db.setConfig('transaction_channel', channelId);
      
      await interaction.reply({ content: `✅ Set <#${channelId}> as the Transaction Logging channel. I will now listen for financial messages here.`, ephemeral: true });

    } catch (error) {
      logger.error('Error executing /transactionsetup:', error);
      await interaction.reply({ content: 'Failed to setup transaction channel.', ephemeral: true });
    }
  }
};
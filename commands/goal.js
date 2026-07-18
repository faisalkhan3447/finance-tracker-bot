import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import NotificationService from '../services/NotificationService.js';
import { logger } from '../utils/logger.js';
import { formatUSD } from '../utils/currency.js';

export default {
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Configure your monthly income goal and announcement thresholds')
    .setDefaultMemberPermissions(8)
    .addSubcommand(subcommand => 
      subcommand.setName('set')
      .setDescription('Set the monthly income goal')
      .addNumberOption(option => option.setName('amount').setDescription('Target income amount in USD').setRequired(true))
    )
    .addSubcommand(subcommand => 
      subcommand.setName('threshold')
      .setDescription('Set the threshold for High Value Income announcements')
      .addNumberOption(option => option.setName('amount').setDescription('Amount in USD (e.g. 500)').setRequired(true))
    )
    .addSubcommand(subcommand => subcommand.setName('clear').setDescription('Remove the monthly goal')),
    
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'set') {
        const amount = interaction.options.getNumber('amount');
        if (amount <= 0) return interaction.reply({ content: 'Goal must be greater than 0.', ephemeral: true });
        db.setConfig('goal', String(amount));
        await NotificationService.refreshDashboard();
        return interaction.reply({ content: `✅ Monthly Income Goal successfully set to **${formatUSD(amount)}**. Progress bar will now track Income!`, ephemeral: true });
      } 
      else if (subcommand === 'threshold') {
        const amount = interaction.options.getNumber('amount');
        if (amount <= 0) return interaction.reply({ content: 'Threshold must be greater than 0.', ephemeral: true });
        db.setConfig('high_value_threshold', String(amount));
        return interaction.reply({ content: `✅ High Value Announcement threshold set to **${formatUSD(amount)}**. Any single income above this will trigger a special announcement!`, ephemeral: true });
      }
      else if (subcommand === 'clear') {
        db.setConfig('goal', '0');
        await NotificationService.refreshDashboard();
        return interaction.reply({ content: '✅ Monthly goal cleared.', ephemeral: true });
      }
    } catch (error) { 
      logger.error('Error executing /goal:', error); 
      await interaction.reply({ content: `Failed to update goal: ${error.message}`, ephemeral: true }); 
    }
  }
};
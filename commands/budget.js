import { SlashCommandBuilder } from 'discord.js';
import db from '../database/db.js';
import NotificationService from '../services/NotificationService.js';
import { logger } from '../utils/logger.js';
import { formatUSD } from '../utils/currency.js';

export default {
  data: new SlashCommandBuilder()
    .setName('budget')
    .setDescription('Configure a monthly budget or spending limit')
    .setDefaultMemberPermissions(8)
    .addSubcommand(subcommand => subcommand.setName('set').setDescription('Set the monthly budget limit').addNumberOption(option => option.setName('amount').setDescription('Budget amount in USD').setRequired(true)))
    .addSubcommand(subcommand => subcommand.setName('clear').setDescription('Remove the monthly budget limit')),
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'set') {
        const amount = interaction.options.getNumber('amount');
        if (amount < 0) return interaction.reply({ content: 'Budget cannot be negative.', ephemeral: true });
        db.setConfig('budget', String(amount));
        await NotificationService.refreshDashboard();
        return interaction.reply({ content: `✅ Monthly budget successfully set to **${formatUSD(amount)}**. Check the dashboard!`, ephemeral: true });
      } else if (subcommand === 'clear') {
        db.setConfig('budget', '0');
        await NotificationService.refreshDashboard();
        return interaction.reply({ content: '✅ Monthly budget cleared.', ephemeral: true });
      }
    } catch (error) { logger.error('Error executing /budget:', error); await interaction.reply({ content: `Failed to update budget: ${error.message}`, ephemeral: true }); }
  }
};
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setrate')
    .setDescription('DEPRECATED: Bot now natively uses USD.')
    .setDefaultMemberPermissions(8),
  async execute(interaction) {
    await interaction.reply({ content: 'Currency conversion has been removed. The bot natively uses USD now.', ephemeral: true });
  }
};
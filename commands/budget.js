import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('budget')
    .setDescription('DEPRECATED: Use /goal instead.')
    .setDefaultMemberPermissions(8),
        
  async execute(interaction) {
    await interaction.reply({ content: 'The budget system has been upgraded into an Income Goal system! Please use the `/goal` command instead.', ephemeral: true });
  }
};
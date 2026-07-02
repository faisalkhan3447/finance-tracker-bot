import { SlashCommandBuilder, ActionRowBuilder, ComponentType, RoleSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure allowed roles for the Finance Tracker bot')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('setup_roles')
        .setPlaceholder('Select allowed roles (optional)')
        .setMinValues(0)
        .setMaxValues(5);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚙️ Finance Bot Roles Setup')
        .setDescription('Optionally, select roles that are allowed to manage the bot using the dropdown below.');

      const row = new ActionRowBuilder().addComponents(roleSelect);

      const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

      const roleCollector = response.createMessageComponentCollector({ componentType: ComponentType.RoleSelect, time: 60000 });
      
      roleCollector.on('collect', async i => {
        const selectedRoles = i.values;
        db.setConfig('allowed_roles', JSON.stringify(selectedRoles));
        await i.reply({ content: `✅ Successfully registered ${selectedRoles.length} allowed roles.`, ephemeral: true });
      });

    } catch (error) {
      logger.error('Error executing /setup:', error);
      await interaction.reply({ content: 'Failed to start setup.', ephemeral: true });
    }
  }
};
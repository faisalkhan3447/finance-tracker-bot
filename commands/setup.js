import { SlashCommandBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ComponentType, RoleSelectMenuBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';
import NotificationService from '../services/NotificationService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Interactive setup for the Finance Tracker bot')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('setup_channels')
        .setPlaceholder('Select channels (Transaction, Balance, Audit)')
        .setMinValues(3)
        .setMaxValues(3)
        .setChannelTypes(ChannelType.GuildText);

      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('setup_roles')
        .setPlaceholder('Select allowed roles (optional)')
        .setMinValues(0)
        .setMaxValues(5);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚙️ Finance Bot Setup')
        .setDescription('Please select exactly **3 text channels** in the menu below. The first channel will be for **Transactions**, the second for the **Balance Dashboard**, and the third for **Audit Logs**.\n\nOptionally, select roles that are allowed to manage the bot.');

      const row1 = new ActionRowBuilder().addComponents(channelSelect);
      const row2 = new ActionRowBuilder().addComponents(roleSelect);

      const response = await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        ephemeral: true
      });

      const collector = response.createMessageComponentCollector({ componentType: ComponentType.ChannelSelect, time: 60000 });
      const roleCollector = response.createMessageComponentCollector({ componentType: ComponentType.RoleSelect, time: 60000 });
      
      let selectedChannels = [];
      let selectedRoles = [];

      roleCollector.on('collect', async i => {
        selectedRoles = i.values;
        await i.reply({ content: `✅ Registered ${selectedRoles.length} allowed roles.`, ephemeral: true });
      });

      collector.on('collect', async i => {
        selectedChannels = i.values;

        db.setConfig('transaction_channel', selectedChannels[0]);
        db.setConfig('balance_channel', selectedChannels[1]);
        db.setConfig('audit_channel', selectedChannels[2]);
        db.setConfig('allowed_roles', JSON.stringify(selectedRoles));
        
        await i.reply({ 
          content: `✅ Setup complete!\nTransactions: <#${selectedChannels[0]}>\nDashboard: <#${selectedChannels[1]}>\nAudit: <#${selectedChannels[2]}>`,
          ephemeral: true 
        });

        await NotificationService.refreshDashboard();
      });

    } catch (error) {
      logger.error('Error executing /setup:', error);
      await interaction.reply({ content: 'Failed to start setup.', ephemeral: true });
    }
  }
};
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View the current bot configuration')
    .setDefaultMemberPermissions(8),
    
  async execute(interaction) {
    try {
      const getCfg = (key, def) => db.prepare("SELECT value FROM configuration WHERE key = ?").get(key)?.value || def;

      const txChannel = getCfg('transaction_channel', 'Not Set');
      const balChannel = getCfg('balance_channel', 'Not Set');
      const audChannel = getCfg('audit_channel', 'Not Set');
      const rate = getCfg('exchange_rate', '82.00');
      const allowNeg = getCfg('allow_negative_balance', 'false');
      
      let rolesStr = 'Everyone';
      try {
        const roles = JSON.parse(getCfg('allowed_roles', '[]'));
        if (roles.length > 0) rolesStr = roles.map(r => `<@&${r}>`).join(', ');
      } catch(e) {}

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('⚙️ Current Configuration')
        .addFields(
          { name: 'Exchange Rate', value: `₹${rate}`, inline: true },
          { name: 'Allow Negative Balance', value: allowNeg === 'true' ? '✅ True' : '❌ False', inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: 'Transaction Channel', value: txChannel !== 'Not Set' ? `<#${txChannel}>` : 'Not Set', inline: true },
          { name: 'Balance Dashboard Channel', value: balChannel !== 'Not Set' ? `<#${balChannel}>` : 'Not Set', inline: true },
          { name: 'Audit Log Channel', value: audChannel !== 'Not Set' ? `<#${audChannel}>` : 'Not Set', inline: true },
          { name: 'Allowed Roles', value: rolesStr, inline: false },
          { name: 'Backups', value: '✅ Enabled (Daily/Weekly/Monthly)', inline: false }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error executing /config:', error);
      await interaction.reply({ content: 'Failed to retrieve configuration.', ephemeral: true });
    }
  }
};
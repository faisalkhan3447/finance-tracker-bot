import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database/db.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export default {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('View system and bot info')
    .setDefaultMemberPermissions(8),
        
  async execute(interaction) {
    try {
      const dbPath = path.join(process.cwd(), 'database', 'data.json');
      let dbSizeStr = 'Unknown';
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbSizeStr = (stats.size / 1024 / 1024).toFixed(2) + ' MB';
      }

      const txCount = db.data.transactions.length;
      const deletedCount = db.data.transactions.filter(t => t.is_deleted === 1).length;
      
      const uptime = process.uptime();
      const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('🤖 System Info')
        .addFields(
          { name: 'Bot Uptime', value: uptimeStr, inline: true },
          { name: 'Database Size', value: dbSizeStr, inline: true },
          { name: 'Total Transactions', value: String(txCount), inline: true },
          { name: 'Deleted Transactions', value: String(deletedCount), inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error executing /info:', error);
      await interaction.reply({ content: 'Failed to retrieve info.', ephemeral: true });
    }
  }
};
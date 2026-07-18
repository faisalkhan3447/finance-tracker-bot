import { Client, TextChannel } from 'discord.js';
import db from '../database/db.js';
import EmbedService from './EmbedService.js';
import { logger } from '../utils/logger.js';

class NotificationService {
  constructor() { this.client = null; }
  setClient(client) { this.client = client; }

  async refreshDashboard() {
    if (!this.client) return;
    try {
      const channelId = db.getConfig('balance_channel');
      if (!channelId) return;
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const embed = EmbedService.generateDashboardEmbed();
      const existingMessageId = db.getConfig('balance_message_id');
      let messageUpdated = false;

      if (existingMessageId) {
        try {
          const existingMessage = await channel.messages.fetch(existingMessageId);
          await existingMessage.edit({ embeds: [embed] });
          messageUpdated = true;
        } catch (error) { logger.warn(`Could not edit dashboard message. Creating new one.`); }
      }

      if (!messageUpdated) {
        const newMessage = await channel.send({ embeds: [embed] });
        db.setConfig('balance_message_id', newMessage.id);
      }
    } catch (error) { logger.error('Failed to refresh dashboard:', error); }
  }

  async dispatchAuditLog(action, tx, previousBalance) {
    if (!this.client) return;
    try {
      const channelId = db.getConfig('audit_channel');
      if (!channelId) return;
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;
      const { embeds, components } = EmbedService.generateAuditLog(action, tx, previousBalance);
      await channel.send({ embeds, components });
    } catch (error) { logger.error(`Failed to dispatch audit log for TX ${tx?.tx_id}:`, error); }
  }
}
export default new NotificationService();
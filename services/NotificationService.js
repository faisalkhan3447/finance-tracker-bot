import { Client, TextChannel } from 'discord.js';
import db from '../database/db.js';
import EmbedService from './EmbedService.js';
import { logger } from '../utils/logger.js';

class NotificationService {
  constructor() {
    /** @type {Client|null} */
    this.client = null;
  }

  setClient(client) {
    this.client = client;
  }

  /**
   * Refreshes the Balance Dashboard message in the configured balance channel.
   * If the message was deleted or cannot be edited, a new one is created.
   * 
   * @returns {Promise<void>}
   */
  async refreshDashboard() {
    if (!this.client) return;

    try {
      const channelId = db.prepare("SELECT value FROM configuration WHERE key = 'balance_channel'").get()?.value;
      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const embed = EmbedService.generateDashboardEmbed();
      const existingMessageId = db.prepare("SELECT value FROM configuration WHERE key = 'balance_message_id'").get()?.value;

      let messageUpdated = false;

      if (existingMessageId) {
        try {
          const existingMessage = await channel.messages.fetch(existingMessageId);
          await existingMessage.edit({ embeds: [embed] });
          messageUpdated = true;
        } catch (error) {
          logger.warn(`Could not edit dashboard message (maybe deleted). Creating new one.`);
        }
      }

      if (!messageUpdated) {
        const newMessage = await channel.send({ embeds: [embed] });
        db.prepare('INSERT OR REPLACE INTO configuration (key, value) VALUES (?, ?)').run('balance_message_id', newMessage.id);
      }
    } catch (error) {
      logger.error('Failed to refresh dashboard:', error);
    }
  }

  /**
   * Sends an Audit Log for a transaction action.
   * 
   * @param {string} action - 'ADDED', 'UPDATED', 'DELETED', 'RESTORED', 'UNDONE'
   * @param {Object} tx - The transaction object from DB
   * @param {number} previousBalanceInr - The balance prior to this action
   * @returns {Promise<void>}
   */
  async dispatchAuditLog(action, tx, previousBalanceInr) {
    if (!this.client) return;

    try {
      const channelId = db.prepare("SELECT value FROM configuration WHERE key = 'audit_channel'").get()?.value;
      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel || !(channel instanceof TextChannel)) return;

      const { embeds, components } = EmbedService.generateAuditLog(action, tx, previousBalanceInr);
      
      await channel.send({ embeds, components });
    } catch (error) {
      logger.error(`Failed to dispatch audit log for TX ${tx?.tx_id}:`, error);
    }
  }
}

export default new NotificationService();
import { Events, ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';
import db from '../database/db.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Ready! Logged in as ${client.user.tag}`);
    
    const NotificationService = (await import('../services/NotificationService.js')).default;
    NotificationService.setClient(client);

    const updateStatus = async () => {
      try {
        const balance = parseFloat(db.getConfig('balance', '0'));
        const txCount = db.data.transactions.filter(t => t.is_deleted === 0).length;
        const { formatUSD } = await import('../utils/currency.js');
        
        client.user.setActivity(`Watching ${formatUSD(balance)} | ${txCount} Txns`, { type: ActivityType.Custom });
      } catch (err) {
        logger.error('Failed to update status:', err);
      }
    };

    await updateStatus();
    setInterval(updateStatus, 5 * 60 * 1000); 
  }
};
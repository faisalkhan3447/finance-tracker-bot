import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import db from '../database/db.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Ready! Logged in as ${client.user.tag}`);
    
    setInterval(async () => {
      try {
        const txCount = db.data.transactions.filter(t => t.is_deleted === 0).length;
        const balance = parseFloat(db.getConfig('balance_inr', '0'));
        
        const { formatINR } = await import('../utils/currency.js');
        
        client.user.setActivity(`Watching ${formatINR(balance)} | ${txCount} Txns`);
      } catch (error) {
        logger.error('Error updating presence:', error);
      }
    }, 60000);

    client.emit('updatePresence'); 
  }
};
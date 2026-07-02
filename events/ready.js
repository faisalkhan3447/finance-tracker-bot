import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Ready! Logged in as ${client.user.tag}`);
    
    // Set bot presence
    setInterval(async () => {
      try {
        const db = (await import('../database/db.js')).default;
        const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE is_deleted = 0').get().count;
        const balanceRow = db.prepare("SELECT value FROM configuration WHERE key = 'balance_inr'").get();
        const balance = balanceRow ? parseFloat(balanceRow.value) : 0;
        
        const { formatINR } = await import('../utils/currency.js');
        
        client.user.setActivity(`Watching ${formatINR(balance)} | ${txCount} Txns`);
      } catch (error) {
        logger.error('Error updating presence:', error);
      }
    }, 60000);

    // Initial presence set
    client.emit('updatePresence'); 
  }
};
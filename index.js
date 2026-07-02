import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import NotificationService from './services/NotificationService.js';
import { loadEvents } from './handlers/eventHandler.js';
import { loadCommands } from './handlers/commandHandler.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
NotificationService.setClient(client);

// Catch unhandled errors for the log
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

async function init() {
  logger.info('Starting Finance Tracker Bot...');
  
  await loadEvents(client);
  await loadCommands(client);

  if (!process.env.BOT_TOKEN) {
    logger.error('Missing BOT_TOKEN in .env file.');
    process.exit(1);
  }

  client.login(process.env.BOT_TOKEN).catch((err) => {
    logger.error('Failed to login to Discord:', err);
    process.exit(1);
  });
}

init();
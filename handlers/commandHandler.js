import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { REST, Routes } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadCommands = async (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const commandsArray = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const commandModule = await import(`file://${filePath}`);
      const command = commandModule.default;
      
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsArray.push(command.data.toJSON());
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      logger.error(`Failed to load command ${file}:`, error);
    }
  }

  if (commandsArray.length > 0 && process.env.BOT_TOKEN && process.env.CLIENT_ID) {
    try {
      const rest = new REST().setToken(process.env.BOT_TOKEN);
      logger.info(`Started refreshing ${commandsArray.length} application (/) commands.`);

      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsArray },
      );

      logger.info(`Successfully reloaded application (/) commands.`);
    } catch (error) {
      logger.error('Failed to register application commands:', error);
    }
  }
};
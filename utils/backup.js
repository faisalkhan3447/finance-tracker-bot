import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const DB_PATH = path.join(process.cwd(), 'database', 'data.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

export const createBackup = (prefix = 'manual') => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const backupFilename = `finance-${prefix}-${dateStr}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  try {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
      logger.info(`Successfully created database backup: ${backupFilename}`);
      rotateBackups();
    }
  } catch (error) {
    logger.error('Error initiating database backup:', error);
  }

  return backupPath;
};

const rotateBackups = () => {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));

  const dailies = files.filter(f => f.includes('-daily-')).sort().reverse();
  const weeklies = files.filter(f => f.includes('-weekly-')).sort().reverse();
  const monthlies = files.filter(f => f.includes('-monthly-')).sort().reverse();

  if (dailies.length > 7) {
    for (let i = 7; i < dailies.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, dailies[i]));
      logger.info(`Deleted old daily backup: ${dailies[i]}`);
    }
  }

  if (weeklies.length > 8) {
    for (let i = 8; i < weeklies.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, weeklies[i]));
      logger.info(`Deleted old weekly backup: ${weeklies[i]}`);
    }
  }

  if (monthlies.length > 12) {
    for (let i = 12; i < monthlies.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, monthlies[i]));
      logger.info(`Deleted old monthly backup: ${monthlies[i]}`);
    }
  }
};
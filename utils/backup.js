import fs from 'fs';
import path from 'path';
import db from '../database/db.js';
import { logger } from './logger.js';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

/**
 * Creates an immediate backup of the SQLite database.
 * 
 * @param {string} prefix - The prefix for the backup file (e.g., 'daily', 'weekly', 'manual').
 * @returns {string} The path to the created backup.
 */
export const createBackup = (prefix = 'manual') => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const backupFilename = `finance-${prefix}-${dateStr}.sqlite`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  try {
    db.backup(backupPath)
      .then(() => {
        logger.info(`Successfully created database backup: ${backupFilename}`);
        rotateBackups();
      })
      .catch((err) => {
        logger.error(`Failed to create database backup:`, err);
      });
  } catch (error) {
    logger.error('Error initiating database backup:', error);
  }

  return backupPath;
};

/**
 * Enforces the tiered backup rotation policy:
 * - 7 dailies
 * - 8 weeklies
 * - 12 monthlies
 */
const rotateBackups = () => {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sqlite'));

  const dailies = files.filter(f => f.includes('-daily-')).sort().reverse();
  const weeklies = files.filter(f => f.includes('-weekly-')).sort().reverse();
  const monthlies = files.filter(f => f.includes('-monthly-')).sort().reverse();

  // Delete excess dailies
  if (dailies.length > 7) {
    for (let i = 7; i < dailies.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, dailies[i]));
      logger.info(`Deleted old daily backup: ${dailies[i]}`);
    }
  }

  // Delete excess weeklies
  if (weeklies.length > 8) {
    for (let i = 8; i < weeklies.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, weeklies[i]));
      logger.info(`Deleted old weekly backup: ${weeklies[i]}`);
    }
  }

  // Delete excess monthlies
  if (monthlies.length > 12) {
    for (let i = 12; i < monthlies.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, monthlies[i]));
      logger.info(`Deleted old monthly backup: ${monthlies[i]}`);
    }
  }
};
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';

const DB_PATH = path.join(process.cwd(), 'database', 'finance.sqlite');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let db;

try {
  db = new Database(DB_PATH, { verbose: (msg) => logger.debug(msg) });
  db.pragma('journal_mode = WAL');
  logger.info('Connected to SQLite database.');
} catch (error) {
  logger.error('Failed to connect to SQLite database:', error);
  process.exit(1);
}

// Migrations and initial schema
const initSchema = () => {
  const createSchemaVersionTable = `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `;
  db.prepare(createSchemaVersionTable).run();

  const getVersion = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
  const currentVersion = getVersion?.version || 0;

  if (currentVersion < 1) {
    logger.info('Migrating database to version 1...');
    const migrationTx = db.transaction(() => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS configuration (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `).run();

      db.prepare(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tx_id TEXT UNIQUE,
          message_id TEXT,
          user_id TEXT,
          username TEXT,
          type TEXT,
          original_amount REAL,
          original_currency TEXT,
          converted_inr REAL,
          balance_after REAL,
          reason TEXT,
          is_deleted INTEGER DEFAULT 0,
          timestamp INTEGER
        )
      `).run();

      // Set default config
      db.prepare('INSERT OR IGNORE INTO configuration (key, value) VALUES (?, ?)').run('exchange_rate', '82.00');
      db.prepare('INSERT OR IGNORE INTO configuration (key, value) VALUES (?, ?)').run('balance_inr', '0');
      db.prepare('INSERT OR IGNORE INTO configuration (key, value) VALUES (?, ?)').run('allow_negative_balance', 'false');

      db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
    });

    migrationTx();
    logger.info('Migration to version 1 complete.');
  }
};

initSchema();

// Helper to run atomic transactions
export const executeTransaction = (cb) => {
  const tx = db.transaction(cb);
  return tx();
};

export default db;
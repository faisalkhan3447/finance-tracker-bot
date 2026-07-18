import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const DB_PATH = path.join(process.cwd(), 'database', 'data.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const defaultData = {
  configuration: { balance: '0', allow_negative_balance: 'false', budget: '0' },
  transactions: []
};

class JSONDatabase {
  constructor() {
    this.data = defaultData;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
        if (!this.data.configuration) this.data.configuration = defaultData.configuration;
        if (!this.data.transactions) this.data.transactions = [];
        
        if (this.data.configuration.balance_inr !== undefined) {
           this.data.configuration.balance = this.data.configuration.balance_inr;
           delete this.data.configuration.balance_inr;
           delete this.data.configuration.exchange_rate;
        }
      } else {
        this.save();
      }
      logger.info('Connected to JSON database.');
    } catch (error) {
      logger.error('Failed to load JSON database:', error);
      process.exit(1);
    }
  }

  save() {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8'); } catch (error) { logger.error('Failed to save JSON database:', error); }
  }

  getConfig(key, defaultValue) {
    return this.data.configuration[key] !== undefined ? this.data.configuration[key] : defaultValue;
  }

  setConfig(key, value) {
    this.data.configuration[key] = value;
    this.save();
  }
}

const db = new JSONDatabase();
export const executeTransaction = (cb) => {
  try {
    const result = cb();
    db.save(); 
    return result;
  } catch (error) {
    db.load();
    throw error;
  }
};

export default db;
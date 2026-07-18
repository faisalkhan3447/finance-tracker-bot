import { Mutex } from 'async-mutex';
import db, { executeTransaction } from '../database/db.js';
import NotificationService from './NotificationService.js';
import EmbedService from './EmbedService.js';
import { logger } from '../utils/logger.js';

class TransactionService {
  constructor() { this.mutex = new Mutex(); }
  
  _generateNextId() { return db.data.transactions.reduce((max, tx) => Math.max(max, tx.id), 0) + 1; }
  _generateNextTxId(id) { return `TX-${String(id).padStart(6, '0')}`; }
  
  _isBalancePermitted(currentBalance, impact) {
    const allowNegative = db.getConfig('allow_negative_balance', 'false') === 'true';
    if (allowNegative) return true;
    return (currentBalance + impact) >= 0;
  }

  _checkAndTriggerAnnouncements(newTx) {
    if (newTx.type !== 'INCOME') return;

    const threshold = parseFloat(db.getConfig('high_value_threshold', '0'));
    if (threshold > 0 && newTx.amount >= threshold) {
      const embed = EmbedService.generateHighValueAnnouncement(newTx);
      NotificationService.dispatchAnnouncement(embed);
    }

    const goalTarget = parseFloat(db.getConfig('goal', '0'));
    if (goalTarget <= 0) return;

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0); const startOfMonthTs = startOfMonth.getTime();
    
    let previousMonthIncome = 0;
    for (const tx of db.data.transactions) {
      if (tx.is_deleted === 0 && tx.type === 'INCOME' && tx.timestamp >= startOfMonthTs && tx.id !== newTx.id) {
        previousMonthIncome += tx.amount;
      }
    }
    
    const currentMonthIncome = previousMonthIncome + newTx.amount;
    
    const previousPercentage = Math.floor((previousMonthIncome / goalTarget) * 10); 
    const currentPercentage = Math.floor((currentMonthIncome / goalTarget) * 10); 
    
    if (currentPercentage > previousPercentage && currentPercentage <= 10 && currentPercentage > 0) {
      const embed = EmbedService.generateMilestoneAnnouncement(currentPercentage, currentMonthIncome, goalTarget);
      NotificationService.dispatchAnnouncement(embed);
    }
  }

  async createTransaction(data) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const currentBalance = parseFloat(db.getConfig('balance', '0'));
        const impact = data.type === 'INCOME' ? data.amount : -data.amount;
        if (!this._isBalancePermitted(currentBalance, impact)) throw new Error('Insufficient balance.');

        const balanceAfter = currentBalance + impact;
        const id = this._generateNextId();
        const txId = this._generateNextTxId(id);
        const timestamp = Date.now();

        const newTx = {
          id, tx_id: txId, message_id: data.messageId || null, user_id: data.userId, username: data.username,
          type: data.type, amount: data.amount, balance_after: balanceAfter, reason: data.reason, is_deleted: 0, timestamp
        };

        db.data.transactions.push(newTx);
        db.data.configuration.balance = String(balanceAfter);
        
        setTimeout(() => this._checkAndTriggerAnnouncements(newTx), 500);

        return newTx;
      });
    });
  }

  async updateTransaction(messageId, newData) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const txIndex = db.data.transactions.findIndex(t => t.message_id === messageId && t.is_deleted === 0);
        if (txIndex === -1) throw new Error(`Transaction not found.`);
        const oldTx = db.data.transactions[txIndex];
        const oldImpact = oldTx.type === 'INCOME' ? oldTx.amount : -oldTx.amount;
        const newImpact = newData.type === 'INCOME' ? newData.amount : -newData.amount;
        const difference = newImpact - oldImpact;
        const currentBalance = parseFloat(db.getConfig('balance', '0'));
        if (!this._isBalancePermitted(currentBalance, difference)) throw new Error('Insufficient balance.');
        const newBalanceAfter = oldTx.balance_after + difference;
        const newCurrentBalance = currentBalance + difference;

        oldTx.type = newData.type; oldTx.amount = newData.amount;
        oldTx.balance_after = newBalanceAfter; oldTx.reason = newData.reason;

        if (difference !== 0) {
          for (let i = txIndex + 1; i < db.data.transactions.length; i++) {
            if (db.data.transactions[i].is_deleted === 0) db.data.transactions[i].balance_after += difference;
          }
          db.data.configuration.balance = String(newCurrentBalance);
        }
        return oldTx;
      });
    });
  }

  async deleteTransaction(identifier, identifierType = 'message_id') {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const txIndex = db.data.transactions.findIndex(t => t[identifierType] === identifier && t.is_deleted === 0);
        if (txIndex === -1) throw new Error(`Transaction not found.`);
        const tx = db.data.transactions[txIndex];
        const impact = tx.type === 'INCOME' ? -tx.amount : tx.amount; 
        const currentBalance = parseFloat(db.getConfig('balance', '0'));
        if (!this._isBalancePermitted(currentBalance, impact)) throw new Error('Cannot result in a negative balance.');
        tx.is_deleted = 1;
        for (let i = txIndex + 1; i < db.data.transactions.length; i++) {
          if (db.data.transactions[i].is_deleted === 0) db.data.transactions[i].balance_after += impact;
        }
        db.data.configuration.balance = String(currentBalance + impact);
        return tx;
      });
    });
  }

  async restoreTransaction(txId) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const txIndex = db.data.transactions.findIndex(t => t.tx_id === txId && t.is_deleted === 1);
        if (txIndex === -1) throw new Error(`Transaction not found.`);
        const tx = db.data.transactions[txIndex];
        const impact = tx.type === 'INCOME' ? tx.amount : -tx.amount; 
        const currentBalance = parseFloat(db.getConfig('balance', '0'));
        if (!this._isBalancePermitted(currentBalance, impact)) throw new Error('Cannot result in negative balance.');
        tx.is_deleted = 0;
        for (let i = txIndex + 1; i < db.data.transactions.length; i++) {
          if (db.data.transactions[i].is_deleted === 0) db.data.transactions[i].balance_after += impact;
        }
        db.data.configuration.balance = String(currentBalance + impact);
        return tx;
      });
    });
  }

  async undoLatestTransaction() {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        let txIndex = -1;
        for (let i = db.data.transactions.length - 1; i >= 0; i--) {
          if (db.data.transactions[i].is_deleted === 0) { txIndex = i; break; }
        }
        if (txIndex === -1) throw new Error('No active transactions.');
        const tx = db.data.transactions[txIndex];
        const impact = tx.type === 'INCOME' ? -tx.amount : tx.amount;
        const currentBalance = parseFloat(db.getConfig('balance', '0'));
        if (!this._isBalancePermitted(currentBalance, impact)) throw new Error('Cannot result in a negative balance.');
        tx.is_deleted = 1;
        db.data.configuration.balance = String(currentBalance + impact);
        return tx;
      });
    });
  }

  async recalculateEverything() {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        let runningBalance = 0;
        for (let i = 0; i < db.data.transactions.length; i++) {
          const tx = db.data.transactions[i];
          if (tx.is_deleted === 0) {
            const impact = tx.type === 'INCOME' ? tx.amount : -tx.amount;
            runningBalance += impact;
            tx.balance_after = runningBalance;
          }
        }
        db.data.configuration.balance = String(runningBalance);
      });
    });
  }
}

export default new TransactionService();
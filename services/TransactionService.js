import { Mutex } from 'async-mutex';
import db, { executeTransaction } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { convertCurrency } from '../utils/currency.js';

class TransactionService {
  constructor() {
    this.mutex = new Mutex();
  }

  _generateNextId() {
    const maxId = db.data.transactions.reduce((max, tx) => Math.max(max, tx.id), 0);
    return maxId + 1;
  }

  _generateNextTxId(id) {
    return `TX-${String(id).padStart(6, '0')}`;
  }

  _isBalancePermitted(currentBalance, impactInr) {
    const allowNegative = db.getConfig('allow_negative_balance', 'false') === 'true';
    if (allowNegative) return true;
    return (currentBalance + impactInr) >= 0;
  }

  async createTransaction(data) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const exchangeRate = parseFloat(db.getConfig('exchange_rate', '82.00'));
        const currentBalance = parseFloat(db.getConfig('balance_inr', '0'));
        
        let convertedInr = convertCurrency(data.originalAmount, data.originalCurrency, 'INR', exchangeRate);
        const impact = data.type === 'INCOME' ? convertedInr : -convertedInr;

        if (!this._isBalancePermitted(currentBalance, impact)) {
          throw new Error('Insufficient balance. Negative balance is not allowed by configuration.');
        }

        const balanceAfter = currentBalance + impact;
        const id = this._generateNextId();
        const txId = this._generateNextTxId(id);
        const timestamp = Date.now();

        const newTx = {
          id,
          tx_id: txId,
          message_id: data.messageId || null,
          user_id: data.userId,
          username: data.username,
          type: data.type,
          original_amount: data.originalAmount,
          original_currency: data.originalCurrency,
          converted_inr: convertedInr,
          balance_after: balanceAfter,
          reason: data.reason,
          is_deleted: 0,
          timestamp
        };

        db.data.transactions.push(newTx);
        db.data.configuration.balance_inr = String(balanceAfter);
        
        logger.info(`Transaction ${txId} created. Impact: ${impact}. New Balance: ${balanceAfter}`);
        
        return newTx;
      });
    });
  }

  async updateTransaction(messageId, newData) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const txIndex = db.data.transactions.findIndex(t => t.message_id === messageId && t.is_deleted === 0);
        if (txIndex === -1) {
          throw new Error(`Transaction with message ID ${messageId} not found or already deleted.`);
        }
        
        const oldTx = db.data.transactions[txIndex];
        const exchangeRate = parseFloat(db.getConfig('exchange_rate', '82.00'));
        let newConvertedInr = convertCurrency(newData.originalAmount, newData.originalCurrency, 'INR', exchangeRate);
        
        const oldImpact = oldTx.type === 'INCOME' ? oldTx.converted_inr : -oldTx.converted_inr;
        const newImpact = newData.type === 'INCOME' ? newConvertedInr : -newConvertedInr;
        const difference = newImpact - oldImpact;

        const currentBalance = parseFloat(db.getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, difference)) {
          throw new Error('Insufficient balance to apply this update. Negative balance is not allowed by configuration.');
        }

        const newBalanceAfter = oldTx.balance_after + difference;
        const newCurrentBalance = currentBalance + difference;

        oldTx.type = newData.type;
        oldTx.original_amount = newData.originalAmount;
        oldTx.original_currency = newData.originalCurrency;
        oldTx.converted_inr = newConvertedInr;
        oldTx.balance_after = newBalanceAfter;
        oldTx.reason = newData.reason;

        // Update subsequent transactions
        if (difference !== 0) {
          for (let i = txIndex + 1; i < db.data.transactions.length; i++) {
            if (db.data.transactions[i].is_deleted === 0) {
              db.data.transactions[i].balance_after += difference;
            }
          }
          db.data.configuration.balance_inr = String(newCurrentBalance);
        }

        logger.info(`Transaction ${oldTx.tx_id} updated. Diff: ${difference}. New Balance: ${newCurrentBalance}`);

        return oldTx;
      });
    });
  }

  async deleteTransaction(identifier, identifierType = 'message_id') {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const txIndex = db.data.transactions.findIndex(t => t[identifierType] === identifier && t.is_deleted === 0);
        
        if (txIndex === -1) {
          throw new Error(`Transaction with ${identifierType} ${identifier} not found or already deleted.`);
        }

        const tx = db.data.transactions[txIndex];
        const impact = tx.type === 'INCOME' ? -tx.converted_inr : tx.converted_inr; 
        const currentBalance = parseFloat(db.getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, impact)) {
           throw new Error('Cannot delete this transaction as it would result in a negative balance.');
        }

        tx.is_deleted = 1;

        for (let i = txIndex + 1; i < db.data.transactions.length; i++) {
          if (db.data.transactions[i].is_deleted === 0) {
            db.data.transactions[i].balance_after += impact;
          }
        }

        const newCurrentBalance = currentBalance + impact;
        db.data.configuration.balance_inr = String(newCurrentBalance);
        
        logger.info(`Transaction ${tx.tx_id} deleted. Impact on balance: ${impact}. New Balance: ${newCurrentBalance}`);
        
        return tx;
      });
    });
  }

  async restoreTransaction(txId) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const txIndex = db.data.transactions.findIndex(t => t.tx_id === txId && t.is_deleted === 1);
        
        if (txIndex === -1) {
          throw new Error(`Deleted transaction with ID ${txId} not found or is already active.`);
        }

        const tx = db.data.transactions[txIndex];
        const impact = tx.type === 'INCOME' ? tx.converted_inr : -tx.converted_inr; 
        const currentBalance = parseFloat(db.getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, impact)) {
           throw new Error('Cannot restore this transaction as it would result in a negative balance.');
        }

        tx.is_deleted = 0;

        for (let i = txIndex + 1; i < db.data.transactions.length; i++) {
          if (db.data.transactions[i].is_deleted === 0) {
            db.data.transactions[i].balance_after += impact;
          }
        }

        const newCurrentBalance = currentBalance + impact;
        db.data.configuration.balance_inr = String(newCurrentBalance);
        
        logger.info(`Transaction ${tx.tx_id} restored. Impact on balance: ${impact}. New Balance: ${newCurrentBalance}`);
        
        return tx;
      });
    });
  }

  async undoLatestTransaction() {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        let txIndex = -1;
        for (let i = db.data.transactions.length - 1; i >= 0; i--) {
          if (db.data.transactions[i].is_deleted === 0) {
            txIndex = i;
            break;
          }
        }

        if (txIndex === -1) {
           throw new Error('No active transactions to undo.');
        }
        
        const tx = db.data.transactions[txIndex];
        const impact = tx.type === 'INCOME' ? -tx.converted_inr : tx.converted_inr;
        const currentBalance = parseFloat(db.getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, impact)) {
           throw new Error('Cannot undo this transaction as it would result in a negative balance.');
        }

        tx.is_deleted = 1;

        const newCurrentBalance = currentBalance + impact;
        db.data.configuration.balance_inr = String(newCurrentBalance);
        
        logger.info(`Latest transaction ${tx.tx_id} undone. Impact on balance: ${impact}. New Balance: ${newCurrentBalance}`);
        
        return tx;
      });
    });
  }

  async recalculateEverything() {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        let runningBalance = 0;
        let count = 0;

        for (let i = 0; i < db.data.transactions.length; i++) {
          const tx = db.data.transactions[i];
          if (tx.is_deleted === 0) {
            const impact = tx.type === 'INCOME' ? tx.converted_inr : -tx.converted_inr;
            runningBalance += impact;
            tx.balance_after = runningBalance;
            count++;
          }
        }

        db.data.configuration.balance_inr = String(runningBalance);
        
        logger.info(`Recalculation complete. Fixed ${count} transactions. True Balance: ${runningBalance}`);
      });
    });
  }
}

export default new TransactionService();
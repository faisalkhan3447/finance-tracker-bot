import { Mutex } from 'async-mutex';
import db, { executeTransaction } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { convertCurrency } from '../utils/currency.js';

/**
 * Service responsible for handling all financial transactions.
 * Utilizes a Mutex to ensure only one transaction is processed at a time,
 * preventing race conditions. Modifies the database safely via atomic wrappers.
 */
class TransactionService {
  constructor() {
    this.mutex = new Mutex();
  }

  /**
   * Generates the next sequential transaction ID (e.g. TX-000001).
   * Note: Must be called inside a database transaction lock to ensure uniqueness.
   * 
   * @returns {string} The formatted transaction ID.
   */
  _generateNextTxId() {
    const stmt = db.prepare('SELECT MAX(id) as maxId FROM transactions');
    const result = stmt.get();
    const nextId = (result?.maxId || 0) + 1;
    return `TX-${String(nextId).padStart(6, '0')}`;
  }

  /**
   * Helper to retrieve a configuration value safely.
   * 
   * @param {string} key - The configuration key.
   * @param {string} defaultValue - The default value if not found.
   * @returns {string} The configuration value.
   */
  _getConfig(key, defaultValue) {
    const row = db.prepare('SELECT value FROM configuration WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  }

  /**
   * Helper to update a configuration value.
   * 
   * @param {string} key - The configuration key.
   * @param {string} value - The value to set.
   */
  _setConfig(key, value) {
    db.prepare('INSERT OR REPLACE INTO configuration (key, value) VALUES (?, ?)').run(key, value);
  }

  /**
   * Helper to evaluate whether a transaction can be processed without dropping below zero (if disallowed).
   * 
   * @param {number} currentBalance - The current balance in INR.
   * @param {number} impactInr - The positive or negative impact on the balance.
   * @returns {boolean} Whether the transaction is permitted based on rules.
   */
  _isBalancePermitted(currentBalance, impactInr) {
    const allowNegative = this._getConfig('allow_negative_balance', 'false') === 'true';
    if (allowNegative) return true;
    
    return (currentBalance + impactInr) >= 0;
  }

  /**
   * Creates a new transaction.
   * 
   * @param {Object} data - Transaction data.
   * @param {string} data.messageId - The Discord message ID (optional).
   * @param {string} data.userId - The user who created the transaction.
   * @param {string} data.username - The username of the creator.
   * @param {string} data.type - 'INCOME' or 'EXPENSE'.
   * @param {number} data.originalAmount - The numeric amount.
   * @param {string} data.originalCurrency - 'INR' or 'USD'.
   * @param {string} data.reason - The reason for the transaction.
   * @returns {Promise<Object>} The completed transaction record with updated balance, or throws error if invalid.
   */
  async createTransaction(data) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const exchangeRate = parseFloat(this._getConfig('exchange_rate', '82.00'));
        const currentBalance = parseFloat(this._getConfig('balance_inr', '0'));
        
        let convertedInr = convertCurrency(data.originalAmount, data.originalCurrency, 'INR', exchangeRate);
        const impact = data.type === 'INCOME' ? convertedInr : -convertedInr;

        if (!this._isBalancePermitted(currentBalance, impact)) {
          throw new Error('Insufficient balance. Negative balance is not allowed by configuration.');
        }

        const balanceAfter = currentBalance + impact;
        const txId = this._generateNextTxId();
        const timestamp = Date.now();

        const insertStmt = db.prepare(`
          INSERT INTO transactions (
            tx_id, message_id, user_id, username, type, original_amount, 
            original_currency, converted_inr, balance_after, reason, is_deleted, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `);
        
        insertStmt.run(
          txId, data.messageId || null, data.userId, data.username, data.type, 
          data.originalAmount, data.originalCurrency, convertedInr, balanceAfter, data.reason, timestamp
        );

        this._setConfig('balance_inr', String(balanceAfter));
        
        logger.info(`Transaction ${txId} created. Impact: ${impact}. New Balance: ${balanceAfter}`);
        
        // Return full transaction object
        return db.prepare('SELECT * FROM transactions WHERE tx_id = ?').get(txId);
      });
    });
  }

  /**
   * Updates an existing transaction (usually when a message is edited).
   * Will safely recalculate the balance differential and update history if needed.
   * 
   * @param {string} messageId - The Discord message ID of the transaction to update.
   * @param {Object} newData - The newly parsed transaction data.
   * @returns {Promise<Object>} The updated transaction record, or throws if not found.
   */
  async updateTransaction(messageId, newData) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const oldTx = db.prepare('SELECT * FROM transactions WHERE message_id = ? AND is_deleted = 0').get(messageId);
        if (!oldTx) {
          throw new Error(`Transaction with message ID ${messageId} not found or already deleted.`);
        }

        const exchangeRate = parseFloat(this._getConfig('exchange_rate', '82.00'));
        let newConvertedInr = convertCurrency(newData.originalAmount, newData.originalCurrency, 'INR', exchangeRate);
        
        // Calculate the differential impact
        const oldImpact = oldTx.type === 'INCOME' ? oldTx.converted_inr : -oldTx.converted_inr;
        const newImpact = newData.type === 'INCOME' ? newConvertedInr : -newConvertedInr;
        const difference = newImpact - oldImpact;

        const currentBalance = parseFloat(this._getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, difference)) {
          throw new Error('Insufficient balance to apply this update. Negative balance is not allowed by configuration.');
        }

        const newBalanceAfter = oldTx.balance_after + difference;
        const newCurrentBalance = currentBalance + difference;

        // Update the transaction
        const updateStmt = db.prepare(`
          UPDATE transactions 
          SET type = ?, original_amount = ?, original_currency = ?, converted_inr = ?, balance_after = ?, reason = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          newData.type, newData.originalAmount, newData.originalCurrency, 
          newConvertedInr, newBalanceAfter, newData.reason, oldTx.id
        );

        // Update subsequent transactions' balance_after sequentially to maintain integrity
        if (difference !== 0) {
          db.prepare(`
            UPDATE transactions 
            SET balance_after = balance_after + ? 
            WHERE id > ? AND is_deleted = 0
          `).run(difference, oldTx.id);
          
          this._setConfig('balance_inr', String(newCurrentBalance));
        }

        logger.info(`Transaction ${oldTx.tx_id} updated. Diff: ${difference}. New Balance: ${newCurrentBalance}`);

        return db.prepare('SELECT * FROM transactions WHERE id = ?').get(oldTx.id);
      });
    });
  }

  /**
   * Soft deletes a transaction and recalculates the balance.
   * 
   * @param {string} identifier - The tx_id or message_id of the transaction.
   * @param {string} identifierType - 'tx_id' or 'message_id'
   * @returns {Promise<Object>} The deleted transaction record.
   */
  async deleteTransaction(identifier, identifierType = 'message_id') {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const query = identifierType === 'tx_id' 
          ? 'SELECT * FROM transactions WHERE tx_id = ? AND is_deleted = 0'
          : 'SELECT * FROM transactions WHERE message_id = ? AND is_deleted = 0';
        
        const tx = db.prepare(query).get(identifier);
        
        if (!tx) {
          throw new Error(`Transaction with ${identifierType} ${identifier} not found or already deleted.`);
        }

        const impact = tx.type === 'INCOME' ? -tx.converted_inr : tx.converted_inr; // Reversing the impact
        const currentBalance = parseFloat(this._getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, impact)) {
           throw new Error('Cannot delete this transaction as it would result in a negative balance.');
        }

        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE id = ?').run(tx.id);

        db.prepare(`
          UPDATE transactions 
          SET balance_after = balance_after + ? 
          WHERE id > ? AND is_deleted = 0
        `).run(impact, tx.id);

        const newCurrentBalance = currentBalance + impact;
        this._setConfig('balance_inr', String(newCurrentBalance));
        
        logger.info(`Transaction ${tx.tx_id} deleted. Impact on balance: ${impact}. New Balance: ${newCurrentBalance}`);
        
        return db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id);
      });
    });
  }

  /**
   * Restores a previously soft-deleted transaction and recalculates the balance.
   * 
   * @param {string} txId - The transaction ID to restore (e.g., TX-000001).
   * @returns {Promise<Object>} The restored transaction record.
   */
  async restoreTransaction(txId) {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const tx = db.prepare('SELECT * FROM transactions WHERE tx_id = ? AND is_deleted = 1').get(txId);
        
        if (!tx) {
          throw new Error(`Deleted transaction with ID ${txId} not found or is already active.`);
        }

        const impact = tx.type === 'INCOME' ? tx.converted_inr : -tx.converted_inr; // Re-applying the impact
        const currentBalance = parseFloat(this._getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, impact)) {
           throw new Error('Cannot restore this transaction as it would result in a negative balance.');
        }

        db.prepare('UPDATE transactions SET is_deleted = 0 WHERE id = ?').run(tx.id);

        db.prepare(`
          UPDATE transactions 
          SET balance_after = balance_after + ? 
          WHERE id > ? AND is_deleted = 0
        `).run(impact, tx.id);

        const newCurrentBalance = currentBalance + impact;
        this._setConfig('balance_inr', String(newCurrentBalance));
        
        logger.info(`Transaction ${tx.tx_id} restored. Impact on balance: ${impact}. New Balance: ${newCurrentBalance}`);
        
        return db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id);
      });
    });
  }

  /**
   * Undoes the most recent active transaction.
   * 
   * @returns {Promise<Object>} The deleted transaction record.
   */
  async undoLatestTransaction() {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const tx = db.prepare('SELECT * FROM transactions WHERE is_deleted = 0 ORDER BY id DESC LIMIT 1').get();
        if (!tx) {
           throw new Error('No active transactions to undo.');
        }
        
        const impact = tx.type === 'INCOME' ? -tx.converted_inr : tx.converted_inr;
        const currentBalance = parseFloat(this._getConfig('balance_inr', '0'));

        if (!this._isBalancePermitted(currentBalance, impact)) {
           throw new Error('Cannot undo this transaction as it would result in a negative balance.');
        }

        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE id = ?').run(tx.id);

        const newCurrentBalance = currentBalance + impact;
        this._setConfig('balance_inr', String(newCurrentBalance));
        
        logger.info(`Latest transaction ${tx.tx_id} undone. Impact on balance: ${impact}. New Balance: ${newCurrentBalance}`);
        
        return db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id);
      });
    });
  }

  /**
   * Fully recalculates the running balance and all historical balance_after fields.
   * Should be used if data corruption occurs or exchange rate history needs rewriting (though rate doesn't apply retroactively).
   * 
   * @returns {Promise<void>}
   */
  async recalculateEverything() {
    return await this.mutex.runExclusive(() => {
      return executeTransaction(() => {
        const transactions = db.prepare('SELECT * FROM transactions WHERE is_deleted = 0 ORDER BY id ASC').all();
        
        let runningBalance = 0;

        const updateStmt = db.prepare('UPDATE transactions SET balance_after = ? WHERE id = ?');

        for (const tx of transactions) {
          const impact = tx.type === 'INCOME' ? tx.converted_inr : -tx.converted_inr;
          runningBalance += impact;
          updateStmt.run(runningBalance, tx.id);
        }

        this._setConfig('balance_inr', String(runningBalance));
        
        logger.info(`Recalculation complete. Fixed ${transactions.length} transactions. True Balance: ${runningBalance}`);
      });
    });
  }
}

export default new TransactionService();
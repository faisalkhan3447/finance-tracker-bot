import test from 'node:test';
import assert from 'node:assert';
import { parseTransactionMessage } from '../utils/currency.js';

test('Parse valid income', (t) => {
  const result1 = parseTransactionMessage('+5$');
  assert.deepStrictEqual(result1, { type: 'INCOME', amount: 5, currency: 'USD', reason: 'No reason provided' });

  const result2 = parseTransactionMessage('+$5 Sold Plugin');
  assert.deepStrictEqual(result2, { type: 'INCOME', amount: 5, currency: 'USD', reason: 'Sold Plugin' });

  const result3 = parseTransactionMessage('Sold Plugin +5$');
  assert.deepStrictEqual(result3, { type: 'INCOME', amount: 5, currency: 'USD', reason: 'Sold Plugin' });

  const result4 = parseTransactionMessage('+500rs');
  assert.deepStrictEqual(result4, { type: 'INCOME', amount: 500, currency: 'INR', reason: 'No reason provided' });

  const result5 = parseTransactionMessage('+₹500');
  assert.deepStrictEqual(result5, { type: 'INCOME', amount: 500, currency: 'INR', reason: 'No reason provided' });

  const result6 = parseTransactionMessage('500');
  assert.deepStrictEqual(result6, { type: 'INCOME', amount: 500, currency: 'INR', reason: 'No reason provided' });
  
  const result7 = parseTransactionMessage('+5 usd');
  assert.deepStrictEqual(result7, { type: 'INCOME', amount: 5, currency: 'USD', reason: 'No reason provided' });
});

test('Parse valid expense', (t) => {
  const result1 = parseTransactionMessage('-5$');
  assert.deepStrictEqual(result1, { type: 'EXPENSE', amount: 5, currency: 'USD', reason: 'No reason provided' });

  const result2 = parseTransactionMessage('Hosting -250rs');
  assert.deepStrictEqual(result2, { type: 'EXPENSE', amount: 250, currency: 'INR', reason: 'Hosting' });
  
  const result3 = parseTransactionMessage('-500');
  assert.deepStrictEqual(result3, { type: 'EXPENSE', amount: 500, currency: 'INR', reason: 'No reason provided' });
});

test('Parse invalid message', (t) => {
  const result1 = parseTransactionMessage('Hello world!');
  assert.strictEqual(result1, null);
  
  const result2 = parseTransactionMessage('+0$');
  assert.strictEqual(result2, null);
});
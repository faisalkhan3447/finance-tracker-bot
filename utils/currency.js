/**
 * Currency Utility Module
 * Handles parsing Discord messages into financial amounts and formatting them for display.
 */

/**
 * Formats a given number into a standardized INR string (e.g. ₹12,540.00).
 *
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted INR string.
 */
export const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formats a given number into a standardized USD string (e.g. $152.93).
 *
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted USD string.
 */
export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Parses a string to extract the first valid financial transaction amount, currency, and reason.
 * 
 * Supports formats like:
 * +5$, +$5, +5 usd, +5USD, + 5 USD, +500, +500rs, +500 rs, +₹500, +500 INR, +500inr
 * -5$, -$5, -₹500, -500rs, Spent 20$, Sold Plugin +5$
 *
 * @param {string} content - The message content to parse.
 * @returns {Object|null} An object containing the parsed type (INCOME/EXPENSE), amount, currency (INR/USD), and reason, or null if no valid amount is found.
 */
export const parseTransactionMessage = (content) => {
  // Regex to match a financial amount.
  // It looks for an optional + or -, optional currency symbols ($, ₹, rs, inr, usd),
  // followed by numbers (with optional decimals), and optional trailing currency symbols.
  // We use capturing groups to determine the sign, amount, and currency indicators.
  const regex = /([+-]?)\s*(?:(\$|₹|rs|inr|usd|rupees|dollars)\s*)?(\d+(?:\.\d+)?)\s*(?:(\$|₹|rs|inr|usd|rupees|dollars)\b)?/i;
  
  const match = content.match(regex);
  
  if (!match) {
    return null; // No financial amount found in the string
  }

  const signStr = match[1];
  const preSymbol = match[2];
  const valueStr = match[3];
  const postSymbol = match[4];

  // If no sign is provided but the string doesn't explicitly denote negative, we default to INCOME
  let isNegative = false;
  if (signStr === '-') {
    isNegative = true;
  } else if (signStr === '+') {
    isNegative = false;
  } else {
    isNegative = false;
  }

  const type = isNegative ? 'EXPENSE' : 'INCOME';
  const amount = parseFloat(valueStr);
  
  if (isNaN(amount) || amount === 0) {
    return null; // Ignore invalid amounts like +0$
  }

  // Determine currency based on symbols found before or after the number
  const combinedSymbols = ((preSymbol || '') + (postSymbol || '')).toLowerCase();
  let currency = 'INR'; // Default if none is specified (like +500)
  
  if (combinedSymbols.includes('$') || combinedSymbols.includes('usd') || combinedSymbols.includes('dollars')) {
    currency = 'USD';
  } else if (combinedSymbols.includes('₹') || combinedSymbols.includes('rs') || combinedSymbols.includes('inr') || combinedSymbols.includes('rupees')) {
    currency = 'INR';
  }

  // Extract the reason by removing the matched amount substring.
  // We replace only the first occurrence of the matched substring to preserve the rest of the text exactly as typed.
  const matchedSubstring = match[0];
  let reason = content.replace(matchedSubstring, '').trim();
  
  // Clean up any remaining leading/trailing whitespace or extra dashes if people typed "-5$ - Hosting"
  reason = reason.replace(/^-\s*/, '').trim();

  if (!reason) {
    reason = 'No reason provided';
  }

  return {
    type,
    amount,
    currency,
    reason
  };
};

/**
 * Converts an amount from one currency to another using the provided exchange rate.
 *
 * @param {number} amount - The amount to convert.
 * @param {string} fromCurrency - The original currency ('USD' or 'INR').
 * @param {string} toCurrency - The target currency ('USD' or 'INR').
 * @param {number} exchangeRate - The current exchange rate (1 USD = X INR).
 * @returns {number} The converted amount.
 */
export const convertCurrency = (amount, fromCurrency, toCurrency, exchangeRate) => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  if (fromCurrency === 'USD' && toCurrency === 'INR') {
    return amount * exchangeRate;
  }

  if (fromCurrency === 'INR' && toCurrency === 'USD') {
    return amount / exchangeRate;
  }

  return amount;
};
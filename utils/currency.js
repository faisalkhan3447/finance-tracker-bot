export const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const parseTransactionMessage = (content) => {
  const regex = /((?:\(\+\)|\(\-\)|[+-])?)\s*(?:(\$|₹|rs|inr|usd|rupees|dollars)\s*)?(\d+(?:\.\d+)?)\s*(?:(\$|₹|rs|inr|usd|rupees|dollars)(?![a-zA-Z]))?/i;
  
  const match = content.match(regex);
  
  if (!match) {
    return null; 
  }

  const signStr = (match[1] || '').replace(/[()]/g, '');
  const preSymbol = match[2];
  const valueStr = match[3];
  const postSymbol = match[4];

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
    return null;
  }

  const combinedSymbols = ((preSymbol || '') + (postSymbol || '')).toLowerCase();
  let currency = 'INR';
  
  if (combinedSymbols.includes('$') || combinedSymbols.includes('usd') || combinedSymbols.includes('dollars')) {
    currency = 'USD';
  } else if (combinedSymbols.includes('₹') || combinedSymbols.includes('rs') || combinedSymbols.includes('inr') || combinedSymbols.includes('rupees')) {
    currency = 'INR';
  }

  const matchedSubstring = match[0];
  let reason = content.replace(matchedSubstring, '').trim();
  
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
export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const parseTransactionMessage = (content) => {
  const regex = /((?:\(\+\)|\(\-\)|[+-])?)\s*(?:(\$|usd|dollars)\s*)?(\d+(?:\.\d+)?)\s*(?:(\$|usd|dollars)(?![a-zA-Z]))?/i;
  const match = content.match(regex);
  if (!match) return null; 

  const signStr = (match[1] || '').replace(/[()]/g, '');
  const valueStr = match[3];

  let isNegative = false;
  if (signStr === '-') isNegative = true;
  else if (signStr === '+') isNegative = false;

  const type = isNegative ? 'EXPENSE' : 'INCOME';
  const amount = parseFloat(valueStr);
  
  if (isNaN(amount) || amount === 0) return null;

  const matchedSubstring = match[0];
  let reason = content.replace(matchedSubstring, '').trim();
  reason = reason.replace(/^-\s*/, '').trim();

  if (!reason) reason = 'No reason provided';

  return { type, amount, reason };
};
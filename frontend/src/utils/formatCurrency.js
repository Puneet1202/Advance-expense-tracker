/**
 * Formats a number as Indian currency string.
 * e.g. 150000.5 → "₹1,50,000.50"
 * e.g. 1796.5900000000001 → "₹1,796.59"
 */
export const fmt = (value) => {
  const num = Math.round((parseFloat(value) || 0) * 100) / 100;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Same but returns plain number rounded to 2 decimal places (for calculations).
 */
export const round2 = (value) => Math.round((parseFloat(value) || 0) * 100) / 100;

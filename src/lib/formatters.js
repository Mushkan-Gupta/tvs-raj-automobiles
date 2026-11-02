/**
 * Formats a numeric price into Nepali Rupee (NPR) display format: "Rs 2,64,900"
 * Uses Indian/Nepali numbering system (lakhs/crores).
 *
 * @param {number|string} amount
 * @returns {string} Formatted string e.g. "Rs 2,64,900" or "—" if not valid
 */
export function formatNPR(amount) {
  if (amount == null || amount === '' || isNaN(Number(amount))) {
    return '—';
  }
  const num = Number(amount);
  return `Rs ${num.toLocaleString('en-IN')}`;
}

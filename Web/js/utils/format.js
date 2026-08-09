/** Formatting utilities
 * @module utils/format
 */

/**
 * Format number to 2 decimal places
 * @param {number} n
 * @returns {string}
 */
export function fmt2(n) {
  if (n === null || n === undefined || !isFinite(n)) return '∞';
  return n.toFixed(2);
}

/**
 * Format number to 4 decimal places
 * @param {number} n
 * @returns {string}
 */
export function fmt4(n) {
  if (n === null || n === undefined || !isFinite(n)) return '∞';
  return n.toFixed(4);
}

/**
 * Format as percentage with 2 decimal places
 * @param {number} n
 * @returns {string}
 */
export function fmtPct(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

/**
 * Format as percentage with 1 decimal place
 * @param {number} n
 * @returns {string}
 */
export function pctFmt(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Format DPS value
 * @param {number} n
 * @returns {string}
 */
export function fmtDps(n) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return fmt2(n);
}

/**
 * Format time in seconds
 * @param {number} n
 * @returns {string}
 */
export function fmtTime(n) {
  if (n === null || n === undefined || !isFinite(n)) return '∞';
  if (n < 60) return `${fmt2(n)}s`;
  const mins = Math.floor(n / 60);
  const secs = Math.round(n % 60);
  return `${mins}m ${secs}s`;
}
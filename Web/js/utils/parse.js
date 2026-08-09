/** Parsing utilities - ported from forge_calculator/parse.py
 * @module utils/parse
 */

/**
 * Stat patterns matching the workbook formulas
 * @type {Array<[string, string[]]>}
 */
const STAT_PATTERNS = [
  ['lethality', ['Damage Boost', 'Lethality']],
  ['crit_chance', ['Crit Chance']],
  ['crit_dmg', ['Crit DMG']],
  ['atk_speed', ['Attack Speed', 'Atk Speed']]
];

/**
 * Extract numeric value after '+' sign
 * Mirrors VALUE(MID(cell, FIND("+")+1, LEN(cell)-FIND("+")-1))
 * @param {string} text
 * @returns {number|null}
 */
function extractValue(text) {
  const idx = text.indexOf('+');
  if (idx < 0) return null;
  const rest = text.slice(idx + 1);
  if (!rest) return null;
  // Drop exactly one trailing character (the %)
  const numStr = rest.slice(0, -1).trim();
  const val = parseFloat(numStr);
  return isNaN(val) ? null : val;
}

/**
 * Parse trait/rune/achievement string
 * e.g., "Crit Chance +14%" -> { stat: 'crit_chance', value: 0.14 }
 * @param {string} text
 * @returns {{stat: string, value: number}|null}
 */
export function parseTrait(text) {
  if (!text) return null;
  const stripped = text.trim();
  if (!stripped || stripped.toLowerCase() === 'none') return null;

  const raw = extractValue(stripped);
  if (raw === null) return null;

  const low = stripped.toLowerCase();
  for (const [stat, keys] of STAT_PATTERNS) {
    if (keys.some(key => low.includes(key.toLowerCase()))) {
      return { stat, value: raw / 100.0 };
    }
  }
  return null;
}

/**
 * Parse ore power string (e.g., "2.33x" -> 2.33)
 * Mirrors IFERROR(VALUE(SUBSTITUTE(...,"x","")), 1)
 * @param {string|null} text
 * @returns {number}
 */
export function parseOrePower(text) {
  if (text === null || text === undefined) return 1.0;
  const cleaned = String(text).trim().toLowerCase().replace('x', '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 1.0 : val;
}
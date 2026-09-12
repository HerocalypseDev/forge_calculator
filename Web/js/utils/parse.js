
const STAT_PATTERNS = [
  ['lethality', ['Damage Boost', 'Lethality']],
  ['crit_chance', ['Crit Chance']],
  ['crit_dmg', ['Crit DMG']],
  ['atk_speed', ['Attack Speed', 'Atk Speed']]
];

function extractValue(text) {
  const idx = text.indexOf('+');
  if (idx < 0) return null;
  const rest = text.slice(idx + 1);
  if (!rest) return null;
  const numStr = rest.slice(0, -1).trim();
  const val = parseFloat(numStr);
  return isNaN(val) ? null : val;
}

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

export function parseOrePower(text) {
  if (text === null || text === undefined) return 1.0;
  const cleaned = String(text).trim().toLowerCase().replace('x', '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 1.0 : val;
}
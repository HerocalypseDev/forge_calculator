/** Input normalization - guards calculate() against missing/invalid build fields
 * @module engine/normalize
 */

const DEFAULT_BASE_CRIT_DMG = 1.45; // workbook C21 (145% crits before bonuses)

/**
 * Coerce a value to a finite number; 0 for null/undefined/non-finite.
 * An absent input cell is 0 in the workbook, so missing = 0.
 * @param {*} v
 * @returns {number}
 */
export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Base crit damage defaults to workbook C21 (1.45) when missing/invalid,
 * not 0 - a missing cell is the workbook's base, not "no crits".
 * @param {*} v
 * @returns {number}
 */
function baseCritDmg(v) {
  if (v === null || v === undefined || v === '') return DEFAULT_BASE_CRIT_DMG;
  const n = Number(v);
  return Number.isFinite(n) ? n : DEFAULT_BASE_CRIT_DMG;
}

/**
 * Normalize a build to a total, well-formed shape.
 * Identity for valid builds (numbers pass through unchanged); missing or
 * invalid fields become their workbook-default values.
 * @param {Build|Object} build
 * @returns {Build}
 */
export function normalizeBuild(build) {
  const b = build ?? {};
  const slots = Array.isArray(b.slots) ? b.slots : [];
  return {
    slots: slots.map(s => ({ name: String(s?.name ?? ''), amount: num(s?.amount) })),
    weapon_name: typeof b.weapon_name === 'string' ? b.weapon_name : '',
    quality: num(b.quality),
    forge_level: num(b.forge_level),
    race: typeof b.race === 'string' ? b.race : '',
    bonus_weapon_type: typeof b.bonus_weapon_type === 'string' ? b.bonus_weapon_type : '',
    rune_cells: Array.isArray(b.rune_cells) ? b.rune_cells.map(String) : [],
    base_crit_chance: num(b.base_crit_chance),
    base_crit_dmg: baseCritDmg(b.base_crit_dmg),
    armor_crit_chance: num(b.armor_crit_chance),
    armor_crit_dmg: num(b.armor_crit_dmg),
    armor_lethality: num(b.armor_lethality),
    base_lethality: num(b.base_lethality),
    abilities: {
      blast_dmg: num(b.abilities?.blast_dmg),
      blast_chance: num(b.abilities?.blast_chance),
      fire_dmg: num(b.abilities?.fire_dmg),
      fire_chance: num(b.abilities?.fire_chance),
      fire_time: num(b.abilities?.fire_time),
      poison_dmg: num(b.abilities?.poison_dmg),
      poison_chance: num(b.abilities?.poison_chance),
      poison_time: num(b.abilities?.poison_time)
    },
    berserk: num(b.berserk),
    achievement: typeof b.achievement === 'string' ? b.achievement : ''
  };
}

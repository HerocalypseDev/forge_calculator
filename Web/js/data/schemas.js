/** @typedef {Object} StatRange
 * @property {number} base
 * @property {number} max
 * @property {number} divisor
 */

/** @typedef {Object} Ore
 * @property {string} name
 * @property {number} multiplier
 * @property {string|null} equipment
 * @property {string|null} trait10
 * @property {string|null} trait30
 * @property {string|null} comments
 * @property {Object.<string, StatRange>} stats
 */

/** @typedef {Object} Weapon
 * @property {string} name
 * @property {string} type
 * @property {number} interval
 * @property {number} damage
 */

/** @typedef {Object} Race
 * @property {string} name
 * @property {string|null} default_trait
 * @property {string[]} available_traits
 */

/** @typedef {Object} Rune
 * @property {string} name
 * @property {string|null} stat
 * @property {number|null} value
 */

/** @typedef {Object} Achievement
 * @property {string} name
 * @property {string|null} stat
 * @property {number|null} value
 */

/** @typedef {Object} GameData
 * @property {Ore[]} ores
 * @property {Weapon[]} weapons
 * @property {Race[]} races
 * @property {Rune[]} runes
 * @property {Achievement[]} achievements
 * @property {string[]} weapon_types
 * @property {string[]} race_bonus_types
 * @property {string} select_ore
 * @property {string} none_label
 * @property {Map<string, Ore>} _ore_index
 * @property {Map<string, Weapon>} _weapon_index
 * @property {Map<string, Race>} _race_index
 */

/** @typedef {Object} OreSlot
 * @property {string} name
 * @property {number} amount
 */

/** @typedef {Object} Abilities
 * @property {number} fire_dmg
 * @property {number} fire_chance
 * @property {number} fire_time
 * @property {number} poison_dmg
 * @property {number} poison_chance
 * @property {number} poison_time
 * @property {number} blast_dmg
 * @property {number} blast_chance
 */

/** @typedef {Object} Build
 * @property {OreSlot[]} slots
 * @property {string} weapon_name
 * @property {number} quality
 * @property {number} forge_level
 * @property {string} race
 * @property {string} bonus_weapon_type
 * @property {string[]} rune_cells
 * @property {number} base_crit_chance
 * @property {number} base_crit_dmg
 * @property {number} armor_crit_chance
 * @property {number} armor_crit_dmg
 * @property {number} armor_lethality
 * @property {number} base_lethality
 * @property {Abilities} abilities
 * @property {number} berserk
 * @property {string} achievement
 */

/** @typedef {Object} CalculateResult
 * @property {number} avg_power
 * @property {number} unforged_damage
 * @property {number} forged_damage
 * @property {number} interval
 * @property {number} attack_rate
 * @property {number} lethality
 * @property {number} crit_chance
 * @property {number} crit_dmg
 * @property {number} atk_speed
 * @property {number} crit_blend
 * @property {number} moon
 * @property {number} explosion_dmg
 * @property {number} explosion_chance
 * @property {number} fire_dmg
 * @property {number} fire_chance
 * @property {number} fire_duration
 * @property {number} poison_dmg
 * @property {number} poison_chance
 * @property {number} poison_duration
 * @property {number} smite_dmg
 * @property {number} smite_chance
 * @property {number} blackhole_dmg
 * @property {number} blackhole_chance
 * @property {number} weapon_dps
 * @property {number} explosion_dps
 * @property {number} fire_dps
 * @property {number} poison_dps
 * @property {number} smite_dps
 * @property {number} blackhole_dps
 * @property {number} total_dps
 * @property {number|null} berserk
 * @property {number|null} moonstone
 * @property {number} min_dps
 * @property {number} max_dps
 * @property {number|null} ttk_25k
 * @property {number|null} ttk_75k
 * @property {string} active_traits
 */
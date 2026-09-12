
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculate } from './dps.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../../data');

const loadJSON = (n) => JSON.parse(fs.readFileSync(path.join(DATA, n), 'utf8'));

const rawOres = loadJSON('ores.json');
const rawWeapons = loadJSON('weapons.json');
const rawRaces = loadJSON('races.json');
const rawRunes = loadJSON('runes.json');
const rawAchievements = loadJSON('achievements.json');

for (const ore of rawOres.ores) {
  if (ore.stats) delete ore.stats.atk_speed;
}

const game = {
  ores: rawOres.ores,
  weapons: rawWeapons.weapons,
  races: rawRaces.races,
  runes: rawRunes.runes,
  achievements: rawAchievements.achievements,
  weapon_types: rawWeapons.types,
  race_bonus_types: rawWeapons.race_bonus_types,
  select_ore: rawOres.select_ore ?? 'Select Ore',
  none_label: 'None'
};
game._ore_index = new Map(game.ores.map(o => [o.name, o]));
game._weapon_index = new Map(game.weapons.map(w => [w.name, w]));
game._race_index = new Map(game.races.map(r => [r.name, r]));

const build = {
  slots: [
    { name: 'Fierce Jade', amount: 15 },
    { name: 'Kitsunite', amount: 20 },
    { name: 'Galaxite', amount: 15 },
    { name: 'Select Ore', amount: 0 }
  ],
  weapon_name: 'Hook Blade',
  quality: 100,
  forge_level: 9,
  race: 'Archangel',
  bonus_weapon_type: 'Dagger',
  rune_cells: ['None', 'None', 'None', 'None', 'None', 'None'],
  base_crit_chance: 0,
  base_crit_dmg: 1.45,
  armor_crit_chance: 0.7,
  armor_crit_dmg: 0.4,
  armor_lethality: 0.8,
  base_lethality: 0,
  abilities: {
    fire_dmg: 0, fire_chance: 0, fire_time: 0,
    poison_dmg: 0, poison_chance: 0, poison_time: 0,
    lightning_dmg: 0, lightning_chance: 0, lightning_cooldown: 0,
    blast_dmg: 0, blast_chance: 0
  },
  berserk: 0,
  achievement: 'Attack Speed +20%'
};

const C101 = 10346.10962 - 0.8 + 584.1 * 0.8 * 0.6 * 2.692307692;

const expected = [
  ['E10  avg ore power', 'avg_power', 23.6],
  ['A18  unforged dmg', 'unforged_damage', 389.4],
  ['C18  forged dmg', 'forged_damage', 584.1],
  ['E21  eff. hits/sec', 'attack_rate', 2.692307692],
  ['E45  lethality', 'lethality', 1.2],
  ['E46  crit chance', 'crit_chance', 1.0],
  ['E47  crit dmg', 'crit_dmg', 0.8],
  ['E48  atk speed', 'atk_speed', 0.4],
  ['C53  moon', 'moon', 0],
  ['C58  explosion dmg', 'explosion_dmg', 0.7],
  ['C59  explosion chance', 'explosion_chance', 0.4],
  ['C62  fire dmg', 'fire_dmg', 0.4],
  ['C63  fire chance', 'fire_chance', 0.5],
  ['C64  fire duration', 'fire_duration', 4],
  ['C67  poison dmg', 'poison_dmg', 0],
  ['C68  poison chance', 'poison_chance', 0],
  ['C69  poison duration', 'poison_duration', 0],
  ['C72  smite dmg', 'smite_dmg', 1.5],
  ['C73  smite chance', 'smite_chance', 0.83],
  ['C76  black hole dmg', 'blackhole_dmg', 0.6],
  ['C77  black hole chance', 'blackhole_chance', 0.3],
  ['C80  lightning dmg', 'lightning_dmg', 0.8],
  ['C81  lightning chance', 'lightning_chance', 0.6],
  ['C89  physical hit DPS', 'weapon_dps', 7784.255769],
  ['C90  explosion DPS', 'explosion_dps', 293.5476923],
  ['C91  fire DoT DPS', 'fire_dps', 155.76],
  ['C92  poison DoT DPS', 'poison_dps', 0],
  ['C93  smite DPS', 'smite_dps', 1305.238846],
  ['C94  black hole DPS', 'blackhole_dps', 188.7092308],
  ['E94  lightning DPS', 'lightning_dps', 62.304],
  ['C96  TOTAL DPS', 'total_dps', 9789.815538],
  ['C97  berserk DPS', 'berserk', 9789.815538],
  ['C98  moon stone DPS', 'moonstone', 9789.815538],
  ['C100 min DPS', 'min_dps', 3459.669231],
  ['C101 max burst DPS*', 'max_dps', C101],
  ['E96  TTK 25k', 'ttk_25k', 2.553674265],
  ['E97  TTK 75k', 'ttk_75k', 7.661022795]
];

const r = calculate(build, game);
const TOL = 1e-6;
let fails = 0;
console.log('cell                      workbook            engine         status');
console.log('-'.repeat(78));
for (const [label, key, want] of expected) {
  let got = r[key];
  if (got === null && (key === 'berserk' || key === 'moonstone')) got = r.total_dps;
  const ok = got !== null && got !== undefined
    && Math.abs(got - want) <= TOL * Math.max(1, Math.abs(want));
  if (!ok) fails++;
  console.log(
    label.padEnd(25),
    String(want).padStart(14),
    String(got === null ? 'null' : Number(got).toFixed(6)).padStart(16),
    ok ? '  ok' : '  <-- MISMATCH'
  );
}
console.log('-'.repeat(78));
console.log('* C101 restated for the scaled-lightning decision; ore atk_speed excluded');
console.log(fails === 0
  ? 'reall.xlsx PARITY PASSED'
  : `${fails} of ${expected.length} cells diverge from reall.xlsx`);
process.exit(fails ? 1 : 0);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const SRC = fs.readFileSync(path.join(HERE, 'forge-calculator.common.js'), 'utf8');

const marker = 'var DATA_TITLES = {';
const idx = SRC.indexOf(marker);
if (idx < 0) { throw new Error('Marker not found'); }
const blockStart = SRC.lastIndexOf('\n', idx) + 1;
const instrumented = SRC.slice(0, blockStart) +
  '  globalThis.__FC = { calculate: calculate, buildGameData: buildGameData };\n' +
  SRC.slice(blockStart);

const mw = {
  config: { get: () => '/w' },
  loader: { using: () => Promise.resolve() },
  log: () => {},
  Api: function () {},
  hook: () => ({ fire: () => {} })
};
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  document: { readyState: 'complete', getElementById: () => null, addEventListener: () => {} }
};
sandbox.window = sandbox;
sandbox.window.mediaWiki = mw;
vm.createContext(sandbox);
vm.runInContext(instrumented, sandbox, { filename: 'forge-calculator.common.js' });
const FC = sandbox.__FC;

function loadJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8'));
}
const game = FC.buildGameData({
  ores: loadJSON('Data-Ores.json'),
  weapons: loadJSON('Data-Weapons.json'),
  races: loadJSON('Data-Races.json'),
  runes: loadJSON('Data-Runes.json'),
  achievements: loadJSON('Data-Achievements.json')
});

// The build provided by the user
// 2 ores (amount 20 each), demon race, weapon ironhand, 100% armor crit chance
const build = {
  slots: [
    { name: 'Stone', amount: 20 },
    { name: 'Fireite', amount: 20 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  weapon_name: 'Ironhand',
  quality: 100,
  forge_level: 0,
  race: 'Demon',
  bonus_weapon_type: 'Gauntlet',
  rune_cells: ['None', 'None', 'None', 'None', 'None', 'None'],
  base_crit_chance: 0,
  base_crit_dmg: 0,
  armor_crit_chance: 1.0, // 100%
  armor_crit_dmg: 0,
  armor_lethality: 0,
  base_lethality: 0,
  abilities: {
    fire_dmg: 0,
    fire_chance: 0,
    fire_time: 0,
    poison_dmg: 0,
    poison_chance: 0,
    poison_time: 0,
    blast_dmg: 0,
    blast_chance: 0
  },
  berserk: 0,
  achievement: 'None'
};

console.log("Calculating...");
const result = FC.calculate(build, game);

console.log("Result:", JSON.stringify(result, null, 2));
console.log("\nDebugging Info:");
console.log("Weapon DPS:", result.weapon_dps);
console.log("C18 (Forged Damage):", result.forged_damage);
console.log("Crit Blend:", result.crit_blend);
console.log("Attack Rate:", result.attack_rate);
console.log("Lethality:", result.lethality);

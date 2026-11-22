(function (mw) {
  'use strict';

  if (!mw || !mw.config || !document.getElementById) {
    return;
  }
  if (window.FC_CALCULATOR_LOADED) {
    return;
  }
  window.FC_CALCULATOR_LOADED = true;

  var NONE_LABEL = 'None';
  var SELECT_ORE = 'Select Ore';

  var SHARE_GATE = 0.10;
  var RAMP_TOP = 0.30;
  var RAMP_SPAN = RAMP_TOP - SHARE_GATE;

  var FORGE_MULT = {
    0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
    5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5
  };

  var RACE_LETHALITY = {
    'Archangel': 0.20,
    'Demon': 0.20,
    'Orc': 0.10,
    'Shadow': 0.05,
    'Dragonborn': 0.12,
    'Orc Lord': 0.40,
    'Fallen Angel': 0.20
  };

  var CLASS_LETHALITY = {
    'Felynx,Gauntlet': 0.20,
    'Felynx,Gauntlets': 0.20,
    'Vampire,Straight Sword': 0.10,
    'Imp,Spear': 0.25
  };

  var RACE_ATK_SPEED = {
    'Shadow': 0.10,
    'Demon': 0.20,
    'Archangel': 0.20,
    'Fallen Angel': 0.10
  };

  var CLASS_ATK_SPEED = {
    'Goblin,Dagger': 0.10,
    'Golem,Colossal Sword': 0.15,
    'Golem,Great Axe': 0.15,
    'Felynx,Gauntlet': 0.20,
    'Felynx,Gauntlets': 0.20,
    'Imp,Spear': 0.20
  };

  var UNCAPPED_RACE_LETHALITY = { 'Kitsune': 0.20 };
  var ARMOR_SLOTS = ['helmet', 'chestplate', 'leggings'];

  function armorSet(pieces, bonus, types, classes, lethality, slots) {
    return {
      pieces: pieces,
      types: types,
      classes: classes,
      lethality: lethality === false ? 0.0 : bonus,
      atk_speed: bonus,
      slots: slots || ARMOR_SLOTS
    };
  }

  var ARMOR_SETS = {
    'Light': armorSet(3, 0.125, ['Dagger'], [], false),
    'Ninja': armorSet(3, 0.12, [], ['Ninja']),
    'Voidstrider': armorSet(3, 0.10, [], ['Rogue']),
    'Medium': armorSet(3, 0.20, [], ['Gladiator']),
    'Samurai': armorSet(3, 0.10, [], ['Samurai']),
    'Viking': armorSet(3, 0.125, [], ['Viking']),
    'Rootguard': armorSet(3, 0.10, [], ['Graveyard', 'Holy']),
    'Gloomwarden': armorSet(3, 0.10, [], ['Crystallized']),
    'Knight': armorSet(3, 0.075, [], ['Knight']),
    'Dark Knight': armorSet(3, 0.075, [], ['Dark Knight']),
    'Wolf': armorSet(3, 0.075, ['Gauntlet'], []),
    'Raven': armorSet(3, 0.075, [], ['Hellbound']),
    'Vanguard': armorSet(3, 0.075, ['Halberd', 'Spear'], []),
    'Shogun': armorSet(3, 0.06, ['Katana', 'Halberd'], []),
    'Juggernaut': armorSet(2, 0.05, ['Colossal Sword', 'Great Sword'], [], true, ['chestplate', 'leggings']),
    'Dreadhorn': armorSet(3, 0.08, [], ['Sword & Shield']),
    "Goblin's Crown": armorSet(1, 0.05, [], ['Brute'], true, ['helmet'])
  };

  var UNCAPPED_CLASS_LETHALITY = { 'Fairy,Spear': 0.15 };
  var UNCAPPED_RACE_ATK_SPEED = { 'Kitsune': 0.20 };
  var UNCAPPED_CLASS_ATK_SPEED = { 'Fairy,Spear': 0.15 };
  var UNCAPPED_RACE_CRIT_DMG = { 'Kitsune': 0.15 };
  var DRYAD_GROVE_CRIT_CHANCE = 0.15;
  var DRYAD_GROVE_CRIT_DMG = 0.15;
  var DRYAD_VITAL_POWER_STEP_HP = 1000;
  var DRYAD_VITAL_POWER_PER_STEP = 0.05;
  var DRYAD_VITAL_POWER_MAX_STEPS = 10;
  var ORC_LORD_WARBRINGER_PER_TENTH = 0.075;
  var ORC_LORD_LORD_OF_WAR_PER_STACK = 0.075;
  var ORC_LORD_LORD_OF_WAR_MAX_STACKS = 5;

  var RACE_FIRE_DMG = { 'Dragonborn': 0.30, 'Demon': 0.20 };
  var RACE_FIRE_CHANCE = { 'Dragonborn': 0.40 };
  var RACE_FIRE_TIME = { 'Dragonborn': 3, 'Demon': 3 };

  var RACE_SMITE_DMG = { 'Angel': 0.30 };
  var RACE_SMITE_CHANCE = { 'Angel': 0.50 };

  var RACE_BERSERK = { 'Minotaur': 0.30, 'Fallen Angel': 0.30 };

  var RACE_SMASH_DMG = { 'Orc Lord': 1.0 };
  var RACE_SMASH_COOLDOWN = { 'Orc Lord': 10.0 };
  var RACE_SMASH_CHANCE = { 'Orc Lord': 0.25 };

  var RACE_FOX_CLAWS_DMG = { 'Kitsune': 0.75 };
  var RACE_FOX_CLAWS_CHANCE = { 'Kitsune': 0.25 };
  var FOX_CLAWS_SPIRITS = 3;
  var FOX_CLAWS_SPIRIT_TIME = 2.22;

  var RACE_FOXFIRE_DMG = { 'Kitsune': 0.3 };
  var RACE_FOXFIRE_CHANCE = { 'Kitsune': 0.5 };
  var RACE_FOXFIRE_TIME = { 'Kitsune': 3.0 };

  var ARCHANGEL_SMITE_DMG = 1.5;
  var ARCHANGEL_SMITE_CHANCE = 0.33;
  var ARCHANGEL_SMITE_COOLDOWN = 10.0;
  var DEMON_CURSED_AURA_DMG = 0.1;
  var RACE_DARK_SMITE_DMG = { 'Fallen Angel': 0.35 };
  var RACE_DARK_SMITE_CHANCE = { 'Fallen Angel': 0.3 };
  var TRIDENT_TOSS = { 'Imp,Spear': [1.2, 1.0, 8.0] };
  var REVERBERATION_ORE = 'Echotite';
  var REVERBERATION_CHANCE = { 'Dagger': 0.20, 'Straight Sword': 0.16, 'Gauntlet': 0.12 };
  var REVERBERATION_DEFAULT_CHANCE = 0.08;
  var STARFALL_GALAXITE_MULT = 225 / 125;
  var STARFALL_ORE = 'Frost Star';
  var STARFALL_COOLDOWN = 10;
  var TRAINING_DAY_LETHALITY = 0.15;
  var TRAINING_DAY_ATK_SPEED = 0.15;
  var SKELETON_KING_HP = 7200;
  var STELLAR_MARK_HITS = 5;

  var EXPLOSION_DMG_CAP = 2.5;
  var SMITE_DMG_CAP = 2.5;
  var MOON_CAP = 1.5;
  var FIRE_TIME_RANGE = [1.0, 5.0];
  var POISON_TIME_RANGE = [1.0, 15.0];
  var DEFAULT_LIGHTNING_COOLDOWN = 10.0;
  var BLACKHOLE_CHANCE = 0.3;
  var BLACKHOLE_COOLDOWN = 1.0;
  var GALAXITE_BISMUTH_WAVE = 1.25;
  var PRISMATIC_SHIFT_ORE = 'Bismuth';
  var PRISMATIC_SHIFT_RUNE_COUNT = 4;
  var PRISMATIC_POISON = [0.16, 0.77, 12.0];
  var PRISMATIC_EXPLOSION = [0.70, 0.42];
  var PRISMATIC_FIRE = [0.26, 0.60, 4.0];
  var PRISMATIC_LIGHTNING = [0.80, 0.47, 3.0];
  var FIRE_TICK_OFFSET = 0.5;
  var POISON_TICK_OFFSET = -0.5;
  var COOLDOWN_EPSILON = 1e-9;
  var PROC_ROLL_SIDES = 101;
  var GOLEMITE_MIN_LEVEL = 13;
  var GOLEMITE_MAX_LEVEL = 25;
  var GOLEMITE_BASE_DMG = 0.02;
  var GOLEMITE_DMG_RAMP = 0.04;
  var GOLEMITE_RAMP_LEVELS = 12;
  var GOLEMITE_HITS_PER_SECOND = 0.66666666666666;
  var GOLEMITE_RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Relic', 'Exotic', 'Divine'];
  var GOLEMITE_TRAIT_SCALING = {
    Common: 0.06,
    Uncommon: 0.08,
    Rare: 0.12,
    Epic: 0.15,
    Legendary: 0.18,
    Mythic: 0.23,
    Relic: 0.25,
    Exotic: 0.28,
    Divine: 0.30
  };
  var GOLEMITE_FIELDS = [
    'level', 'fire_dmg', 'fire_chance', 'fire_time', 'poison_dmg', 'poison_chance', 'poison_time',
    'lightning_dmg', 'lightning_chance', 'lightning_cooldown', 'blast_dmg', 'blast_chance',
    'smite_dmg', 'smite_chance', 'blackhole_dmg', 'blackhole_chance', 'resonance_dmg', 'moon',
    'lethality', 'crit_chance', 'crit_dmg', 'atk_speed',
    'starfall_dmg', 'starfall_chance', 'starfall_cooldown', 'ancient_poison_dmg', 'ancient_poison_chance', 'ancient_poison_duration', 'frost_slash_dmg', 'frost_slash_chance', 'glacier_dmg', 'glacier_chance', 'stellar_mark_dmg', 'reverberation_chance'
  ];

  var AVG_POWER_EXCLUDED = ['Fichilliumorite', 'Bismuth'];

  var CAPS = {
    lethality: 3.0,
    crit_chance: 1.0,
    crit_dmg: 1.0,
    atk_speed: 1.5,
    berserk: 2.0
  };

  var TRAIT_POWER_SLOPE = 4.5;
  var TRAIT_POWER_FLOOR = 0.1;

  var CAP_CLASS = 'fc-is-capped';

  var CORE_STATS = ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed'];

  var RUNE_UNLOCK_LEVELS = [3, 6, 9];
  var RUNE_CELLS_PER_LINE = 3;

  function unlockedRuneCells(runeCells, forgeLevel) {
    return (runeCells || []).map(function (cell, i) {
      var level = RUNE_UNLOCK_LEVELS[Math.floor(i / RUNE_CELLS_PER_LINE)];
      return level !== undefined && forgeLevel >= level ? cell : NONE_LABEL;
    });
  }

  var EXPECTED_COUNTS = {
    ores: 155,
    weapons: 94,
    races: 22,
    runes: 46,
    achievements: 16
  };

  function shareScaling(base, max, share, divisor, rng) {
    if (divisor === undefined) { divisor = 100; }
    var gated = !(rng && rng.gated === false);
    if (gated && share < SHARE_GATE) { return 0.0; }
    var value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
    value = value / divisor;
    if (rng && typeof rng.ceiling === 'number') { value = Math.min(rng.ceiling, value); }
    if (rng && typeof rng.floor === 'number') { value = Math.max(rng.floor, value); }
    return value;
  }

  function scaleRange(rng, share) {
    return shareScaling(rng.base, rng.max, share, rng.divisor, rng);
  }

  function slotShares(slots) {
    var total = 0;
    for (var i = 0; i < slots.length; i++) { total += slots[i].amount; }
    if (total === 0) { return slots.map(function () { return 0.0; }); }
    return slots.map(function (s) { return s.amount / total; });
  }

  function slotPower(slot, game) {
    if (slot.name === game.select_ore) { return 1.0; }
    var ore = game._ore_index.get(slot.name);
    return (ore && typeof ore.multiplier === 'number') ? ore.multiplier : 1.0;
  }

  function mergeSlots(slots, selectOre) {
    var merged = [];
    var firstIndex = {};
    slots.forEach(function (slot) {
      var real = slot.name && slot.name !== selectOre;
      if (real && Object.prototype.hasOwnProperty.call(firstIndex, slot.name)) {
        var i = firstIndex[slot.name];
        merged[i] = { name: slot.name, amount: merged[i].amount + slot.amount };
        merged.push({ name: selectOre, amount: 0.0 });
        return;
      }
      if (real) { firstIndex[slot.name] = merged.length; }
      merged.push({ name: slot.name, amount: slot.amount });
    });
    return merged;
  }

  function weightedPower(slots, game) {
    var total = 0.0;
    var weighted = 0.0;
    slots.forEach(function (s) {
      total += s.amount;
      weighted += s.amount * slotPower(s, game);
    });
    return total > 0 ? weighted / total : null;
  }

  function avgOrePower(slots, game) {
    var filled = slots.filter(function (s) { return s.name && s.name !== game.select_ore; });
    var kept = filled.filter(function (s) { return AVG_POWER_EXCLUDED.indexOf(s.name) === -1; });
    var neutral = filled.filter(function (s) { return AVG_POWER_EXCLUDED.indexOf(s.name) !== -1; });
    var keptPower = weightedPower(kept, game);
    if (keptPower !== null) { return keptPower; }
    var neutralPower = weightedPower(neutral, game);
    if (neutralPower !== null) { return neutralPower; }
    var pool = kept.length ? kept : neutral;
    if (!pool.length) { return 1.0; }
    var sum = 0.0;
    pool.forEach(function (s) { sum += slotPower(s, game); });
    return sum / pool.length;
  }

  function forgeMultiplier(level) {
    return FORGE_MULT[level] !== undefined ? FORGE_MULT[level] : 1.0;
  }

  function weaponBases(weapon, avgPower, quality, forgeLevel) {
    if (!weapon) { return [0.0, 0.0]; }
    var base = weapon.damage * avgPower * (1 + quality / 100.0);
    return [base, base * forgeMultiplier(forgeLevel)];
  }

  function attackRate(weapon, atkSpeedTotal) {
    var interval = (weapon && typeof weapon.interval === 'number') ? weapon.interval : 1.0;
    return (1 + atkSpeedTotal) / interval;
  }

  function critBlend(ccTotal, cdTotal) {
    var cc = Math.min(ccTotal, 1.0);
    return cc * cdTotal + (1 - cc);
  }

  var STAT_PATTERNS = [
    ['lethality', ['Damage Boost', 'Lethality']],
    ['crit_chance', ['Crit Chance']],
    ['crit_dmg', ['Crit DMG']],
    ['atk_speed', ['Attack Speed', 'Atk Speed']]
  ];

  function extractValue(text) {
    var idx = text.indexOf('+');
    if (idx < 0) { return null; }
    var rest = text.slice(idx + 1);
    if (!rest) { return null; }
    var numStr = rest.slice(0, -1).trim();
    var val = parseFloat(numStr);
    return isNaN(val) ? null : val;
  }

  function parseTrait(text) {
    if (!text) { return null; }
    var stripped = String(text).trim();
    if (!stripped || stripped.toLowerCase() === 'none') { return null; }
    var raw = extractValue(stripped);
    if (raw === null) { return null; }
    var low = stripped.toLowerCase();
    for (var i = 0; i < STAT_PATTERNS.length; i++) {
      var stat = STAT_PATTERNS[i][0];
      var keys = STAT_PATTERNS[i][1];
      for (var j = 0; j < keys.length; j++) {
        if (low.indexOf(keys[j].toLowerCase()) !== -1) {
          return { stat: stat, value: raw / 100.0 };
        }
      }
    }
    return null;
  }


  var TRAIT_STAT_DISPLAY = {
    lethality: { name: 'Lethality', group: 'simple', agg: 'sum' },
    crit_chance: { name: 'Crit Chance', group: 'simple', agg: 'sum' },
    crit_dmg: { name: 'Crit DMG', group: 'simple', agg: 'sum' },
    atk_speed: { name: 'Attack Speed', group: 'simple', agg: 'sum' },
    moon: { name: 'Moonboost', group: 'simple', agg: 'sum' },
    berserk: { name: 'Berserk', group: 'simple', agg: 'sum' },
    phys_dmg: { name: 'Physical DMG', group: 'berserk', agg: 'sum' },
    move_speed: { name: 'Movement Speed', group: 'berserk', agg: 'sum' },
    berserk_duration: { name: 'Berserk Duration', group: 'berserk', agg: 'max' },
    fire_dmg: { name: 'Fire DMG/s', group: 'fire', agg: 'sum' },
    fire_chance: { name: 'Fire Chance', group: 'fire', agg: 'max' },
    fire_duration: { name: 'Fire Duration', group: 'fire', agg: 'max' },
    explosion_dmg: { name: 'Explosion DMG', group: 'explosion', agg: 'sum' },
    explosion_chance: { name: 'Explosion Chance', group: 'explosion', agg: 'max' },
    poison_dmg: { name: 'Poison DMG/s', group: 'poison', agg: 'sum' },
    poison_chance: { name: 'Poison Chance', group: 'poison', agg: 'max' },
    poison_duration: { name: 'Poison Duration', group: 'poison', agg: 'max' },
    smite_dmg: { name: 'Smite DMG', group: 'smite', agg: 'sum' },
    smite_chance: { name: 'Smite Chance', group: 'smite', agg: 'max' },
    lightning_dmg: { name: 'Lightning DMG', group: 'lightning', agg: 'sum' },
    lightning_chance: { name: 'Lightning Chance', group: 'lightning', agg: 'max' },
    lightning_cooldown: { name: 'Lightning Cooldown', group: 'lightning', agg: 'min' },
    blackhole_dmg: { name: 'Black Hole DMG', group: 'blackhole', agg: 'sum' },
    blackhole_chance: { name: 'Black Hole Chance', group: 'blackhole', agg: 'max' },
    blackhole_radius: { name: 'Black Hole Radius', group: 'blackhole', agg: 'sum' }
  };

  var TRAIT_CLAIM_PATTERNS = {
    lethality: /Lethality/i,
    crit_chance: /Crit(?:ical)?\s*Chance/i,
    crit_dmg: /Crit(?:ical)?\s*Dam(?:age)?/i,
    atk_speed: /(?:Attack|Atk)\s*Speed/i,
    moon: /Moonboost/i,
    phys_dmg: /Physical\s*Damage/i,
    move_speed: /Movement\s*Speed.*(?:for\s*[\d.]+\s*s|HP\s*drops|below\s*35%|when\s*HP)/i,
    berserk_duration: /HP\s*drops\s*below|when\s*HP/i,
    fire_dmg: /fire|burn/i,
    fire_chance: /fire|burn/i,
    fire_duration: /fire|burn/i,
    explosion_dmg: /Explosion/i,
    explosion_chance: /Explosion/i,
    smite_dmg: /smite/i,
    smite_chance: /smite/i,
    poison_dmg: /poison/i,
    poison_chance: /poison/i,
    poison_duration: /poison/i,
    lightning_dmg: /chance\s*to\s*deal/i,
    lightning_chance: /chance\s*to\s*deal/i,
    lightning_cooldown: /chance\s*to\s*deal|cooldown/i,
    blackhole_dmg: /Black\s*Hole\s*Damage/i,
    blackhole_chance: /Black\s*Hole\s*Chance/i,
    blackhole_radius: /Black\s*Hole\s*Radius/i
  };

  var TRAIT_GROUP_ORDER = ['simple', 'berserk', 'fire', 'explosion', 'poison', 'smite', 'lightning', 'blackhole'];

  var TRAIT_GROUP_KEYS = {
    simple: ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed', 'moon', 'berserk'],
    berserk: ['phys_dmg', 'move_speed', 'berserk_duration'],
    fire: ['fire_dmg', 'fire_chance', 'fire_duration'],
    explosion: ['explosion_dmg', 'explosion_chance'],
    poison: ['poison_dmg', 'poison_chance', 'poison_duration'],
    smite: ['smite_dmg', 'smite_chance'],
    lightning: ['lightning_dmg', 'lightning_chance', 'lightning_cooldown'],
    blackhole: ['blackhole_dmg', 'blackhole_chance', 'blackhole_radius']
  };

  function isTraitClaimed(sub, ore) {
    if (!ore.stats) return false;
    var keys = Object.keys(ore.stats);
    for (var i = 0; i < keys.length; i++) {
      var pat = TRAIT_CLAIM_PATTERNS[keys[i]];
      if (pat && pat.test(sub)) return true;
    }
    return false;
  }

  function fmtPct(val) {
    var pct = val * 100;
    var sign = pct < -0.005 ? '-' : '+';
    var str = Math.abs(pct).toFixed(1);
    if (str.slice(-2) === '.0') str = str.slice(0, -2);
    return sign + str + '%';
  }

  function fmtDur(val) {
    var str = val.toFixed(1);
    if (str.slice(-2) === '.0') str = str.slice(0, -2);
    return str + 's';
  }

  function aggStat(agg, a, b) {
    if (agg === 'max') return Math.max(a, b);
    if (agg === 'min') return Math.min(a, b);
    return a + b;
  }

  function capNote(capped, key) {
    return capped && capped[key] !== undefined ? ' (capped)' : '';
  }

  function formatTraitGroup(group, merged, capped) {
    var keys = TRAIT_GROUP_KEYS[group];
    if (!keys) return '';
    var vals = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (merged[k] !== undefined && merged[k] !== 0) vals[k] = merged[k];
    }
    if (Object.keys(vals).length === 0) return '';
    var info = TRAIT_STAT_DISPLAY;

    if (group === 'simple') {
      var parts = [];
      for (var j = 0; j < keys.length; j++) {
        var sk = keys[j];
        if (vals[sk] !== undefined) {
          parts.push(fmtPct(vals[sk]) + ' ' + info[sk].name + capNote(capped, sk));
        }
      }
      return parts.join('\n');
    }

    if (group === 'berserk') {
      var pd = vals.phys_dmg || 0;
      var ms = vals.move_speed || 0;
      var bd = vals.berserk_duration !== undefined ? vals.berserk_duration : 0;
      return fmtPct(pd) + ' Physical DMG & ' + fmtPct(ms) + ' Movement Speed for ' + fmtDur(bd) + ' (when HP < 35%)';
    }

    if (group === 'fire') {
      var fd = vals.fire_dmg || 0;
      var fc = vals.fire_chance !== undefined ? vals.fire_chance : 0;
      var fdt = vals.fire_duration !== undefined ? vals.fire_duration : 0;
      return fmtPct(fd) + ' Fire DMG/s for ' + fmtDur(fdt) + ' (' + fmtPct(fc) + ' chance on hit)';
    }

    if (group === 'explosion') {
      var ed = vals.explosion_dmg || 0;
      var ec = vals.explosion_chance !== undefined ? vals.explosion_chance : 0;
      return fmtPct(ed) + ' Explosion DMG' + capNote(capped, 'explosion_dmg') + ' (' + fmtPct(ec) + ' chance)';
    }

    if (group === 'poison') {
      var pd2 = vals.poison_dmg || 0;
      var pc = vals.poison_chance !== undefined ? vals.poison_chance : 0;
      var pdt = vals.poison_duration !== undefined ? vals.poison_duration : 0;
      return fmtPct(pd2) + ' Poison DMG/s for ' + fmtDur(pdt) + ' (' + fmtPct(pc) + ' chance on hit)';
    }

    if (group === 'smite') {
      var sd = vals.smite_dmg || 0;
      var sc = vals.smite_chance !== undefined ? vals.smite_chance : 0;
      return fmtPct(sd) + ' Smite DMG' + capNote(capped, 'smite_dmg') + ' (' + fmtPct(sc) + ' chance on hit)';
    }

    if (group === 'lightning') {
      var ld = vals.lightning_dmg || 0;
      var lc = vals.lightning_chance !== undefined ? vals.lightning_chance : 0;
      var lco = vals.lightning_cooldown !== undefined ? vals.lightning_cooldown : 0;
      return fmtPct(ld) + ' Lightning DMG (' + fmtPct(lc) + ' chance, ' + fmtDur(lco) + ' cooldown)';
    }

    if (group === 'blackhole') {
      var bd2 = vals.blackhole_dmg || 0;
      var bc = vals.blackhole_chance !== undefined ? vals.blackhole_chance : 0;
      var br = vals.blackhole_radius || 0;
      var bhParts = [];
      if (bc) { bhParts.push(fmtPct(bc) + ' chance'); }
      if (br) { bhParts.push(fmtPct(br) + ' radius'); }
      return fmtPct(bd2) + ' Black Hole DMG' + (bhParts.length ? ' (' + bhParts.join(', ') + ')' : '');
    }

    return '';
  }

  var TRAIT_PREFIX_RE = /^(Both|Armor\s*only|Weapons\s*only|\(Armor\s*only\))\s*:\s*/i;
  var PERCENT_CLAUSE_RE = /^([+-]?\d+(?:\.\d+)?)\s*%\s*(.+)$/;

  function splitTraitClauses(text) {
    if (!text) { return []; }
    var cleaned = text.replace(/\n/g, ' | ');
    var subs = cleaned.split(/\s*\|\s*/);
    var out = [];
    for (var i = 0; i < subs.length; i++) {
      var sub = subs[i].replace(TRAIT_PREFIX_RE, '').trim();
      if (sub) { out.push(sub); }
    }
    return out;
  }

  function parsePercentClause(clause) {
    var m = PERCENT_CLAUSE_RE.exec(clause);
    if (!m) { return null; }
    return { value: parseFloat(m[1]), rawLabel: m[2].trim(), label: m[2].trim().toLowerCase() };
  }

  function addTraitValue(merged, key, val) {
    if (!val) { return; }
    var info = TRAIT_STAT_DISPLAY[key];
    merged[key] = merged[key] === undefined ? val : aggStat(info.agg, merged[key], val);
  }

  var NON_WEAPON_TRAIT_RE = /vitality|swiftness|endurance|stamina|movement\s*speed|regen|health|jump|stride|damage\s*reduction|heal/i;

  function collectOreTraits(slots, shares, game, merged) {
    var extras = [];

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore || share < SHARE_GATE) continue;
      var ore = game._ore_index.get(slot.name);
      if (!ore || !ore.is_weapon) continue;

      if (ore.stats) {
        var statKeys = Object.keys(ore.stats);
        for (var j = 0; j < statKeys.length; j++) {
          var sk = statKeys[j];
          var info = TRAIT_STAT_DISPLAY[sk];
          if (!info) continue;
          var val = scaleRange(ore.stats[sk], share);
          merged[sk] = merged[sk] === undefined ? val : aggStat(info.agg, merged[sk], val);
        }
      }

      var subs10 = splitTraitClauses(ore.trait10);
      var subs30 = splitTraitClauses(ore.trait30);
      var subs = share >= 0.3 ? subs30 : subs10;
      if (!subs.length) continue;

      for (var k = 0; k < subs.length; k++) {
        var sub = subs[k];
        if (isTraitClaimed(sub, ore)) continue;

        if (share < 0.3 && subs30[k] !== sub) {
          var parsed10 = parsePercentClause(sub);
          var parsed30 = subs30[k] !== undefined ? parsePercentClause(subs30[k]) : null;
          if (parsed10 && parsed30 && parsed10.label === parsed30.label) {
            var ramped = scaleRange({ base: parsed10.value, max: parsed30.value, divisor: 100 }, share);
            extras.push(fmtPct(ramped) + ' ' + parsed10.rawLabel);
          } else {
            var power = Math.min(
              Math.max((share - SHARE_GATE) * TRAIT_POWER_SLOPE + TRAIT_POWER_FLOOR, TRAIT_POWER_FLOOR),
              1.0
            );
            extras.push('[' + (power * 100).toFixed(1) + '% power] ' + sub);
          }
        } else {
          extras.push(sub);
        }
      }
    }
    return extras.filter(function (line) { return !NON_WEAPON_TRAIT_RE.test(line); });
  }

  var TRAIT_CAPS = {
    lethality: CAPS.lethality,
    crit_chance: CAPS.crit_chance,
    crit_dmg: CAPS.crit_dmg,
    atk_speed: CAPS.atk_speed,
    explosion_dmg: EXPLOSION_DMG_CAP,
    smite_dmg: SMITE_DMG_CAP,
    moon: MOON_CAP
  };

  function cappedTraits(merged, afterCap) {
    var capped = {};
    Object.keys(TRAIT_CAPS).forEach(function (key) {
      if (merged[key] === undefined) { return; }
      var extra = (afterCap && afterCap[key]) || 0;
      if (merged[key] - extra > TRAIT_CAPS[key] + 1e-9) { capped[key] = TRAIT_CAPS[key] + extra; }
    });
    return capped;
  }

  function traitLines(merged, extras, afterCap) {
    var capped = cappedTraits(merged, afterCap);
    var shown = {};
    Object.keys(merged).forEach(function (key) { shown[key] = capped[key] !== undefined ? capped[key] : merged[key]; });
    var parts = [];
    for (var g = 0; g < TRAIT_GROUP_ORDER.length; g++) {
      var fmt = formatTraitGroup(TRAIT_GROUP_ORDER[g], shown, capped);
      if (fmt) { parts = parts.concat(fmt.split('\n')); }
    }
    return parts.concat(extras);
  }

  function weaponTraitLines(slots, game) {
    var clean = mergeSlots((slots || []).map(function (s) {
      return { name: s.name, amount: Math.max(0, Math.floor(Number(s.amount) || 0)) };
    }), game.select_ore);
    var merged = {};
    var extras = collectOreTraits(clean, slotShares(clean), game, merged);
    return traitLines(merged, extras);
  }

  var GOLEMITE_TRAIT_KEYS = {
    lethality: 'lethality', crit_chance: 'crit_chance', crit_dmg: 'crit_dmg', atk_speed: 'atk_speed', moon: 'moon',
    fire_dmg: 'fire_dmg', fire_chance: 'fire_chance', fire_time: 'fire_duration',
    poison_dmg: 'poison_dmg', poison_chance: 'poison_chance', poison_time: 'poison_duration',
    lightning_dmg: 'lightning_dmg', lightning_chance: 'lightning_chance', lightning_cooldown: 'lightning_cooldown',
    blast_dmg: 'explosion_dmg', blast_chance: 'explosion_chance',
    smite_dmg: 'smite_dmg', smite_chance: 'smite_chance',
    blackhole_dmg: 'blackhole_dmg', blackhole_chance: 'blackhole_chance', resonance_dmg: 'blackhole_dmg'
  };

  var ABILITY_TRAIT_KEYS = {
    fire_dmg: 'fire_dmg', fire_chance: 'fire_chance', fire_time: 'fire_duration',
    poison_dmg: 'poison_dmg', poison_chance: 'poison_chance', poison_time: 'poison_duration',
    lightning_dmg: 'lightning_dmg', lightning_chance: 'lightning_chance', lightning_cooldown: 'lightning_cooldown',
    blast_dmg: 'explosion_dmg', blast_chance: 'explosion_chance'
  };

  var GOLEMITE_AFTER_CAP_KEYS = ['smite_dmg', 'moon'];

  function addAfterCap(merged, afterCap, key, val) {
    if (!val) { return; }
    addTraitValue(merged, key, val);
    afterCap[key] = (afterCap[key] || 0) + val;
  }

  function addMappedTraits(merged, source, keyMap, afterCap, afterCapKeys) {
    if (!source) { return; }
    Object.keys(keyMap).forEach(function (field) {
      var key = keyMap[field];
      var val = Number(source[field]) || 0;
      if (afterCap && afterCapKeys && afterCapKeys.indexOf(key) !== -1) {
        addAfterCap(merged, afterCap, key, val);
      } else {
        addTraitValue(merged, key, val);
      }
    });
  }

  function fmtPlainPct(val) {
    return fmtPct(val).replace(/^\+/, '');
  }

  function raceTraits(build, game, merged, afterCap) {
    var race = build.race;
    var cls = race + ',' + build.bonus_weapon_type;
    var extras = [];

    addTraitValue(merged, 'lethality', raceValue(RACE_LETHALITY, race) + raceValue(CLASS_LETHALITY, cls));
    addAfterCap(merged, afterCap, 'lethality', raceValue(UNCAPPED_RACE_LETHALITY, race) + raceValue(UNCAPPED_CLASS_LETHALITY, cls));
    addTraitValue(merged, 'atk_speed', raceValue(RACE_ATK_SPEED, race) + raceValue(CLASS_ATK_SPEED, cls));
    addAfterCap(merged, afterCap, 'atk_speed', raceValue(UNCAPPED_RACE_ATK_SPEED, race) + raceValue(UNCAPPED_CLASS_ATK_SPEED, cls));
    addAfterCap(merged, afterCap, 'crit_dmg', raceValue(UNCAPPED_RACE_CRIT_DMG, race));
    addTraitValue(merged, 'fire_dmg', raceValue(RACE_FIRE_DMG, race));
    addTraitValue(merged, 'fire_chance', raceValue(RACE_FIRE_CHANCE, race));
    addTraitValue(merged, 'fire_duration', raceValue(RACE_FIRE_TIME, race));
    addTraitValue(merged, 'smite_dmg', raceValue(RACE_SMITE_DMG, race));
    addTraitValue(merged, 'smite_chance', raceValue(RACE_SMITE_CHANCE, race));

    if (race === 'Dryad' && build.dryad_in_grove) {
      addAfterCap(merged, afterCap, 'crit_chance', DRYAD_GROVE_CRIT_CHANCE);
      addAfterCap(merged, afterCap, 'crit_dmg', DRYAD_GROVE_CRIT_DMG);
    }
    var tdm = traitDamageMultiplier(build);
    if (tdm > 1) {
      extras.push(fmtPct(tdm - 1) + ' Fire, Poison, Lightning & Black Hole DMG (Vital Power)');
    }
    if (race === 'Orc Lord') {
      var missing = Math.min(1.0, Math.max(0.0, build.orc_lord_hp_missing));
      addAfterCap(merged, afterCap, 'lethality', Math.floor(missing * 10 + 1e-6) * ORC_LORD_WARBRINGER_PER_TENTH);
      var stacks = Math.min(ORC_LORD_LORD_OF_WAR_MAX_STACKS, Math.max(0, Math.floor(build.orc_lord_kill_stacks)));
      addAfterCap(merged, afterCap, 'atk_speed', stacks * ORC_LORD_LORD_OF_WAR_PER_STACK);
      extras.push('Smash: ' + fmtPlainPct(RACE_SMASH_DMG[race]) + ' DMG (' + fmtPlainPct(RACE_SMASH_CHANCE[race])
        + ' chance, ' + fmtDur(RACE_SMASH_COOLDOWN[race]) + ' cooldown)');
    }
    if (RACE_FOX_CLAWS_DMG[race]) {
      extras.push('Fox Claws: ' + fmtPlainPct(RACE_FOX_CLAWS_DMG[race]) + ' DMG (' + fmtPlainPct(RACE_FOX_CLAWS_CHANCE[race])
        + ' chance, up to ' + FOX_CLAWS_SPIRITS + ' spirits)');
    }
    if (RACE_FOXFIRE_DMG[race]) {
      extras.push('Foxfire: ' + fmtPlainPct(RACE_FOXFIRE_DMG[race]) + ' DMG (' + fmtPlainPct(RACE_FOXFIRE_CHANCE[race])
        + ' chance, ' + fmtDur(RACE_FOXFIRE_TIME[race]) + ')');
    }
    if (race === 'Archangel') {
      extras.push('Archangel Smite: ' + fmtPlainPct(ARCHANGEL_SMITE_DMG) + ' DMG (' + fmtPlainPct(ARCHANGEL_SMITE_CHANCE)
        + ' chance, ' + fmtDur(ARCHANGEL_SMITE_COOLDOWN) + ' cooldown)');
    }
    if (race === 'Demon') {
      extras.push('Cursed Aura: ' + fmtPlainPct(DEMON_CURSED_AURA_DMG) + ' weapon DMG/s');
    }
    if (RACE_DARK_SMITE_DMG[race]) {
      extras.push('Dark Smite: ' + fmtPlainPct(RACE_DARK_SMITE_DMG[race]) + ' DMG (' + fmtPlainPct(RACE_DARK_SMITE_CHANCE[race]) + ' chance)');
    }
    var weapon = game._weapon_index ? game._weapon_index.get(build.weapon_name) : null;
    var trident = TRIDENT_TOSS[race + ',' + (weapon && weapon.type ? weapon.type : '')];
    if (trident) {
      extras.push('Trident Toss: ' + fmtPlainPct(trident[0]) + ' DMG (every ' + fmtDur(trident[2]) + ')');
    }
    return extras;
  }

  function activeTraits(build, shares, game) {
    var merged = {};
    var afterCap = {};
    var extras = collectOreTraits(build.slots, shares, game, merged);

    (build.golemites || []).forEach(function (g) {
      addMappedTraits(merged, g, GOLEMITE_TRAIT_KEYS, afterCap, GOLEMITE_AFTER_CAP_KEYS);
    });
    (build.golemites || []).forEach(function (g) { extras = extras.concat(golemiteSpecialLines(g)); });
    addMappedTraits(merged, build.abilities, ABILITY_TRAIT_KEYS);
    (build.rune_cells || []).forEach(function (cell) {
      var rune = parseTrait(cell);
      if (rune) { addTraitValue(merged, rune.stat, rune.value); }
    });
    var ach = parseTrait(build.achievement);
    if (ach) { addTraitValue(merged, ach.stat, ach.value); }
    var armorSetTraits = armorSetBonus(build, game);
    addTraitValue(merged, 'lethality', (build.armor_lethality || 0) + armorSetTraits.lethality);
    addTraitValue(merged, 'atk_speed', armorSetTraits.atk_speed);
    addTraitValue(merged, 'crit_chance', build.armor_crit_chance || 0);
    addTraitValue(merged, 'crit_dmg', build.armor_crit_dmg || 0);
    addTraitValue(merged, 'berserk', Math.min(build.berserk || 0, CAPS.berserk) + raceValue(RACE_BERSERK, build.race));
    extras = extras.concat(raceTraits(build, game, merged, afterCap));

    var parts = traitLines(merged, extras, afterCap);
    return parts.length ? parts.join('\n') : 'No active traits';
  }

  function oreStatSum(slots, shares, game, stat) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      if (rng.gated !== false && share < SHARE_GATE) { continue; }
      total += scaleRange(rng, share);
    }
    return total;
  }

  function runeTotals(runeCells) {
    var totals = { lethality: 0.0, crit_chance: 0.0, crit_dmg: 0.0, atk_speed: 0.0 };
    for (var i = 0; i < runeCells.length; i++) {
      var parsed = parseTrait(runeCells[i]);
      if (parsed) { totals[parsed.stat] += parsed.value; }
    }
    return totals;
  }

  function raceValue(table, race) {
    return table[race] !== undefined ? table[race] : 0.0;
  }

  function oreShare(slots, shares, name) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) { if (slots[i].name === name) { total += shares[i]; } }
    return total;
  }

  function roundHalfUp(value, digits) {
    var scale = Math.pow(10, digits);
    return Math.floor(Math.abs(value) * scale + 0.5) / scale * (value >= 0 ? 1 : -1);
  }

  function gameChance(chance, exists) {
    if (!exists) { return 0.0; }
    return Math.min(1.0, (Math.floor(roundHalfUp(chance * 100, 2)) + 1) / PROC_ROLL_SIDES);
  }

  function golemiteValues(build, field) {
    return build.golemites.map(function (g) { return g[field]; });
  }

  function golemiteSum(build, field) {
    return golemiteValues(build, field).reduce(function (a, b) { return a + b; }, 0.0);
  }

  function golemiteDamage(level, unforged) {
    if (level < GOLEMITE_MIN_LEVEL) { return 0.0; }
    var steps = Math.min(GOLEMITE_MAX_LEVEL, level) - GOLEMITE_MIN_LEVEL;
    return unforged * (GOLEMITE_BASE_DMG + steps * (GOLEMITE_DMG_RAMP / GOLEMITE_RAMP_LEVELS));
  }

  function golemiteRarity(slots, game) {
    var rarities = game.ore_rarity || {};
    var best = -1;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!(slot.amount > 0) || slot.name === game.select_ore) { continue; }
      var rank = GOLEMITE_RARITY_ORDER.indexOf(rarities[slot.name]);
      if (rank > best) { best = rank; }
    }
    return best < 0 ? null : GOLEMITE_RARITY_ORDER[best];
  }

  function oreAmount(slots, name) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) { if (slots[i].name === name) { total += slots[i].amount; } }
    return total;
  }

  function deriveGolemiteStats(rawSlots, game) {
    var slots = mergeSlots((rawSlots || []).map(function (s) {
      return { name: s.name, amount: Math.max(0, Math.floor(Number(s.amount) || 0)) };
    }), game.select_ore);
    var stats = {};
    GOLEMITE_FIELDS.forEach(function (f) { if (f !== 'level') { stats[f] = 0.0; } });
    var rarity = golemiteRarity(slots, game);
    if (!rarity) { return { rarity: null, scaling: 0.0, stats: stats, special: {} }; }
    var k = GOLEMITE_TRAIT_SCALING[rarity];
    var shares = slotShares(slots);
    var hasGalaxite = oreAmount(slots, 'Galaxite') > 0;
    var cooldowns = slotVals(slots, shares, game, 'lightning_cooldown');

    stats.lethality = oreStatSum(slots, shares, game, 'lethality') * k;
    stats.crit_chance = oreStatSum(slots, shares, game, 'crit_chance') * k;
    stats.crit_dmg = oreStatSum(slots, shares, game, 'crit_dmg') * k;
    stats.atk_speed = oreStatSum(slots, shares, game, 'atk_speed') * k;
    stats.fire_dmg = slotSum(slots, shares, game, 'fire_dmg') * k;
    stats.fire_chance = slotMax(slots, shares, game, 'fire_chance') * k;
    stats.fire_time = slotMax(slots, shares, game, 'fire_duration');
    stats.poison_dmg = slotSum(slots, shares, game, 'poison_dmg') * k;
    stats.poison_chance = slotMax(slots, shares, game, 'poison_chance') * k;
    stats.poison_time = slotMax(slots, shares, game, 'poison_duration');
    stats.lightning_dmg = slotSum(slots, shares, game, 'lightning_dmg') * k;
    stats.lightning_chance = slotMax(slots, shares, game, 'lightning_chance') * k;
    stats.lightning_cooldown = cooldowns.length ? Math.min.apply(null, cooldowns) : 0.0;
    stats.blast_dmg = Math.min(EXPLOSION_DMG_CAP, slotSum(slots, shares, game, 'explosion_dmg')) * k;
    stats.blast_chance = slotMax(slots, shares, game, 'explosion_chance') * k;
    stats.smite_dmg = Math.min(SMITE_DMG_CAP, slotSum(slots, shares, game, 'smite_dmg')) * k;
    stats.smite_chance = slotMax(slots, shares, game, 'smite_chance') * k;
    stats.blackhole_dmg = slotSum(slots, shares, game, 'blackhole_dmg') * k;
    stats.blackhole_chance = hasGalaxite ? BLACKHOLE_CHANCE * k : 0.0;
    stats.resonance_dmg = hasGalaxite && oreShare(slots, shares, PRISMATIC_SHIFT_ORE) >= SHARE_GATE ? GALAXITE_BISMUTH_WAVE * k : 0.0;
    stats.moon = Math.min(MOON_CAP, slotSum(slots, shares, game, 'moon')) * k;
    var hasEchotite = slots.some(function (slot, i) { return slot.name === REVERBERATION_ORE && shares[i] >= SHARE_GATE; });
    stats.reverberation_chance = hasEchotite ? REVERBERATION_DEFAULT_CHANCE * k : 0.0;
    stats.frost_slash_dmg = slotSum(slots, shares, game, 'frost_slash_dmg') * k;
    stats.frost_slash_chance = slotMax(slots, shares, game, 'frost_slash_chance') * k;
    stats.glacier_dmg = slotSum(slots, shares, game, 'glacier_dmg') * k;
    stats.glacier_chance = slotMax(slots, shares, game, 'glacier_chance') * k;
    stats.starfall_dmg = slotSum(slots, shares, game, 'starfall_dmg') * (hasGalaxite ? STARFALL_GALAXITE_MULT : 1.0) * k;
    stats.starfall_chance = slotMax(slots, shares, game, 'starfall_chance') * k;
    stats.starfall_cooldown = stats.starfall_dmg > 0 && hasFrostStarShare(slots, shares) ? STARFALL_COOLDOWN : 0.0;
    stats.stellar_mark_dmg = slotSum(slots, shares, game, 'stellar_mark_dmg') * k;
    stats.ancient_poison_dmg = slotSum(slots, shares, game, 'ancient_poison_dmg') * k;
    stats.ancient_poison_chance = slotMax(slots, shares, game, 'ancient_poison_chance') * k;
    stats.ancient_poison_duration = slotMax(slots, shares, game, 'ancient_poison_duration');
    return { rarity: rarity, scaling: k, stats: stats };
  }

  function golemiteSpecialLines(stats) {
    var sp = stats || {};
    var lines = [];
    function pct(key) { return fmtPlainPct(Number(sp[key]) || 0); }
    if (sp.reverberation_chance > 0) {
      lines.push('Reverberation: ' + pct('reverberation_chance') + ' chance to hit twice');
    }
    if (sp.frost_slash_dmg > 0) {
      lines.push('Frost Slash: ' + pct('frost_slash_dmg') + ' DMG (' + pct('frost_slash_chance') + ' chance)');
    }
    if (sp.glacier_dmg > 0) {
      lines.push('Glacier Explosion: ' + pct('glacier_dmg') + ' DMG (' + pct('glacier_chance') + ' chance on crit)');
    }
    if (sp.starfall_dmg > 0) {
      lines.push('Starfall: ' + pct('starfall_dmg') + ' DMG (' + pct('starfall_chance') + ' chance, '
        + fmtDur(Number(sp.starfall_cooldown) || 0) + ' cooldown)');
    }
    if (sp.stellar_mark_dmg > 0) {
      lines.push('Stellar Mark: ' + pct('stellar_mark_dmg') + ' DMG every ' + STELLAR_MARK_HITS + ' hits');
    }
    if (sp.ancient_poison_dmg > 0) {
      lines.push('Ancient Poison: +' + pct('ancient_poison_dmg') + ' Poison DMG (' + pct('ancient_poison_chance') + ' chance, '
        + fmtDur(Number(sp.ancient_poison_duration) || 0) + ')');
    }
    return lines;
  }

  function hasFrostStarShare(slots, shares) {
    return slots.some(function (slot, i) { return slot.name === STARFALL_ORE && shares[i] >= SHARE_GATE; });
  }

  function traitDamageMultiplier(build) {
    if (build.race !== 'Dryad') { return 1.0; }
    var steps = Math.min(Math.floor(Math.max(0, build.dryad_max_hp) / DRYAD_VITAL_POWER_STEP_HP), DRYAD_VITAL_POWER_MAX_STEPS);
    return 1.0 + steps * DRYAD_VITAL_POWER_PER_STEP;
  }

  function armorSetFraction(count, pieces) {
    return pieces ? Math.min(count, pieces) / pieces : 0.0;
  }

  function armorSetBonus(build, game) {
    var weapon = game._weapon_index ? game._weapon_index.get(build.weapon_name) : null;
    var bonus = { lethality: 0.0, atk_speed: 0.0 };
    if (!weapon) { return bonus; }
    var worn = [build.armor_helmet, build.armor_chestplate, build.armor_leggings];
    var weaponClasses = weapon.classes || [];
    Object.keys(ARMOR_SETS).forEach(function (name) {
      var set = ARMOR_SETS[name];
      var matches = set.types.indexOf(weapon.type) !== -1
        || weaponClasses.some(function (c) { return set.classes.indexOf(c) !== -1; });
      if (!matches) { return; }
      var count = worn.filter(function (w) { return w === name; }).length;
      var fraction = armorSetFraction(count, set.pieces);
      bonus.lethality += set.lethality * fraction;
      bonus.atk_speed += set.atk_speed * fraction;
    });
    return bonus;
  }

  function statTotals(build, game, oreContribs) {
    var runes = runeTotals(build.rune_cells);
    var ach = parseTrait(build.achievement);
    var achStat = ach ? ach.stat : null;
    var achValue = ach ? ach.value : 0.0;
    var race = build.race;
    var cls = build.race + ',' + build.bonus_weapon_type;
    var inGrove = race === 'Dryad' && build.dryad_in_grove;
    var setBonus = armorSetBonus(build, game);

    var lethality = oreContribs.lethality
      + build.armor_lethality
      + setBonus.lethality
      + (build.training_day ? TRAINING_DAY_LETHALITY : 0.0)
      + golemiteSum(build, 'lethality')
      + runes.lethality
      + build.base_lethality
      + raceValue(RACE_LETHALITY, race)
      + raceValue(CLASS_LETHALITY, cls)
      + (achStat === 'lethality' ? achValue : 0.0);
    var warbringer = 0.0;
    if (race === 'Orc Lord') {
      var missing = Math.min(1.0, Math.max(0.0, build.orc_lord_hp_missing));
      warbringer = Math.floor(missing * 10 + 1e-6) * ORC_LORD_WARBRINGER_PER_TENTH;
    }

    var crit_chance = oreContribs.crit_chance
      + build.armor_crit_chance
      + golemiteSum(build, 'crit_chance')
      + runes.crit_chance
      + (achStat === 'crit_chance' ? achValue : 0.0);

    var crit_dmg = oreContribs.crit_dmg + build.armor_crit_dmg + golemiteSum(build, 'crit_dmg') + runes.crit_dmg;

    var atk_speed = oreContribs.atk_speed
      + golemiteSum(build, 'atk_speed')
      + setBonus.atk_speed
      + (build.training_day ? TRAINING_DAY_ATK_SPEED : 0.0)
      + runes.atk_speed
      + raceValue(RACE_ATK_SPEED, race)
      + raceValue(CLASS_ATK_SPEED, cls)
      + (achStat === 'atk_speed' ? achValue : 0.0);
    var lordOfWar = 0.0;
    if (race === 'Orc Lord') {
      var stacks = Math.min(ORC_LORD_LORD_OF_WAR_MAX_STACKS, Math.max(0, Math.floor(build.orc_lord_kill_stacks)));
      lordOfWar = stacks * ORC_LORD_LORD_OF_WAR_PER_STACK;
    }

    return {
      lethality: Math.min(lethality, CAPS.lethality)
        + raceValue(UNCAPPED_RACE_LETHALITY, race)
        + raceValue(UNCAPPED_CLASS_LETHALITY, cls)
        + warbringer,
      crit_chance: Math.min(crit_chance, CAPS.crit_chance) + (inGrove ? DRYAD_GROVE_CRIT_CHANCE : 0.0),
      crit_dmg: Math.min(crit_dmg, CAPS.crit_dmg)
        + raceValue(UNCAPPED_RACE_CRIT_DMG, race)
        + (inGrove ? DRYAD_GROVE_CRIT_DMG : 0.0),
      atk_speed: Math.min(atk_speed, CAPS.atk_speed)
        + raceValue(UNCAPPED_RACE_ATK_SPEED, race)
        + raceValue(UNCAPPED_CLASS_ATK_SPEED, cls)
        + lordOfWar
    };
  }

  function calcOreContributions(slots, shares, game) {
    var contribs = {};
    for (var i = 0; i < CORE_STATS.length; i++) {
      contribs[CORE_STATS[i]] = oreStatSum(slots, shares, game, CORE_STATS[i]);
    }
    return contribs;
  }

  function slotVals(slots, shares, game, stat) {
    var vals = [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      if (rng.gated !== false && share < SHARE_GATE) { continue; }
      vals.push(scaleRange(rng, share));
    }
    return vals;
  }

  function maxOf(vals) {
    var m = 0.0;
    for (var i = 0; i < vals.length; i++) { if (vals[i] > m) { m = vals[i]; } }
    return m;
  }

  function slotMax(slots, shares, game, stat) {
    return maxOf(slotVals(slots, shares, game, stat));
  }

  function slotSum(slots, shares, game, stat) {
    var vals = slotVals(slots, shares, game, stat);
    var total = 0.0;
    for (var i = 0; i < vals.length; i++) { total += vals[i]; }
    return total;
  }

  function dotDuration(dmg, terms, range) {
    if (dmg <= 0) { return 0.0; }
    return Math.min(range[1], Math.max(range[0], maxOf(terms)));
  }

  function procComponents(build, shares, game) {
    var ab = build.abilities;
    var race = build.race;
    var names = build.slots.map(function (s) { return s.name; });
    var golemiteBlackholeSource = golemiteValues(build, 'blackhole_dmg').some(function (v) { return v > 0; });
    var bismuthActive = oreShare(build.slots, shares, PRISMATIC_SHIFT_ORE) >= SHARE_GATE;
    var resonance = 0.0;
    if (names.indexOf('Galaxite') !== -1 || golemiteBlackholeSource) {
      resonance = golemiteSum(build, 'resonance_dmg') + (bismuthActive ? GALAXITE_BISMUTH_WAVE : 0.0);
    }
    var galaxiteAmount = 0.0;
    build.slots.forEach(function (s) { if (s.name === 'Galaxite') { galaxiteAmount += s.amount; } });

    var fireDmg = slotSum(build.slots, shares, game, 'fire_dmg') + raceValue(RACE_FIRE_DMG, race) + ab.fire_dmg
      + golemiteSum(build, 'fire_dmg');
    var poisonDmg = slotSum(build.slots, shares, game, 'poison_dmg') + ab.poison_dmg + golemiteSum(build, 'poison_dmg');
    var lightningDmg = slotSum(build.slots, shares, game, 'lightning_dmg') + ab.lightning_dmg
      + golemiteSum(build, 'lightning_dmg');
    var cooldowns = slotVals(build.slots, shares, game, 'lightning_cooldown');
    if (ab.lightning_cooldown) { cooldowns.push(ab.lightning_cooldown); }
    var golemiteCooldowns = golemiteValues(build, 'lightning_cooldown').filter(function (cd) { return cd; });
    var lightningCooldown = 0.0;
    if (lightningDmg > 0) {
      lightningCooldown = cooldowns.length
        ? Math.min.apply(null, cooldowns.concat(golemiteCooldowns))
        : DEFAULT_LIGHTNING_COOLDOWN;
    }

    var reverberation = 0.0;
    build.slots.forEach(function (s, i) {
      if (s.name === REVERBERATION_ORE && shares[i] >= SHARE_GATE) {
        var chance = Object.prototype.hasOwnProperty.call(REVERBERATION_CHANCE, build.bonus_weapon_type)
          ? REVERBERATION_CHANCE[build.bonus_weapon_type] : REVERBERATION_DEFAULT_CHANCE;
        reverberation = Math.max(reverberation, chance);
      }
    });
    var starfallDmg = slotSum(build.slots, shares, game, 'starfall_dmg') + golemiteSum(build, 'starfall_dmg');
    var starfallCooldowns = [];
    build.slots.forEach(function (slot, i) {
      if (slot.name === STARFALL_ORE && shares[i] >= SHARE_GATE) { starfallCooldowns.push(STARFALL_COOLDOWN); }
    });
    golemiteValues(build, 'starfall_cooldown').forEach(function (cd) { if (cd) { starfallCooldowns.push(cd); } });
    var stellarMarkDmg = slotSum(build.slots, shares, game, 'stellar_mark_dmg') + golemiteSum(build, 'stellar_mark_dmg');

    return {
      moon: Math.min(MOON_CAP, slotSum(build.slots, shares, game, 'moon')) + golemiteSum(build, 'moon'),
      explosion_dmg: Math.min(EXPLOSION_DMG_CAP, slotSum(build.slots, shares, game, 'explosion_dmg') + ab.blast_dmg
        + golemiteSum(build, 'blast_dmg')),
      explosion_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'explosion_chance'), ab.blast_chance]
        .concat(golemiteValues(build, 'blast_chance'))),
      fire_dmg: fireDmg,
      fire_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'fire_chance'), ab.fire_chance,
        raceValue(RACE_FIRE_CHANCE, race)].concat(golemiteValues(build, 'fire_chance'))),
      fire_duration: dotDuration(fireDmg,
        slotVals(build.slots, shares, game, 'fire_duration').concat([raceValue(RACE_FIRE_TIME, race), ab.fire_time])
          .concat(golemiteValues(build, 'fire_time')),
        FIRE_TIME_RANGE),
      poison_dmg: poisonDmg,
      poison_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'poison_chance'), ab.poison_chance]
        .concat(golemiteValues(build, 'poison_chance'))),
      poison_duration: dotDuration(poisonDmg,
        slotVals(build.slots, shares, game, 'poison_duration').concat([ab.poison_time])
          .concat(golemiteValues(build, 'poison_time')),
        POISON_TIME_RANGE),
      smite_dmg: Math.min(SMITE_DMG_CAP, slotSum(build.slots, shares, game, 'smite_dmg') + raceValue(RACE_SMITE_DMG, race))
        + golemiteSum(build, 'smite_dmg'),
      smite_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'smite_chance'), raceValue(RACE_SMITE_CHANCE, race)]
        .concat(golemiteValues(build, 'smite_chance'))),
      blackhole_dmg: slotSum(build.slots, shares, game, 'blackhole_dmg') + resonance + golemiteSum(build, 'blackhole_dmg'),
      blackhole_chance: Math.max.apply(null, [galaxiteAmount > 0 ? BLACKHOLE_CHANCE : 0.0]
        .concat(golemiteValues(build, 'blackhole_chance'))),
      lightning_dmg: lightningDmg,
      lightning_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'lightning_chance'), ab.lightning_chance]
        .concat(golemiteValues(build, 'lightning_chance'))),
      lightning_cooldown: lightningCooldown,
      smash_dmg: raceValue(RACE_SMASH_DMG, race),
      smash_cooldown: raceValue(RACE_SMASH_COOLDOWN, race),
      smash_chance: raceValue(RACE_SMASH_CHANCE, race),
      fox_claws_dmg: raceValue(RACE_FOX_CLAWS_DMG, race),
      fox_claws_chance: raceValue(RACE_FOX_CLAWS_CHANCE, race),
      foxfire_dmg: raceValue(RACE_FOXFIRE_DMG, race),
      foxfire_chance: raceValue(RACE_FOXFIRE_CHANCE, race),
      foxfire_duration: raceValue(RACE_FOXFIRE_TIME, race),
      reverberation_chance: Math.max.apply(null, [reverberation].concat(golemiteValues(build, 'reverberation_chance'))),
      frost_slash_dmg: slotSum(build.slots, shares, game, 'frost_slash_dmg') + golemiteSum(build, 'frost_slash_dmg'),
      frost_slash_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'frost_slash_chance')].concat(golemiteValues(build, 'frost_slash_chance'))),
      glacier_dmg: slotSum(build.slots, shares, game, 'glacier_dmg') + golemiteSum(build, 'glacier_dmg'),
      glacier_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'glacier_chance')].concat(golemiteValues(build, 'glacier_chance'))),
      starfall_dmg: starfallDmg,
      starfall_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'starfall_chance')].concat(golemiteValues(build, 'starfall_chance'))),
      starfall_cooldown: starfallDmg > 0 && starfallCooldowns.length ? Math.min.apply(null, starfallCooldowns) : 0.0,
      stellar_mark_dmg: stellarMarkDmg,
      stellar_mark_hits: stellarMarkDmg > 0 ? STELLAR_MARK_HITS : 0.0,
      ancient_poison_dmg: slotSum(build.slots, shares, game, 'ancient_poison_dmg') + golemiteSum(build, 'ancient_poison_dmg'),
      ancient_poison_chance: Math.max.apply(null, [slotMax(build.slots, shares, game, 'ancient_poison_chance')].concat(golemiteValues(build, 'ancient_poison_chance'))),
      ancient_poison_duration: Math.max.apply(null, [slotMax(build.slots, shares, game, 'ancient_poison_duration')].concat(golemiteValues(build, 'ancient_poison_duration')))
    };
  }

  function dotTickRate(chance, atkRate, duration, tickOffset) {
    var procRate = chance * atkRate;
    if (procRate <= 0 || duration <= 0) { return 0.0; }
    var refreshGain = procRate * duration / 2;
    if (refreshGain >= 1) { return 1.0; }
    var episode = duration / (1 - refreshGain);
    var ticks = Math.max(0.0, episode + tickOffset);
    return Math.min(1.0, ticks / (episode + 1 / procRate));
  }

  function cooldownRate(chance, atkRate, cooldown) {
    if (chance <= 0 || atkRate <= 0) { return 0.0; }
    var hitsToReady = Math.max(1, Math.ceil(cooldown * atkRate - COOLDOWN_EPSILON));
    return atkRate / (hitsToReady + 1 / chance - 1);
  }

  function prismaticShiftDps(hit, atkRate, tdm) {
    if (hit <= 0 || atkRate <= 0) { return 0.0; }
    var poison = hit * PRISMATIC_POISON[0] * tdm
      * dotTickRate(gameChance(PRISMATIC_POISON[1], true), atkRate, PRISMATIC_POISON[2], POISON_TICK_OFFSET);
    var explosion = hit * PRISMATIC_EXPLOSION[0] * gameChance(PRISMATIC_EXPLOSION[1], true) * atkRate;
    var fire = hit * PRISMATIC_FIRE[0] * tdm
      * dotTickRate(gameChance(PRISMATIC_FIRE[1], true), atkRate, PRISMATIC_FIRE[2], FIRE_TICK_OFFSET);
    var lightning = hit * PRISMATIC_LIGHTNING[0] * tdm
      * cooldownRate(gameChance(PRISMATIC_LIGHTNING[1], true), atkRate, PRISMATIC_LIGHTNING[2]);
    return (poison + explosion + fire + lightning) / PRISMATIC_SHIFT_RUNE_COUNT;
  }

  function num(v) {
    var n = Number(v);
    return n === n && n !== Infinity && n !== -Infinity ? n : 0;
  }

  function baseCritDmg(v) {
    if (v === null || v === undefined || v === '') { return 1.45; }
    var n = Number(v);
    return n === n && n !== Infinity && n !== -Infinity ? n : 1.45;
  }

  function normalizeBuild(build) {
    var b = build || {};
    var slots = b.slots ? b.slots.slice() : [];
    return {
      slots: slots.map(function (s) {
        return { name: String(s && s.name != null ? s.name : ''), amount: num(s && s.amount) };
      }),
      weapon_name: typeof b.weapon_name === 'string' ? b.weapon_name : '',
      quality: num(b.quality),
      forge_level: num(b.forge_level),
      race: typeof b.race === 'string' ? b.race : '',
      bonus_weapon_type: typeof b.bonus_weapon_type === 'string' ? b.bonus_weapon_type : '',
      rune_cells: b.rune_cells ? b.rune_cells.map(String) : [],
      base_crit_chance: num(b.base_crit_chance),
      base_crit_dmg: baseCritDmg(b.base_crit_dmg),
      armor_crit_chance: num(b.armor_crit_chance),
      armor_crit_dmg: num(b.armor_crit_dmg),
      armor_lethality: num(b.armor_lethality),
      armor_helmet: typeof b.armor_helmet === 'string' ? b.armor_helmet : '',
      armor_chestplate: typeof b.armor_chestplate === 'string' ? b.armor_chestplate : '',
      armor_leggings: typeof b.armor_leggings === 'string' ? b.armor_leggings : '',
      base_lethality: num(b.base_lethality),
      abilities: {
        blast_dmg: num(b.abilities && b.abilities.blast_dmg),
        blast_chance: num(b.abilities && b.abilities.blast_chance),
        fire_dmg: num(b.abilities && b.abilities.fire_dmg),
        fire_chance: num(b.abilities && b.abilities.fire_chance),
        fire_time: num(b.abilities && b.abilities.fire_time),
        poison_dmg: num(b.abilities && b.abilities.poison_dmg),
        poison_chance: num(b.abilities && b.abilities.poison_chance),
        poison_time: num(b.abilities && b.abilities.poison_time),
        lightning_dmg: num(b.abilities && b.abilities.lightning_dmg),
        lightning_chance: num(b.abilities && b.abilities.lightning_chance),
        lightning_cooldown: num(b.abilities && b.abilities.lightning_cooldown)
      },
      berserk: num(b.berserk),
      achievement: typeof b.achievement === 'string' ? b.achievement : '',
      training_day: b.training_day === true,
      dryad_in_grove: b.dryad_in_grove === true,
      dryad_max_hp: num(b.dryad_max_hp),
      orc_lord_hp_missing: num(b.orc_lord_hp_missing),
      orc_lord_kill_stacks: num(b.orc_lord_kill_stacks),
      golemites: [0, 1].map(function (i) {
        var src = (b.golemites && b.golemites[i]) || {};
        var g = {};
        GOLEMITE_FIELDS.forEach(function (f) { g[f] = num(src[f]); });
        return g;
      })
    };
  }

  function calculate(build, game) {
    build = normalizeBuild(build);
    build.slots = mergeSlots(build.slots, game.select_ore);
    var shares = slotShares(build.slots);
    var avgPower = avgOrePower(build.slots, game);

    var weapon = game._weapon_index.get(build.weapon_name) || null;
    var bases = weaponBases(weapon, avgPower, build.quality, build.forge_level);
    var unforged = bases[0];
    var forged = bases[1];
    var interval = (weapon && typeof weapon.interval === 'number') ? weapon.interval : 1.0;

    var oreContribs = calcOreContributions(build.slots, shares, game);
    var totals = statTotals(build, game, oreContribs);
    var atkRate = attackRate(weapon, totals.atk_speed);

    var blend = critBlend(
      build.base_crit_chance + totals.crit_chance,
      build.base_crit_dmg + totals.crit_dmg
    );

    var procs = procComponents(build, shares, game);
    var tdm = traitDamageMultiplier(build);
    var race = build.race;

    var hit = forged * (1 + totals.lethality) * blend;
    var weapon_dps = hit * atkRate;
    var explosion_dps = hit * procs.explosion_dmg * gameChance(procs.explosion_chance, procs.explosion_dmg > 0) * atkRate;
    var fire_dps = atkRate && procs.fire_dmg > 0
      ? hit * procs.fire_dmg * tdm * dotTickRate(gameChance(procs.fire_chance, true), atkRate, procs.fire_duration, FIRE_TICK_OFFSET)
      : 0.0;
    var poison_dps = atkRate && procs.poison_dmg > 0
      ? hit * procs.poison_dmg * tdm * dotTickRate(gameChance(procs.poison_chance, true), atkRate, procs.poison_duration, POISON_TICK_OFFSET)
      : 0.0;
    var smite_dps = unforged * atkRate * procs.smite_dmg * gameChance(procs.smite_chance, procs.smite_dmg > 0);
    var blackhole_dps = procs.blackhole_dmg > 0 && procs.blackhole_chance > 0
      ? unforged * procs.blackhole_dmg * tdm * cooldownRate(gameChance(procs.blackhole_chance, true), atkRate, BLACKHOLE_COOLDOWN)
      : 0.0;
    var lightning_dps = procs.lightning_dmg > 0
      ? hit * procs.lightning_dmg * tdm * cooldownRate(gameChance(procs.lightning_chance, true), atkRate, procs.lightning_cooldown)
      : 0.0;
    var smash_dps = unforged * procs.smash_dmg * cooldownRate(procs.smash_chance, atkRate, procs.smash_cooldown);
    var fox_claws_dps = unforged * procs.fox_claws_dmg
      * Math.min(procs.fox_claws_chance * atkRate, FOX_CLAWS_SPIRITS / FOX_CLAWS_SPIRIT_TIME);
    var foxfire_dps = atkRate
      ? unforged * (1 + totals.lethality) * procs.foxfire_dmg * (1 - Math.exp(-procs.foxfire_chance * atkRate * procs.foxfire_duration))
      : 0.0;
    var archangel_smite_dps = race === 'Archangel' && atkRate > 0
      ? ARCHANGEL_SMITE_DMG * unforged * cooldownRate(ARCHANGEL_SMITE_CHANCE, atkRate, ARCHANGEL_SMITE_COOLDOWN)
      : 0.0;
    var cursed_aura_dps = race === 'Demon' ? DEMON_CURSED_AURA_DMG * unforged : 0.0;
    var prismatic_shift_dps = oreShare(build.slots, shares, PRISMATIC_SHIFT_ORE) >= SHARE_GATE
      ? prismaticShiftDps(hit, atkRate, tdm)
      : 0.0;
    var golemite_dps = 0.0;
    build.golemites.forEach(function (g) {
      golemite_dps += golemiteDamage(g.level, unforged) * GOLEMITE_HITS_PER_SECOND;
    });

    var darkSmiteDmg = raceValue(RACE_DARK_SMITE_DMG, race);
    var dark_smite_dps = unforged * atkRate * darkSmiteDmg
      * gameChance(raceValue(RACE_DARK_SMITE_CHANCE, race), darkSmiteDmg > 0);
    var weaponType = weapon && weapon.type ? weapon.type : '';
    var trident = TRIDENT_TOSS[race + ',' + weaponType] || [0.0, 0.0, 0.0];
    var trident_toss_dps = trident[2] ? unforged * trident[0] * trident[1] * Math.min(atkRate, 1 / trident[2]) : 0.0;

    var reverberation_dps = weapon_dps * gameChance(procs.reverberation_chance, procs.reverberation_chance > 0);
    var frost_slash_dps = unforged * procs.frost_slash_dmg
      * gameChance(procs.frost_slash_chance, procs.frost_slash_dmg > 0) * atkRate;
    var critShare = Math.min(build.base_crit_chance + totals.crit_chance, 1.0);
    var glacier_explosion_dps = unforged * procs.glacier_dmg
      * gameChance(procs.glacier_chance, procs.glacier_dmg > 0) * critShare * atkRate;
    var galaxiteAmount = 0.0;
    build.slots.forEach(function (s) { if (s.name === 'Galaxite') { galaxiteAmount += s.amount; } });
    var starfallMult = galaxiteAmount > 0 ? STARFALL_GALAXITE_MULT : 1.0;
    var starfall_dps = atkRate && procs.starfall_dmg > 0
      ? unforged * procs.starfall_dmg * starfallMult
        * cooldownRate(gameChance(procs.starfall_chance, true), atkRate, procs.starfall_cooldown)
      : 0.0;
    var stellar_mark_dps = procs.stellar_mark_dmg > 0
      ? unforged * procs.stellar_mark_dmg * atkRate / procs.stellar_mark_hits
      : 0.0;
    var ancient_poison_dps = atkRate && procs.ancient_poison_dmg > 0
      ? poison_dps * procs.ancient_poison_dmg
        * (1 - Math.pow(1 - gameChance(procs.ancient_poison_chance, true), atkRate * procs.ancient_poison_duration))
      : 0.0;

    var proc_total = explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps + lightning_dps
      + smash_dps + fox_claws_dps + foxfire_dps + archangel_smite_dps + cursed_aura_dps + golemite_dps
      + dark_smite_dps + trident_toss_dps + reverberation_dps + frost_slash_dps + glacier_explosion_dps
      + starfall_dps + stellar_mark_dps + ancient_poison_dps + prismatic_shift_dps;
    var total_dps = weapon_dps + proc_total;

    var berserkLevel = Math.min(build.berserk, CAPS.berserk) + raceValue(RACE_BERSERK, race);
    var berserk = berserkLevel !== 0
      ? forged * (1 + totals.lethality + berserkLevel) * blend * atkRate + proc_total
      : null;

    var moonstone = procs.moon !== 0 ? weapon_dps * (1 + procs.moon) + proc_total : null;

    var min_dps = forged * (1 + totals.lethality) * atkRate;
    var max_dps = forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate
      + forged * procs.explosion_dmg * atkRate
      + forged * procs.fire_dmg
      + forged * procs.poison_dmg
      + procs.smite_dmg * forged
      + procs.blackhole_dmg * forged
      + forged * procs.lightning_dmg * procs.lightning_chance * atkRate
      + procs.smash_dmg * forged
      + (procs.reverberation_chance > 0
        ? forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate : 0.0)
      + forged * procs.frost_slash_dmg * atkRate
      + forged * procs.glacier_dmg * atkRate
      + (procs.starfall_cooldown > 0 ? forged * procs.starfall_dmg * starfallMult / procs.starfall_cooldown : 0.0)
      + (procs.stellar_mark_hits > 0 ? forged * procs.stellar_mark_dmg * atkRate / procs.stellar_mark_hits : 0.0)
      + forged * procs.poison_dmg * procs.ancient_poison_dmg;

    var ttk_25k = total_dps > 0 ? 25000 / total_dps : null;
    var ttk_75k = total_dps > 0 ? 75000 / total_dps : null;
    var ttk_skeleton = total_dps > 0 ? SKELETON_KING_HP / total_dps : null;

    return {
      avg_power: avgPower,
      unforged_damage: unforged,
      forged_damage: forged,
      interval: interval,
      attack_rate: atkRate,
      lethality: totals.lethality,
      crit_chance: totals.crit_chance,
      crit_dmg: totals.crit_dmg,
      atk_speed: totals.atk_speed,
      crit_blend: blend,
      moon: procs.moon,
      explosion_dmg: procs.explosion_dmg,
      explosion_chance: procs.explosion_chance,
      fire_dmg: procs.fire_dmg,
      fire_chance: procs.fire_chance,
      fire_duration: procs.fire_duration,
      poison_dmg: procs.poison_dmg,
      poison_chance: procs.poison_chance,
      poison_duration: procs.poison_duration,
      smite_dmg: procs.smite_dmg,
      smite_chance: procs.smite_chance,
      blackhole_dmg: procs.blackhole_dmg,
      blackhole_chance: procs.blackhole_chance,
      lightning_dmg: procs.lightning_dmg,
      lightning_chance: procs.lightning_chance,
      lightning_cooldown: procs.lightning_cooldown,
      weapon_dps: weapon_dps,
      explosion_dps: explosion_dps,
      fire_dps: fire_dps,
      poison_dps: poison_dps,
      smite_dps: smite_dps,
      blackhole_dps: blackhole_dps,
      lightning_dps: lightning_dps,
      total_dps: total_dps,
      berserk_level: berserkLevel,
      berserk: berserk,
      moonstone: moonstone,
      min_dps: min_dps,
      max_dps: max_dps,
      ttk_25k: ttk_25k,
      ttk_75k: ttk_75k,
      ttk_skeleton: ttk_skeleton,
      active_traits: activeTraits(build, shares, game),
      smash_dmg: procs.smash_dmg,
      smash_chance: procs.smash_chance,
      fox_claws_dmg: procs.fox_claws_dmg,
      fox_claws_chance: procs.fox_claws_chance,
      foxfire_dmg: procs.foxfire_dmg,
      foxfire_chance: procs.foxfire_chance,
      foxfire_duration: procs.foxfire_duration,
      smash_dps: smash_dps,
      fox_claws_dps: fox_claws_dps,
      foxfire_dps: foxfire_dps,
      archangel_smite_dps: archangel_smite_dps,
      cursed_aura_dps: cursed_aura_dps,
      golemite_dps: golemite_dps,
      dark_smite_dps: dark_smite_dps,
      trident_toss_dps: trident_toss_dps,
      reverberation_chance: procs.reverberation_chance,
      reverberation_dps: reverberation_dps,
      frost_slash_dmg: procs.frost_slash_dmg,
      frost_slash_dps: frost_slash_dps,
      glacier_dmg: procs.glacier_dmg,
      glacier_explosion_dps: glacier_explosion_dps,
      starfall_dmg: procs.starfall_dmg,
      starfall_cooldown: procs.starfall_cooldown,
      starfall_dps: starfall_dps,
      stellar_mark_dmg: procs.stellar_mark_dmg,
      stellar_mark_dps: stellar_mark_dps,
      ancient_poison_dmg: procs.ancient_poison_dmg,
      ancient_poison_dps: ancient_poison_dps,
      prismatic_shift_dps: prismatic_shift_dps,
      trait_damage_multiplier: tdm
    };
  }

  var DATA_TITLES = {
    ores: 'Data:Ores.json',
    weapons: 'Data:Weapons.json',
    races: 'Data:Races.json',
    runes: 'Data:Runes.json',
    achievements: 'Data:Achievements.json',
    oreRarity: 'Data:OreRarity.json'
  };

  function native(p) {
    return new Promise(function (resolve, reject) {
      Promise.resolve(p).then(resolve, reject);
    });
  }

  function loadViaQuery(api, title) {
    return native(api.get({
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvslots: 'main',
      rvprop: 'content',
      formatversion: 2
    })).then(function (res) {
      var page = res.query.pages[0];
      var rev = page && page.revisions && page.revisions[0];
      var slot = rev && rev.slots && rev.slots.main;
      if (!slot || typeof slot.content !== 'string') {
        throw new Error('No content returned for ' + title);
      }
      return JSON.parse(slot.content);
    });
  }

  function loadViaJsondata(api, title) {
    return native(api.get({ action: 'jsondata', format: 'json', title: title })).then(function (res) {
      var jsondata = res.jsondata;
      if (jsondata && typeof jsondata === 'object') {
        return jsondata.data !== undefined ? jsondata.data : jsondata;
      }
      throw new Error('Unexpected jsondata response for ' + title);
    });
  }

  function loadViaRaw(title) {
    var url = mw.config.get('wgScriptPath') + '/index.php?title=' + encodeURIComponent(title) + '&action=raw';
    return window.fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' for ' + title); }
      return r.json();
    });
  }

  function loadJSONPage(title) {
    var attempts = [
      function () {
        return native(mw.loader.using('mediawiki.api')).then(function () {
          return loadViaQuery(new mw.Api(), title);
        });
      },
      function () {
        return native(mw.loader.using('mediawiki.api')).then(function () {
          return loadViaJsondata(new mw.Api(), title);
        });
      },
      function () { return loadViaRaw(title); }
    ];

    return new Promise(function (resolve, reject) {
      var i = 0;
      var lastErr = null;
      function next() {
        if (i >= attempts.length) {
          reject(new Error('Failed to load ' + title + ' (' + (lastErr ? lastErr.message : 'unknown error') + ')'));
          return;
        }
        var attempt = attempts[i++];
        Promise.resolve().then(attempt).then(resolve, function (err) {
          lastErr = err;
          if (mw.log) { mw.log('Forge Calculator: ' + title + ' loading method ' + i + ' failed: ' + err.message); }
          next();
        });
      }
      next();
    });
  }

  function buildGameData(files) {
    var rawOres = files.ores;
    var rawWeapons = files.weapons;
    var rawRaces = files.races;
    var rawRunes = files.runes;
    var rawAchievements = files.achievements;

    var ores = rawOres.ores.map(function (raw) {
      return {
        name: raw.name,
        multiplier: raw.multiplier,
        equipment: raw.equipment != null ? raw.equipment : null,

        is_weapon: raw.equipment != null && String(raw.equipment).toLowerCase().indexOf('eapon') !== -1,
        trait10: raw.trait10 != null ? raw.trait10 : null,
        trait30: raw.trait30 != null ? raw.trait30 : null,
        comments: raw.comments != null ? raw.comments : null,
        stats: raw.stats || {}
      };
    });

    var weapons = rawWeapons.weapons.map(function (raw) {
      return {
        name: raw.name,
        type: raw.type,
        classes: raw.classes || [],
        interval: raw.interval,
        damage: raw.damage
      };
    });

    var races = rawRaces.races.map(function (raw) {
      return {
        name: raw.name,
        default_trait: raw.default_trait != null ? raw.default_trait : null,
        available_traits: raw.available_traits || []
      };
    });

    var runes = rawRunes.runes.map(function (raw) {
      return {
        name: raw.name,
        stat: raw.stat != null ? raw.stat : null,
        value: raw.value != null ? raw.value : null
      };
    });

    var achievements = rawAchievements.achievements.map(function (raw) {
      return {
        name: raw.name,
        stat: raw.stat != null ? raw.stat : null,
        value: raw.value != null ? raw.value : null
      };
    });

    var data = {
      ores: ores,
      weapons: weapons,
      races: races,
      runes: runes,
      achievements: achievements,
      weapon_types: rawWeapons.types || [],
      race_bonus_types: rawWeapons.race_bonus_types || [],
      weapon_type_min_ore: rawWeapons.type_min_ore || {},
      not_enough_ore: rawWeapons.not_enough_ore || 'Not enough Ore',
      select_ore: rawOres.select_ore || SELECT_ORE,
      none_label: rawRunes.none || NONE_LABEL,
      ore_rarity: (files.oreRarity && files.oreRarity.rarities) || {},
      constants: {
        selectOreLabel: rawOres.select_ore || SELECT_ORE,
        noneLabel: rawRunes.none || NONE_LABEL
      }
    };

    data._ore_index = new Map(data.ores.map(function (o) { return [o.name, o]; }));
    data._weapon_index = new Map(data.weapons.map(function (w) { return [w.name, w]; }));
    data._race_index = new Map(data.races.map(function (r) { return [r.name, r]; }));

    validateData(data);
    return data;
  }

  function validateData(data) {
    var counts = {
      ores: data.ores.length,
      weapons: data.weapons.length,
      races: data.races.length,
      runes: data.runes.length,
      achievements: data.achievements.length
    };

    var drift = {};
    for (var key in EXPECTED_COUNTS) {
      if (counts[key] !== EXPECTED_COUNTS[key]) {
        drift[key] = { expected: EXPECTED_COUNTS[key], actual: counts[key] };
      }
    }
    if (Object.keys(drift).length > 0 && mw.log) {
      mw.log('Forge Calculator: data count drift detected', drift);
    }


    var seen = {};
    for (var i = 0; i < data.ores.length; i++) {
      var name = data.ores[i].name;
      if (seen[name]) {
        throw new Error('Duplicate ore name: ' + name);
      }
      seen[name] = true;
    }
  }

  function loadGameData() {
    return Promise.all([
      loadJSONPage(DATA_TITLES.ores),
      loadJSONPage(DATA_TITLES.weapons),
      loadJSONPage(DATA_TITLES.races),
      loadJSONPage(DATA_TITLES.runes),
      loadJSONPage(DATA_TITLES.achievements),
      loadJSONPage(DATA_TITLES.oreRarity).then(null, function () { return null; })
    ]).then(function (all) {
      return buildGameData({
        ores: all[0],
        weapons: all[1],
        races: all[2],
        runes: all[3],
        achievements: all[4],
        oreRarity: all[5]
      });
    });
  }

  function createEl(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    children = children || [];
    for (var key in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) { continue; }
      var value = attrs[key];
      if (key === 'class') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        for (var s in value) { el.style[s] = value[s]; }
      } else if (key.indexOf('on') === 0 && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'dataset') {
        for (var d in value) { el.dataset[d] = value[d]; }
      } else {
        el.setAttribute(key, value);
      }
    }
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    }
    return el;
  }

  function empty(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  var CLASS_DROPDOWN = 'fc-searchable-dropdown';
  var CLASS_INPUT = 'fc-searchable-input';
  var CLASS_ARROW = 'fc-searchable-arrow';
  var CLASS_LIST = 'fc-searchable-list';
  var CLASS_ITEM = 'fc-searchable-item';
  var CLASS_ITEM_HIGHLIGHTED = 'fc-searchable-item--highlighted';
  var CLASS_HIDDEN = 'fc-hidden';

  function debounce(fn, delay) {
    var timeoutId = null;
    return function () {
      var args = Array.prototype.slice.call(arguments);
      if (timeoutId) { clearTimeout(timeoutId); }
      timeoutId = setTimeout(function () { fn.apply(null, args); }, delay);
    };
  }

  function createSearchableDropdown(opts) {
    var options = opts.options;
    var onChange = opts.onChange;
    var placeholder = opts.placeholder || '';
    var id = opts.id || ('dropdown-' + Math.random().toString(36).slice(2));
    var dropdownId = id;

    var isOpen = false;
    var highlightedIndex = -1;
    var filteredOptions = options;
    var currentValue = opts.value;

    var container = createEl('div', { class: CLASS_DROPDOWN });

    var input = createEl('input', {
      type: 'text',
      class: CLASS_INPUT,
      placeholder: placeholder,
      value: currentValue,
      'aria-autocomplete': 'list',
      'aria-controls': dropdownId + '-list',
      'aria-expanded': 'false',
      'aria-haspopup': 'listbox',
      id: dropdownId + '-input',
      autocomplete: 'off',
      spellcheck: 'false'
    });

    var arrow = createEl('button', {
      type: 'button',
      class: CLASS_ARROW,
      'aria-label': 'Toggle dropdown',
      tabindex: -1
    }, ['▾']);

    var listContainer = createEl('div', {
      class: CLASS_LIST + ' ' + CLASS_HIDDEN,
      id: dropdownId + '-list',
      role: 'listbox',
      'aria-label': placeholder || 'Options'
    });

    function filterOptions(searchTerm) {
      var term = searchTerm.toLowerCase().trim();
      if (!term) { return options; }
      var filtered = [];
      for (var i = 0; i < options.length; i++) {
        if (options[i].toLowerCase().indexOf(term) !== -1) { filtered.push(options[i]); }
      }
      return filtered;
    }

    function renderList() {
      empty(listContainer);
      highlightedIndex = -1;

      if (filteredOptions.length === 0) {
        listContainer.appendChild(createEl('div', { class: CLASS_ITEM + ' fc-searchable-no-results' }, ['No results']));
        return;
      }

      for (var i = 0; i < filteredOptions.length; i++) {
        var opt = filteredOptions[i];
        var item = createEl('div', {
          class: CLASS_ITEM,
          role: 'option',
          'aria-selected': 'false',
          'data-index': i,
          'data-value': opt
        }, [opt]);
        listContainer.appendChild(item);
      }
    }

    function highlightIndex(index) {
      var items = listContainer.querySelectorAll('.' + CLASS_ITEM + '[data-index]');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var isHighlighted = (i === index);
        item.classList.toggle(CLASS_ITEM_HIGHLIGHTED, isHighlighted);
        item.setAttribute('aria-selected', isHighlighted ? 'true' : 'false');
      }
      highlightedIndex = index;
    }

    function selectHighlighted() {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        var newValue = filteredOptions[highlightedIndex];
        currentValue = newValue;
        input.value = newValue;
        onChange(newValue);
        close();
      }
    }

    function open(showAll) {
      if (isOpen) { return; }
      isOpen = true;
      listContainer.classList.remove(CLASS_HIDDEN);
      input.setAttribute('aria-expanded', 'true');
      arrow.textContent = '▴';
      filteredOptions = filterOptions(showAll ? '' : (input.value === currentValue ? '' : input.value));
      renderList();
      input.focus();
    }

    function close() {
      if (!isOpen) { return; }
      isOpen = false;
      listContainer.classList.add(CLASS_HIDDEN);
      input.setAttribute('aria-expanded', 'false');
      arrow.textContent = '▾';
      highlightedIndex = -1;
    }

    function toggle(showAll) {
      if (isOpen) { close(); } else { open(showAll); }
    }

    var handleInput = debounce(function (e) {
      var term = e.target.value;
      filteredOptions = filterOptions(term);
      renderList();
      if (!isOpen && filteredOptions.length > 0) { open(); }
    }, 100);

    function handleKeydown(e) {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
        return;
      }

      var items = listContainer.querySelectorAll('.' + CLASS_ITEM + '[data-index]');
      var maxIndex = items.length - 1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (highlightedIndex < maxIndex) {
            highlightIndex(highlightedIndex + 1);
            if (items[highlightedIndex] && items[highlightedIndex].scrollIntoView) {
              items[highlightedIndex].scrollIntoView({ block: 'nearest' });
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (highlightedIndex > 0) {
            highlightIndex(highlightedIndex - 1);
            if (items[highlightedIndex] && items[highlightedIndex].scrollIntoView) {
              items[highlightedIndex].scrollIntoView({ block: 'nearest' });
            }
          } else if (highlightedIndex === 0) {
            highlightIndex(-1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          selectHighlighted();
          break;
        case 'Escape':
          e.preventDefault();
          close();
          input.blur();
          break;
        case 'Tab':
          selectHighlighted();
          break;
      }
    }

    function handleItemClick(e) {
      var target = e.target;
      while (target && target !== listContainer && !target.classList.contains(CLASS_ITEM)) {
        target = target.parentNode;
      }
      if (target && target.classList.contains(CLASS_ITEM) && target.dataset.value) {
        var value = target.dataset.value;
        currentValue = value;
        input.value = value;
        onChange(value);
        close();
      }
    }

    function handleClickOutside(e) {
      if (!container.contains(e.target)) { close(); }
    }

    function handleArrowClick(e) {
      e.preventDefault();
      e.stopPropagation();
      toggle(true);
    }

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('focus', function () {
      input.select();
      if (!isOpen && options.length > 0) { open(); }
    });
    arrow.addEventListener('click', handleArrowClick);
    listContainer.addEventListener('click', handleItemClick);
    document.addEventListener('click', handleClickOutside);

    container.setValue = function (val) {
      currentValue = val;
      input.value = val;
    };
    container.getValue = function () { return currentValue; };
    container.setDisabled = function (disabled) { input.disabled = !!disabled; };
    container.open = open;
    container.close = close;
    container.setOptions = function (newOptions) {
      options = newOptions;
      filteredOptions = filterOptions('');
      renderList();
    };
    container.updateOptions = function (newOptions) {
      options = newOptions;
      filteredOptions = filterOptions(input.value === currentValue ? '' : input.value);
      renderList();
      if (!isOpen && filteredOptions.length > 0) { open(); }
    };

    container.append(input, arrow, listContainer);
    return container;
  }

  function createOreSlot(opts) {
    var index = opts.index;
    var oreNames = opts.oreNames;
    var noneLabel = opts.noneLabel;
    var selectOreLabel = opts.selectOreLabel;
    var prompt = opts.prompt || noneLabel;
    var oreMultipliers = opts.oreMultipliers || {};
    var onChange = opts.onChange;

    var slotId = (opts.idPrefix || 'ore-slot-') + index;
    var currentName = opts.value || noneLabel;
    var currentAmount = opts.amount || 0;

    var options = [prompt].concat(oreNames.filter(function (n) { return n !== selectOreLabel; }));

    function toUI(val) { return (val === noneLabel || val === undefined) ? prompt : val; }
    function fromUI(val) { return val === prompt ? noneLabel : val; }

    var container = createEl('div', { class: 'fc-ore-slot', id: slotId });
    var label = createEl('label', { class: 'fc-ore-slot-label', for: slotId + '-ore' }, ['Slot ' + (index + 1)]);
    var fields = createEl('div', { class: 'fc-ore-slot-fields' });

    var dropdownWrapper = createEl('div', { class: 'fc-ore-slot-dropdown' });
    var dropdown = createSearchableDropdown({
      options: options,
      value: toUI(currentName),
      placeholder: prompt,
      id: slotId + '-ore',
      onChange: function (newName) {
        var parsed = fromUI(newName);
        if (parsed !== currentName) {
          currentName = parsed;
          currentAmount = 0;
          amountInput.value = 0;
        }
        updateMult();
        onChange(currentName, currentAmount);
      }
    });
    dropdownWrapper.appendChild(dropdown);

    var multLabel = createEl('span', { class: 'fc-ore-slot-mult' }, ['']);
    function updateMult() {
      var m = Number(oreMultipliers[currentName]);
      multLabel.textContent = m ? '×' + String(parseFloat(m.toFixed(2))) : '';
    }

    var amountInput = createEl('input', {
      type: 'number',
      class: 'fc-ore-slot-amount',
      id: slotId + '-amount',
      value: currentAmount,
      min: '0',
      step: '1',
      placeholder: '0',
      inputmode: 'numeric'
    });

    function commitAmount() {
      currentAmount = Math.max(0, Math.floor(Number(amountInput.value) || 0));
      amountInput.value = currentAmount;
      onChange(currentName, currentAmount);
    }

    var handleAmountChange = debounce(commitAmount, 150);
    amountInput.addEventListener('input', handleAmountChange);
    amountInput.addEventListener('change', commitAmount);

    fields.append(dropdownWrapper, multLabel, amountInput);
    container.append(label, fields);

    container.setValue = function (name, amt) {
      currentName = name;
      currentAmount = amt;
      dropdown.setValue(toUI(name));
      amountInput.value = amt;
      updateMult();
    };
    container.getValue = function () { return { name: currentName, amount: currentAmount }; };
    container.getDropdown = function () { return dropdown; };

    updateMult();
    return container;
  }

  function createWeaponSelector(opts) {
    var weaponTypes = opts.weaponTypes;
    var weapons = opts.weapons;
    var noneLabel = opts.noneLabel;
    var weaponTypePrompt = opts.weaponTypePrompt || noneLabel;
    var weaponPrompt = opts.weaponPrompt || noneLabel;
    var enhancementPrompt = opts.enhancementPrompt || noneLabel;
    var onChange = opts.onChange;


    function toUI(val, sentinel, prompt) {
      return (val === sentinel || val === undefined) ? prompt : val;
    }
    function fromUI(val, sentinel, prompt) {
      return val === prompt ? sentinel : val;
    }

    var QUALITY_MAX = 100;

    var typeMinOre = opts.typeMinOre || {};
    var notEnoughOre = opts.notEnoughOre || 'Not enough Ore';
    var oreTotal = Number(opts.oreTotal) || 0;
    var currentType = opts.weaponType || noneLabel;
    var currentWeapon = opts.weaponName || noneLabel;

    function allowedTypes() {
      return weaponTypes.filter(function (t) {
        return typeMinOre[t] === undefined || typeMinOre[t] <= oreTotal;
      });
    }

    function typeOptionList() {
      var allowed = allowedTypes();
      if (!allowed.length) { return [weaponTypePrompt, notEnoughOre]; }
      return [weaponTypePrompt, 'All Types'].concat(allowed);
    }

    function weaponsForType(type) {
      var allowed = allowedTypes();
      return weapons.filter(function (w) {
        if (allowed.indexOf(w.type) === -1) { return false; }
        return type === noneLabel || type === 'All Types' || w.type === type;
      });
    }

    function weaponOptionList(type) {
      return [weaponPrompt].concat(weaponsForType(type).map(function (w) { return w.name; }));
    }
    var currentQuality = (opts.quality !== undefined && opts.quality !== null) ? opts.quality : 100;
    var currentEnhancement = (opts.enhancement !== undefined && opts.enhancement !== null) ? opts.enhancement : 0;

    var container = createEl('div', { class: 'fc-weapon-selector' });

    var typeWrapper = createEl('div', { class: 'fc-weapon-type-wrapper' });
    var typeLabel = createEl('label', { for: 'weapon-type' }, ['Weapon Type']);
    var typeDropdown = createSearchableDropdown({
      options: typeOptionList(),
      value: toUI(currentType, noneLabel, weaponTypePrompt),
      placeholder: weaponTypePrompt,
      id: 'weapon-type',
      onChange: function (newType) {
        currentType = newType === notEnoughOre ? noneLabel : fromUI(newType, noneLabel, weaponTypePrompt);
        if (newType === notEnoughOre) { typeDropdown.setValue(weaponTypePrompt); }
        var weaponNames = weaponOptionList(currentType);
        weaponDropdown.updateOptions(weaponNames);
        if (weaponNames.indexOf(currentWeapon) === -1) {
          currentWeapon = noneLabel;
          weaponDropdown.setValue(weaponPrompt);
        }
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    typeWrapper.append(typeLabel, typeDropdown);

    var weaponWrapper = createEl('div', { class: 'fc-weapon-wrapper' });
    var weaponLabel = createEl('label', { for: 'weapon-name' }, ['Weapon']);
    var weaponDropdown = createSearchableDropdown({
      options: weaponOptionList(currentType),
      value: toUI(currentWeapon, noneLabel, weaponPrompt),
      placeholder: weaponPrompt,
      id: 'weapon-name',
      onChange: function (newWeapon) {
        currentWeapon = fromUI(newWeapon, noneLabel, weaponPrompt);
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    weaponWrapper.append(weaponLabel, weaponDropdown);

    var qualityWrapper = createEl('div', { class: 'fc-quality-wrapper' });
    var qualityLabel = createEl('label', { for: 'quality' }, ['Quality']);
    var qualityInput = createEl('input', {
      type: 'number',
      class: 'fc-quality-input',
      id: 'quality',
      value: currentQuality,
      min: '0',
      max: String(QUALITY_MAX),
      step: '5',
      inputmode: 'decimal'
    });
    function clampQuality(v) {
      return Math.min(parseFloat(v) || 0, QUALITY_MAX);
    }
    function commitQuality() {
      currentQuality = clampQuality(qualityInput.value);
      qualityInput.value = currentQuality;
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
    var handleQualityChange = debounce(commitQuality, 150);
    qualityInput.addEventListener('input', handleQualityChange);
    qualityInput.addEventListener('change', commitQuality);
    qualityWrapper.append(qualityLabel, qualityInput);

    var enhancementWrapper = createEl('div', { class: 'fc-enhancement-wrapper' });
    var enhancementLabel = createEl('label', { for: 'enhancement' }, ['Enhancement']);
    var enhancementLevels = [];
    for (var i = 0; i < 10; i++) { enhancementLevels.push(String(i)); }
    var enhancementOptions = [enhancementPrompt].concat(enhancementLevels);
    var enhancementDropdown = createSearchableDropdown({
      options: enhancementOptions,
      value: String(currentEnhancement),
      placeholder: enhancementPrompt,
      id: 'enhancement',
      onChange: function (newEnhancement) {
        currentEnhancement = newEnhancement === enhancementPrompt ? 0 : parseInt(newEnhancement, 10);
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    enhancementWrapper.append(enhancementLabel, enhancementDropdown);

    container.append(typeWrapper, weaponWrapper, qualityWrapper, enhancementWrapper);

    container.setValues = function (type, name, qual, enh) {
      currentType = type;
      currentWeapon = name;
      currentQuality = qual;
      currentEnhancement = enh;
      typeDropdown.setValue(toUI(type, noneLabel, weaponTypePrompt));
      weaponDropdown.setValue(toUI(name, noneLabel, weaponPrompt));
      qualityInput.value = qual;
      enhancementDropdown.setValue(String(enh));
    };

    container.setOreTotal = function (total) {
      oreTotal = Number(total) || 0;
      typeDropdown.setOptions(typeOptionList());
      weaponDropdown.setOptions(weaponOptionList(currentType));
    };

    container.getTypeOptions = typeOptionList;
    container.getWeaponOptions = function () { return weaponOptionList(currentType); };

    return container;
  }

  function createStatInput(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }

    var container = createEl('div', { class: 'fc-stat-input' });




    var fields = [
      { key: 'armorLethality', label: 'Armor Lethality', placeholder: '0', min: 0, max: 300, step: 1 },
      { key: 'armorCritChance', label: 'Armor Crit Chance', placeholder: '0', min: 0, max: 100, step: 1 },
      { key: 'armorCritDmg', label: 'Armor Crit Damage', placeholder: '0', min: 0, max: 150, step: 1 }
    ];

    for (var i = 0; i < fields.length; i++) {
      (function (field) {
        var row = createEl('div', { class: 'fc-stat-input-row' });
        var label = createEl('label', { class: 'fc-stat-input-label', for: field.key }, [field.label]);
        var input = createEl('input', {
          type: 'number',
          class: 'fc-stat-input-input',
          id: field.key,
          value: currentValues[field.key] !== undefined ? currentValues[field.key] : '',
          min: String(field.min),
          max: String(field.max),
          step: field.step,
          placeholder: field.placeholder,
          inputmode: 'numeric'
        });

        function commit() {
          currentValues[field.key] = Math.max(0, Math.min(parseFloat(input.value) || 0, field.max));
          input.value = currentValues[field.key];
          var out = {};
          for (var k2 in currentValues) { out[k2] = currentValues[k2]; }
          onChange(out);
        }
        var handleChange = debounce(commit, 150);
        input.addEventListener('input', handleChange);
        input.addEventListener('change', commit);

        var fieldWrapper = createEl('div', { class: 'fc-stat-input-field' });
        fieldWrapper.appendChild(input);
        row.append(label, fieldWrapper);
        container.appendChild(row);
      })(fields[i]);
    }

    container.setValues = function (values) {
      for (var key in values) { currentValues[key] = values[key]; }
      for (var j = 0; j < fields.length; j++) {
        var el = container.querySelector('#' + fields[j].key);
        if (el) { el.value = currentValues[fields[j].key] !== undefined ? currentValues[fields[j].key] : ''; }
      }
    };

    container.getValues = function () {
      var out = {};
      for (var k3 in currentValues) { out[k3] = currentValues[k3]; }
      return out;
    };

    return container;
  }



  var ABILITY_RANGES = {
    fireDmg: { min: 1, max: 22, unit: 'pct' },
    fireChance: { min: 1, max: 50, unit: 'pct' },
    fireTime: { min: 1, max: 3, unit: 'sec' },
    poisonDmg: { min: 1, max: 7, unit: 'pct' },
    poisonChance: { min: 1, max: 35, unit: 'pct' },
    poisonTime: { min: 1, max: 6, unit: 'sec' },
    lightningDmg: { min: 1, max: 80, unit: 'pct' },
    lightningChance: { min: 1, max: 60, unit: 'pct' },
    lightningCooldown: { min: 0.3, max: 5, unit: 'sec' },
    blastDmg: { min: 1, max: 40, unit: 'pct' },
    blastChance: { min: 1, max: 20, unit: 'pct' }
  };



  function clampAbilityValue(raw) {
    if (raw === '' || raw === undefined || raw === null) { return 0; }
    var s = String(raw).trim().replace(/%$/, '').trim();
    if (s === '') { return 0; }
    var v = parseFloat(s);
    if (isNaN(v) || v === 0) { return 0; }
    return v;
  }

  function createAbilityGrid(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }
    var invalidFields = {};

    var container = createEl('div', { class: 'fc-ability-grid' });

    function createSection(title, fields) {
      var section = createEl('div', { class: 'fc-ability-section' });
      var sectionTitle = createEl('h4', { class: 'fc-ability-section-title' });
      sectionTitle.appendChild(iconImg(title.toLowerCase(), title));
      sectionTitle.appendChild(document.createTextNode(title));
      section.appendChild(sectionTitle);

      for (var i = 0; i < fields.length; i++) {
        (function (field) {
          var range = ABILITY_RANGES[field.key];
          var step = (range.min % 1 !== 0 || range.max % 1 !== 0) ? '0.1' : '1';
          var row = createEl('div', { class: 'fc-ability-row' });
          var label = createEl('label', { class: 'fc-ability-label', for: field.key }, [field.label]);
          var input = createEl('input', {
            type: 'text',
            class: 'fc-ability-input',
            id: field.key,
            value: currentValues[field.key] !== undefined ? currentValues[field.key] : '',
            step: step,
            placeholder: '0',
            title: field.label + ' (from runes). 0 = no ability.',
            inputmode: 'decimal'
          });

          function commit() {
            var trimmed = String(input.value).trim();
            invalidFields[field.key] = (trimmed !== '' && isNaN(Number(trimmed)))
              ? (title + ' ' + field.label)
              : null;
            currentValues[field.key] = clampAbilityValue(input.value);
            input.value = currentValues[field.key];
            var out = {};
            for (var k2 in currentValues) { out[k2] = currentValues[k2]; }
            onChange(out);
          }
          var handleChange = debounce(commit, 150);
          input.addEventListener('input', handleChange);
          input.addEventListener('change', commit);
          input.addEventListener('blur', commit);

          var fieldWrapper = createEl('div', { class: 'fc-ability-field' });
          fieldWrapper.appendChild(input);
          row.append(label, fieldWrapper);
          section.appendChild(row);
        })(fields[i]);
      }

      return section;
    }

    var fireSection = createSection('Fire', [
      { key: 'fireDmg', label: 'Damage' },
      { key: 'fireChance', label: 'Chance' },
      { key: 'fireTime', label: 'Duration' }
    ]);

    var poisonSection = createSection('Poison', [
      { key: 'poisonDmg', label: 'Damage' },
      { key: 'poisonChance', label: 'Chance' },
      { key: 'poisonTime', label: 'Duration' }
    ]);

    var lightningSection = createSection('Lightning', [
      { key: 'lightningDmg', label: 'Damage' },
      { key: 'lightningChance', label: 'Chance' },
      { key: 'lightningCooldown', label: 'Cooldown' }
    ]);

    var blastSection = createSection('Blast', [
      { key: 'blastDmg', label: 'Damage' },
      { key: 'blastChance', label: 'Chance' }
    ]);

    fireSection.classList.add('fc-ability-section--fire');
    poisonSection.classList.add('fc-ability-section--poison');
    lightningSection.classList.add('fc-ability-section--lightning');
    blastSection.classList.add('fc-ability-section--blast');

    container.append(fireSection, blastSection, poisonSection, lightningSection);

    container.setValues = function (values) {
      for (var key in values) { currentValues[key] = values[key]; }
      invalidFields = {};
      var sections = [fireSection, poisonSection, lightningSection, blastSection];
      for (var i = 0; i < sections.length; i++) {
        var inputs = sections[i].querySelectorAll('.fc-ability-input');
        for (var j = 0; j < inputs.length; j++) {
          var inp = inputs[j];
          if (currentValues[inp.id] !== undefined) {
            inp.value = currentValues[inp.id] !== undefined ? currentValues[inp.id] : '';
          }
        }
      }
    };

    container.getValues = function () {
      var out = {};
      for (var k3 in currentValues) { out[k3] = currentValues[k3]; }
      return out;
    };

    container.getInvalidAbilityWarnings = function () {
      var out = [];
      for (var k4 in invalidFields) {
        if (invalidFields[k4]) { out.push(invalidFields[k4] + ' ability only takes numerical values.'); }
      }
      return out;
    };

    return container;
  }

  var GOLEMITE_SLOT_COUNT = 4;

  var GOLEMITE_STAT_LABELS = [
    { key: 'lethality', label: 'Lethality', kind: 'pct' },
    { key: 'crit_chance', label: 'Crit Chance', kind: 'pct' },
    { key: 'crit_dmg', label: 'Crit DMG', kind: 'pct' },
    { key: 'atk_speed', label: 'Atk Speed', kind: 'pct' },
    { key: 'fire_dmg', label: 'Fire DMG', kind: 'pct' },
    { key: 'fire_chance', label: 'Fire Chance', kind: 'pct' },
    { key: 'fire_time', label: 'Fire Duration', kind: 'sec' },
    { key: 'poison_dmg', label: 'Poison DMG', kind: 'pct' },
    { key: 'poison_chance', label: 'Poison Chance', kind: 'pct' },
    { key: 'poison_time', label: 'Poison Duration', kind: 'sec' },
    { key: 'lightning_dmg', label: 'Lightning DMG', kind: 'pct' },
    { key: 'lightning_chance', label: 'Lightning Chance', kind: 'pct' },
    { key: 'lightning_cooldown', label: 'Lightning Cooldown', kind: 'sec' },
    { key: 'blast_dmg', label: 'Blast DMG', kind: 'pct' },
    { key: 'blast_chance', label: 'Blast Chance', kind: 'pct' },
    { key: 'smite_dmg', label: 'Smite DMG', kind: 'pct' },
    { key: 'smite_chance', label: 'Smite Chance', kind: 'pct' },
    { key: 'blackhole_dmg', label: 'Black Hole DMG', kind: 'pct' },
    { key: 'blackhole_chance', label: 'Black Hole Chance', kind: 'pct' },
    { key: 'resonance_dmg', label: 'Resonance', kind: 'pct' },
    { key: 'moon', label: 'Moon Boost', kind: 'pct' },
    { key: 'reverberation_chance', label: 'Reverberation Chance', kind: 'pct' },
    { key: 'frost_slash_dmg', label: 'Frost Slash DMG', kind: 'pct' },
    { key: 'frost_slash_chance', label: 'Frost Slash Chance', kind: 'pct' },
    { key: 'glacier_dmg', label: 'Glacier Explosion DMG', kind: 'pct' },
    { key: 'glacier_chance', label: 'Glacier Explosion Chance', kind: 'pct' },
    { key: 'starfall_dmg', label: 'Starfall DMG', kind: 'pct' },
    { key: 'starfall_chance', label: 'Starfall Chance', kind: 'pct' },
    { key: 'starfall_cooldown', label: 'Starfall Cooldown', kind: 'sec' },
    { key: 'stellar_mark_dmg', label: 'Stellar Mark DMG', kind: 'pct' },
    { key: 'ancient_poison_dmg', label: 'Ancient Poison DMG', kind: 'pct' },
    { key: 'ancient_poison_chance', label: 'Ancient Poison Chance', kind: 'pct' },
    { key: 'ancient_poison_duration', label: 'Ancient Poison Duration', kind: 'sec' }
  ];

  function emptyGolemiteSlots() {
    var slots = [];
    for (var i = 0; i < GOLEMITE_SLOT_COUNT; i++) { slots.push({ name: NONE_LABEL, amount: 0 }); }
    return slots;
  }

  function emptyGolemite() {
    return { level: 0, slots: emptyGolemiteSlots() };
  }

  function golemiteBuildValues(list) {
    return [0, 1].map(function (i) {
      var src = (list && list[i]) || {};
      var level = Math.min(GOLEMITE_MAX_LEVEL, Math.max(0, Math.floor(Number(src.level) || 0)));
      var slots = emptyGolemiteSlots().map(function (empty, j) {
        var s = (src.slots && src.slots[j]) || empty;
        return { name: s.name || NONE_LABEL, amount: Math.max(0, Number(s.amount) || 0) };
      });
      return { level: level, slots: slots };
    });
  }

  function golemiteEngineValues(golemite, game) {
    var out = { level: golemite.level };
    var info = game ? deriveGolemiteStats(golemite.slots, game) : null;
    var derived = info ? info.stats : null;
    GOLEMITE_FIELDS.forEach(function (f) {
      if (f !== 'level') { out[f] = derived ? derived[f] : 0.0; }
    });
    return out;
  }

  function formatGolemiteStat(value, kind) {
    if (kind === 'sec') { return String(parseFloat(value.toFixed(2))) + 's'; }
    return String(parseFloat((value * 100).toFixed(2))) + '%';
  }

  function createGolemiteInputs(opts) {
    var onChange = opts.onChange;
    var describe = opts.describe || function () { return null; };
    var values = golemiteBuildValues(opts.values);
    var active = 0;
    var levelInputs = [];
    var slotWidgets = [[], []];
    var summaries = [];

    var container = createEl('div', { class: 'fc-golemite' });
    var tabs = createEl('div', { class: 'fc-golemite-tabs', role: 'tablist' });
    var panes = [];
    var tabButtons = [];

    function copyValues() {
      return values.map(function (g) {
        return { level: g.level, slots: g.slots.map(function (s) { return { name: s.name, amount: s.amount }; }) };
      });
    }

    function tabText(i) {
      var level = values[i].level;
      var info = describe(values[i]);
      return 'Golemite ' + (i + 1) + (level ? ' · Lv ' + level : '') + (info && info.rarity ? ' · ' + info.rarity : '');
    }

    function renderSummary(i) {
      var box = summaries[i];
      empty(box);
      var info = describe(values[i]);
      if (!info || !info.rarity) {
        box.appendChild(createEl('p', { class: 'fc-golemite-summary-empty' }, ['Add the ores you forged this Golemite with to see its stats.']));
        return;
      }
      box.appendChild(createEl('div', { class: 'fc-golemite-summary-head' }, [
        createEl('span', { class: 'fc-golemite-rarity fc-golemite-rarity--' + info.rarity.toLowerCase() }, [info.rarity]),
        createEl('span', { class: 'fc-golemite-scaling' }, ['Ore traits ×' + info.scaling.toFixed(2)])
      ]));
      var list = createEl('div', { class: 'fc-golemite-stats' });
      var shown = 0;
      GOLEMITE_STAT_LABELS.forEach(function (entry) {
        var v = info.stats[entry.key];
        if (!v) { return; }
        shown++;
        list.appendChild(createEl('div', { class: 'fc-golemite-stat' }, [
          createEl('span', { class: 'fc-golemite-stat-label' }, [entry.label]),
          createEl('span', { class: 'fc-golemite-stat-value' }, [formatGolemiteStat(v, entry.kind)])
        ]));
      });
      if (!shown) {
        list.appendChild(createEl('p', { class: 'fc-golemite-summary-empty' }, ['These ores give no weapon traits.']));
      }
      box.appendChild(list);
    }

    function refresh(i) {
      tabButtons[i].textContent = tabText(i);
      renderSummary(i);
    }

    function emit(i) {
      refresh(i);
      onChange(copyValues());
    }

    function selectTab(i) {
      active = i;
      for (var j = 0; j < 2; j++) {
        tabButtons[j].classList.toggle('fc-golemite-tab--active', j === i);
        tabButtons[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
        panes[j].classList.toggle('fc-hidden', j !== i);
      }
    }

    for (var i = 0; i < 2; i++) {
      (function (index) {
        var tab = createEl('button', {
          type: 'button',
          class: 'fc-golemite-tab',
          role: 'tab',
          id: 'fc-golemite-tab-' + (index + 1)
        }, ['']);
        tab.addEventListener('click', function (e) { e.preventDefault(); selectTab(index); });
        tabButtons.push(tab);
        tabs.appendChild(tab);

        var pane = createEl('div', { class: 'fc-golemite-pane', role: 'tabpanel' });
        var levelId = 'fc-golemite-' + (index + 1) + '-level';
        var levelRow = createEl('div', { class: 'fc-golemite-level' });
        var levelInput = createEl('input', {
          type: 'number',
          class: 'fc-ability-input fc-golemite-level-input',
          id: levelId,
          value: values[index].level || 0,
          min: '0',
          max: String(GOLEMITE_MAX_LEVEL),
          step: '1',
          placeholder: '0',
          title: 'Golemite ' + (index + 1) + ' level (13 or higher adds Golemite DPS). 0 = none.',
          inputmode: 'numeric'
        });
        function commitLevel() {
          var v = Math.min(GOLEMITE_MAX_LEVEL, Math.max(0, Math.floor(parseFloat(levelInput.value) || 0)));
          levelInput.value = v;
          values[index].level = v;
          emit(index);
        }
        levelInput.addEventListener('input', debounce(commitLevel, 150));
        levelInput.addEventListener('change', commitLevel);
        levelInputs.push(levelInput);
        levelRow.append(
          createEl('label', { class: 'fc-golemite-level-label', for: levelId }, ['Level']),
          levelInput,
          createEl('span', { class: 'fc-golemite-level-hint' }, ['Golemite DPS starts at level 13 (max 25).'])
        );
        pane.appendChild(levelRow);

        var grid = createEl('div', { class: 'fc-ore-grid fc-golemite-ores' });
        for (var j = 0; j < GOLEMITE_SLOT_COUNT; j++) {
          (function (slotIndex) {
            var slot = createOreSlot({
              index: slotIndex,
              idPrefix: 'fc-golemite-' + (index + 1) + '-slot-',
              oreNames: opts.oreNames || [],
              noneLabel: opts.noneLabel || NONE_LABEL,
              selectOreLabel: opts.selectOreLabel || SELECT_ORE,
              prompt: opts.prompt,
              oreMultipliers: opts.oreMultipliers || {},
              value: values[index].slots[slotIndex].name,
              amount: values[index].slots[slotIndex].amount,
              onChange: function (name, amount) {
                values[index].slots[slotIndex] = { name: name, amount: amount };
                emit(index);
              }
            });
            slotWidgets[index].push(slot);
            grid.appendChild(slot);
          })(j);
        }
        pane.appendChild(grid);

        var summary = createEl('div', { class: 'fc-golemite-summary', id: 'fc-golemite-' + (index + 1) + '-summary' });
        summaries.push(summary);
        pane.appendChild(summary);
        panes.push(pane);
      })(i);
    }

    container.appendChild(tabs);
    panes.forEach(function (pane) { container.appendChild(pane); });
    refresh(0);
    refresh(1);
    selectTab(0);

    container.setValues = function (list) {
      values = golemiteBuildValues(list);
      for (var k = 0; k < 2; k++) {
        levelInputs[k].value = values[k].level || 0;
        for (var m = 0; m < GOLEMITE_SLOT_COUNT; m++) {
          slotWidgets[k][m].setValue(values[k].slots[m].name, values[k].slots[m].amount);
        }
        refresh(k);
      }
      selectTab(active);
    };

    container.getValues = function () { return copyValues(); };

    return container;
  }

  function createRuneSelector(opts) {
    var runes = opts.runes;
    var noneLabel = opts.noneLabel;
    var prompt = opts.prompt || noneLabel;
    var onChange = opts.onChange;

    var initial = opts.values || [];
    var current = [];
    for (var ci = 0; ci < 9; ci++) {
      current.push(initial[ci] !== undefined ? initial[ci] : noneLabel);
    }


    function toUI(val) { return (val === noneLabel || val === undefined) ? prompt : val; }
    function fromUI(val) { return val === prompt ? noneLabel : val; }

    var container = createEl('div', { class: 'fc-rune-selector' });
    var runeNames = runes.map(function (r) { return r.name; });
    var options = [prompt].concat(runeNames);

    var dropdowns = [];
    var lineEls = [];
    for (var line = 0; line < RUNE_UNLOCK_LEVELS.length; line++) {
      var lineEl = createEl('div', { class: 'fc-rune-line' });
      var lineLabel = createEl('span', { class: 'fc-rune-line-label' }, ['Rune ' + (line + 1)]);
      lineEl.appendChild(lineLabel);
      lineLabel.appendChild(createEl('span', { class: 'fc-rune-line-lock' }, ['Unlocks at +' + RUNE_UNLOCK_LEVELS[line]]));
      lineEls.push(lineEl);
      for (var col = 0; col < 3; col++) {
        (function (idx) {
          var dropdown = createSearchableDropdown({
            options: options,
            value: toUI(current[idx]),
            placeholder: prompt,
            id: 'rune-slot-' + idx,
            onChange: function (name) {
              current[idx] = fromUI(name);
              onChange(current.slice());
            }
          });
          dropdowns.push(dropdown);
          var slotEl = createEl('div', { class: 'fc-rune-slot' });
          slotEl.appendChild(dropdown);
          lineEl.appendChild(slotEl);
        })(line * 3 + col);
      }
      container.appendChild(lineEl);
    }

    container.setValues = function (vals) {
      vals = vals || [];
      current = [];
      for (var i = 0; i < 9; i++) {
        current.push(vals[i] !== undefined ? vals[i] : noneLabel);
      }
      for (var d = 0; d < 9; d++) {
        dropdowns[d].setValue(toUI(current[d]));
      }
    };
    container.getValues = function () { return current.slice(); };

    container.setEnhancement = function (level) {
      lineEls.forEach(function (lineEl, line) {
        var locked = !(level >= RUNE_UNLOCK_LEVELS[line]);
        lineEl.classList.toggle('fc-rune-line--locked', locked);
        for (var c = 0; c < RUNE_CELLS_PER_LINE; c++) {
          dropdowns[line * RUNE_CELLS_PER_LINE + c].setDisabled(locked);
        }
      });
    };
    container.setEnhancement(opts.enhancement);

    return container;
  }

  function createResultsCard(opts) {
    var card = createEl('div', { class: 'fc-card' });
    var head = createEl('div', { class: 'fc-card-head' });
    if (!opts.hideIcon) {
      var iconEl = createEl('span', { class: 'fc-card-icon' }, ['◆']);
      head.appendChild(iconEl);
    }
    var titleEl = createEl('span', { class: 'fc-card-title' }, [opts.title]);
    head.append(titleEl);

    var body = createEl('div', { class: 'fc-card-body' });
    var rowsContainer = createEl('div', { class: 'fc-stat-rows' });
    rowsContainer.append(opts.content);
    body.appendChild(rowsContainer);

    card.append(head, body);
    return card;
  }

  function updateResultsCard(card, content) {
    var rowsContainer = card.querySelector('.fc-stat-rows');
    if (rowsContainer) {
      empty(rowsContainer);
      rowsContainer.append(content);
    }
  }

  function createStatRow(opts) {
    var row = createEl('div', { class: 'fc-stat-row' });
    var labelEl = createEl('span', { class: ('fc-stat-label ' + (opts.labelClass || '')).trim() }, [opts.label]);
    var valueClass = ('fc-stat-val ' + (opts.valueClass || '')).trim();
    var valueEl = createEl('span', { class: valueClass }, [opts.value !== undefined ? opts.value : '']);
    if (opts.isCap) { valueEl.classList.add(CAP_CLASS); }


    valueEl.classList.add('fc-copyable');
    valueEl.setAttribute('title', 'Click to copy');
    valueEl.addEventListener('click', function () {
      var t = valueEl.textContent.trim();
      if (!t || t === '—' || t === '∞') { return; }
      writeClipboard(t, 'Copied: ' + t);
    });

    row.append(labelEl, valueEl);
    return row;
  }

  function updateStatRow(row, value, isCap) {
    var valueEl = row.querySelector('.fc-stat-val');
    if (valueEl) {
      valueEl.textContent = value;
      valueEl.classList.toggle(CAP_CLASS, !!isCap);
    }
  }

  function createStatRows(rows) {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
      fragment.appendChild(createStatRow(rows[i]));
    }
    return fragment;
  }

  function fmt2(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '∞'; }
    return n.toFixed(2);
  }

  function pctFmt(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '—'; }
    return (n * 100).toFixed(1) + '%';
  }

  function fmtDps(n) {
    if (n === null || n === undefined || !isFinite(n)) { return '—'; }
    if (n >= 10000) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
    return fmt2(n);
  }

  function fmtTime(n) {
    if (n === null || n === undefined) { return '—'; }
    if (!isFinite(n)) { return '∞'; }
    if (n < 60) { return fmt2(n) + 's'; }
    var mins = Math.floor(n / 60);
    var secs = Math.round(n % 60);
    return mins + 'm ' + secs + 's';
  }












  var SECTION_ICON_FILES = {
    weapon:      'ForgeCalculator-weapon.png',
    ore:         'ForgeCalculator-ore.png',
    race:        'ForgeCalculator-race.png',
    berserk:     'ForgeCalculator-berserk.png',
    achievement: 'ForgeCalculator-achievement.png',
    rune:        'ForgeCalculator-rune.png',
    armor:       'ForgeCalculator-armor.png',
    ability:     'ForgeCalculator-ability.png',
    fire:        'ForgeCalculator-fire.png',
    blast:       'ForgeCalculator-blast.png',
    poison:      'ForgeCalculator-poison.png',
    reset:       'ForgeCalculator-reset.png',
    calc:        'ForgeCalculator-calc.png'
  };


  var ICON_PLACEHOLDERS = [];

  function iconImg(name, alt) {
    var wrap = createEl('span', { class: 'fc-section-icon fc-section-icon--' + name });
    var file = SECTION_ICON_FILES[name] || SECTION_ICON_FILES.ability;
    ICON_PLACEHOLDERS.push({ wrap: wrap, file: file, alt: alt || name });
    return wrap;
  }




  function splitIconHtml(html) {
    var blocks = String(html || '').match(/<p>[\s\S]*?<\/p>/g);
    if (!blocks) { return []; }
    return blocks.map(function (b) {
      return b.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
    });
  }

  function loadSectionIcons() {
    var pending = ICON_PLACEHOLDERS.slice();
    if (!pending.length) { return; }
    if (!mw.loader || typeof mw.loader.using !== 'function') { return; }
    mw.loader.using('mediawiki.api').then(function () {
      if (!mw.Api) { return; }
      var api = new mw.Api();
      if (!api || typeof api.parse !== 'function') { return; }
      var text = pending.map(function (p) {
        return '[[File:' + p.file + '|frameless|link=File:' + p.file + '|alt=' + p.alt + '|24px]]';
      }).join('\n\n');
      api.parse(text).then(function (html) {
        var blocks = splitIconHtml(html);
        for (var i = 0; i < pending.length && i < blocks.length; i++) {
          pending[i].wrap.innerHTML = blocks[i];
        }
      }, function () {

      });
    });
  }


  function sectionHeader(title) {
    var wrap = createEl('div', { class: 'fc-section' });
    wrap.append(
      createEl('span', { class: 'fc-section-dot' }),
      createEl('h2', { class: 'fc-section-title' }, [title]),
      createEl('span', { class: 'fc-section-line' })
    );
    return wrap;
  }

  function createTabber(id, tabs) {
    var container = createEl('div', { class: 'fc-tabber' });
    var bar = createEl('div', { class: 'fc-tabs', role: 'tablist' });
    var buttons = [];
    var panels = [];
    function select(index) {
      for (var j = 0; j < tabs.length; j++) {
        buttons[j].classList.toggle('fc-tab--active', j === index);
        buttons[j].setAttribute('aria-selected', j === index ? 'true' : 'false');
        panels[j].classList.toggle('fc-hidden', j !== index);
      }
    }
    tabs.forEach(function (tab, index) {
      var button = createEl('button', {
        type: 'button', class: 'fc-tab', role: 'tab', id: id + '-tab-' + (index + 1)
      }, [tab.title]);
      button.addEventListener('click', function (e) { e.preventDefault(); select(index); });
      var panel = createEl('div', { class: 'fc-tab-panel', role: 'tabpanel' });
      tab.content.forEach(function (node) { panel.appendChild(node); });
      buttons.push(button);
      panels.push(panel);
      bar.appendChild(button);
    });
    container.appendChild(bar);
    panels.forEach(function (panel) { container.appendChild(panel); });
    select(0);
    container.select = select;
    return container;
  }

  var HERO_ART_FILE = 'Gradient Weapons.webp';

  function createHero() {
    var hero = createEl('div', { class: 'fc-hero' });
    var art = createEl('div', { class: 'fc-hero-art' });
    var left = createEl('div', { class: 'fc-hero-left' });
    var stats = createEl('div', { class: 'fc-hero-stats' });
    var values = {};
    [
      { key: 'total', sub: 'Total DPS' },
      { key: 'skeleton', sub: 'Skeleton King (7,200 HP)' },
      { key: 'golem', sub: 'Golem (25,000 HP)' },
      { key: 'asura', sub: 'Asura (75,000 HP)' }
    ].forEach(function (item) {
      var value = createEl('div', { class: 'fc-hero-stat-label' }, ['—']);
      values[item.key] = value;
      stats.appendChild(createEl('div', { class: 'fc-hero-stat' }, [
        value,
        createEl('div', { class: 'fc-hero-stat-sub' }, [item.sub])
      ]));
    });
    left.append(
      createEl('span', { class: 'fc-hero-badge' }, ['DPS Calculator']),
      createEl('div', { class: 'fc-hero-title' }, ['Forge Calculator']),
      createEl('div', { class: 'fc-hero-desc' }, [
        'Pick your ores, weapon, race, runes and Golemites, then press Calculate DPS to see your damage, ' +
        'every proc and how long a boss takes to fall. Percentages are whole numbers (15 = 15%).'
      ]),
      stats
    );
    hero.append(art, createEl('div', { class: 'fc-hero-gradient' }), left);
    hero.update = function (result) {
      values.total.textContent = fmtDps(result.total_dps);
      values.skeleton.textContent = fmtTime(result.ttk_skeleton);
      values.golem.textContent = fmtTime(result.ttk_25k);
      values.asura.textContent = fmtTime(result.ttk_75k);
    };
    loadHeroArt(art);
    return hero;
  }

  function loadHeroArt(wrap) {
    if (!mw.loader || typeof mw.loader.using !== 'function') { return; }
    mw.loader.using('mediawiki.api').then(function () {
      if (!mw.Api) { return; }
      var api = new mw.Api();
      if (!api || typeof api.parse !== 'function') { return; }
      api.parse('[[File:' + HERO_ART_FILE + '|frameless|900px|link=|alt=]]').then(function (html) {
        var img = /<img[^>]*>/.exec(String(html || ''));
        if (img) { wrap.innerHTML = img[0]; }
      }, function () {});
    });
  }

  function createActionBar(handlers) {
    var bar = createEl('div', { class: 'fc-toolbar' });
    var resetBtn = createEl('button', { class: 'fc-btn fc-btn--reset', type: 'button' },
      [iconImg('reset', 'Reset'), 'Reset']);
    var calcBtn = createEl('button', { class: 'fc-btn fc-btn--calc', type: 'button' },
      [iconImg('calc', 'Calculate DPS'), 'Calculate DPS']);
    resetBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onReset(); });
    calcBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onCalculate(); });
    bar.append(resetBtn, calcBtn);
    return bar;
  }

  function sectionTitle(title, iconName) {
    var h3 = createEl('h3', { class: 'fc-input-section-title' });
    h3.appendChild(iconImg(iconName, title));
    h3.appendChild(document.createTextNode(title));
    return h3;
  }



  function dpsRow(key, label, cls, trait) {
    return { key: key, label: label, valueClass: cls, labelClass: cls, value: '0', format: fmtDps, trait: !!trait };
  }

  function capRow(key, label) {
    return { key: key, label: label, valueClass: 'fc-sv-pct', value: '0.00%', format: pctFmt, cap: CAPS[key === 'berserk_level' ? 'berserk' : key] };
  }

  var CORE_ROWS = [
    { key: 'unforged_damage', label: 'Base Damage', value: '0', valueClass: 'fc-sv-dmg', format: fmtDps },
    { key: 'avg_power', label: 'Average Multiplier', value: '0.00x', valueClass: 'fc-sv-mult', format: function (n) { return fmt2(n) + 'x'; } },
    { key: 'forged_damage', label: 'Weapon Damage', value: '0', valueClass: 'fc-sv-dmg', format: fmtDps },
    { key: 'attack_rate', label: 'Attack Rate', value: '0.00', valueClass: 'fc-sv-rate', format: fmt2 },
    { key: 'weapon_dps', label: 'Weapon DPS', value: '0', valueClass: 'fc-sv-dmg', format: fmtDps }
  ];

  var STAT_ROWS = [
    capRow('lethality', 'Lethality'),
    capRow('crit_chance', 'Crit Chance'),
    capRow('crit_dmg', 'Crit Damage'),
    capRow('atk_speed', 'Attack Speed'),
    capRow('berserk_level', 'Berserk')
  ];

  var DPS_ROWS = [
    dpsRow('weapon_dps', 'Weapon DPS', 'fc-sv-dmg'),
    dpsRow('explosion_dps', 'Explosion DPS', 'fc-sv-blast', true),
    dpsRow('fire_dps', 'Fire DPS', 'fc-sv-fire', true),
    dpsRow('poison_dps', 'Poison DPS', 'fc-sv-poison', true),
    dpsRow('smite_dps', 'Smite DPS', 'fc-sv-smite', true),
    dpsRow('blackhole_dps', 'Black Hole DPS', 'fc-sv-blackhole', true),
    dpsRow('lightning_dps', 'Lightning DPS', 'fc-sv-lightning', true),
    dpsRow('prismatic_shift_dps', 'Prismatic Shift DPS', 'fc-sv-prismatic', true),
    dpsRow('smash_dps', 'Smash DPS', 'fc-sv-smash', true),
    dpsRow('fox_claws_dps', 'Fox Claws DPS', 'fc-sv-foxclaws', true),
    dpsRow('foxfire_dps', 'Foxfire DPS', 'fc-sv-foxfire', true),
    dpsRow('archangel_smite_dps', 'Archangel Smite DPS', 'fc-sv-smite', true),
    dpsRow('cursed_aura_dps', 'Cursed Aura DPS', 'fc-sv-aura', true),
    dpsRow('dark_smite_dps', 'Dark Smite DPS', 'fc-sv-darksmite', true),
    dpsRow('trident_toss_dps', 'Trident Toss DPS', 'fc-sv-dmg', true),
    dpsRow('golemite_dps', 'Golemite DPS', 'fc-sv-golemite', true),
    dpsRow('reverberation_dps', 'Reverberation DPS', 'fc-sv-dmg', true),
    dpsRow('frost_slash_dps', 'Frost Slash DPS', 'fc-sv-frost', true),
    dpsRow('glacier_explosion_dps', 'Glacier Explosion DPS', 'fc-sv-frost', true),
    dpsRow('starfall_dps', 'Starfall DPS', 'fc-sv-star', true),
    dpsRow('stellar_mark_dps', 'Stellar Mark DPS', 'fc-sv-star', true),
    dpsRow('ancient_poison_dps', 'Ancient Poison DPS', 'fc-sv-poison', true),
    { key: 'total_dps', label: 'Total DPS', value: '0', valueClass: 'fc-sv-dmg fc-bold', labelClass: 'fc-sv-dmg', format: fmtDps },
    { key: 'berserk', label: 'Total Berserk DPS', value: '—', valueClass: 'fc-sv-berserk', labelClass: 'fc-sv-berserk', format: fmtDps },
    { key: 'moonstone', label: 'Total Moonstone DPS', value: '—', valueClass: 'fc-sv-moonstone', labelClass: 'fc-sv-moonstone', format: fmtDps }
  ];

  var TTK_ROWS = [
    { key: 'ttk_skeleton', label: 'Time taken to defeat Skeleton King', value: '0.00s', valueClass: 'fc-sv-time', format: fmtTime },
    { key: 'ttk_25k', label: 'Time taken to defeat Golem', value: '0.00s', valueClass: 'fc-sv-time', format: fmtTime },
    { key: 'ttk_75k', label: 'Time taken to defeat Asura', value: '0.00s', valueClass: 'fc-sv-time', format: fmtTime }
  ];

  function createKeyedRows(specs, rowIndex) {
    var fragment = document.createDocumentFragment();
    specs.forEach(function (spec) {
      var row = createStatRow(spec);
      row.setAttribute('data-key', spec.key);
      rowIndex[spec.key] = row;
      fragment.appendChild(row);
    });
    return fragment;
  }

  function updateKeyedRows(specs, rowIndex, result) {
    specs.forEach(function (spec) {
      var value = result[spec.key];
      var isCap = spec.cap !== undefined && value >= spec.cap;
      updateStatRow(rowIndex[spec.key], spec.format(value), isCap);
    });
  }

  function createResultsPanel(handlers) {
    var container = createEl('div', { class: 'fc-results-panel' });

    var cardsContainer = createEl('div', { class: 'fc-results-cards' });
    container.append(sectionHeader('Results'), cardsContainer);
    var rowsByKey = { core: {}, stats: {}, dps: {}, ttk: {} };

    var coreDpsCard = createResultsCard({
      title: 'Core DPS',
      content: createKeyedRows(CORE_ROWS, rowsByKey.core)
    });

    var statsCard = createResultsCard({
      title: 'Stats (Capped)',
      content: createKeyedRows(STAT_ROWS, rowsByKey.stats)
    });

    var dpsCard = createResultsCard({
      title: 'DPS Breakdown',
      content: createKeyedRows(DPS_ROWS, rowsByKey.dps)
    });

    var ttkCard = createResultsCard({
      title: 'Time to Kill',
      content: createKeyedRows(TTK_ROWS, rowsByKey.ttk)
    });

    var traitsCard = createResultsCard({
      title: 'Active Traits',
      content: createStatRows([
        { label: 'No active traits', value: '' }
      ])
    });

    var totalDpsCard = createResultsCard({
      title: 'Total DPS',
      hideIcon: true,
      content: createStatRows([
        { label: '', value: '0' }
      ])
    });


    var traitToggle = createEl('div', { class: 'fc-trait-toggle' });
    var traitToggleText = createEl('label', { for: 'fc-showTraitDps' }, ['Show trait DPS']);
    var traitToggleBox = createEl('button', { type: 'button', class: 'fc-check fc-trait-toggle-box', id: 'fc-showTraitDps', role: 'checkbox' });
    function setTraitToggle(on) {
      traitToggleBox.setAttribute('aria-checked', on ? 'true' : 'false');
      traitToggleBox.classList.toggle('fc-check--on', on);
      traitToggleBox.textContent = on ? '✓' : '';
    }
    setTraitToggle(state.showTraitDps);
    traitToggle.append(traitToggleText, traitToggleBox);
    dpsCard.querySelector('.fc-card-head').append(traitToggle);
    var traitDpsRows = DPS_ROWS.filter(function (spec) { return spec.trait; }).map(function (spec) {
      return rowsByKey.dps[spec.key];
    });
    function applyTraitDpsVisibility() {
      traitDpsRows.forEach(function (row) { row.classList.toggle('fc-hidden', !state.showTraitDps); });
    }
    applyTraitDpsVisibility();
    traitToggleBox.addEventListener('click', function () {
      state.showTraitDps = traitToggleBox.getAttribute('aria-checked') !== 'true';
      setTraitToggle(state.showTraitDps);
      saveShowTraitDps(state.showTraitDps);
      applyTraitDpsVisibility();
    });

    totalDpsCard.classList.add('fc-card--total');
    coreDpsCard.classList.add('fc-card--core');
    statsCard.classList.add('fc-card--stats');
    dpsCard.classList.add('fc-card--dps');
    ttkCard.classList.add('fc-card--ttk');
    traitsCard.classList.add('fc-card--traits');

    cardsContainer.append(totalDpsCard, dpsCard, statsCard, traitsCard, coreDpsCard, ttkCard);

    container.updateResults = function (result) {
      if (!result) { return; }

      var totalRows = totalDpsCard.querySelectorAll('.fc-stat-row');
      if (totalRows.length >= 1) {
        updateStatRow(totalRows[0], fmtDps(result.total_dps), false);
      }

      updateKeyedRows(CORE_ROWS, rowsByKey.core, result);
      updateKeyedRows(STAT_ROWS, rowsByKey.stats, result);
      updateKeyedRows(DPS_ROWS, rowsByKey.dps, result);
      updateKeyedRows(TTK_ROWS, rowsByKey.ttk, result);

      if (result.active_traits) {


        var traitsBlock = createEl('div', { class: 'fc-traits-block' });
        var traitsValue = createEl('div', { class: 'fc-traits-value', style: { whiteSpace: 'pre-line' } }, [result.active_traits]);
        traitsValue.classList.add('fc-copyable');
        traitsValue.setAttribute('title', 'Click to copy');
        traitsValue.addEventListener('click', function () {
          var t = traitsValue.textContent.trim();
          if (t) { writeClipboard(t, 'Copied: ' + t); }
        });
        traitsBlock.append(
          createEl('div', { class: 'fc-traits-label' }, ['Active Traits']),
          traitsValue
        );
        updateResultsCard(traitsCard, traitsBlock);
      }
    };

    return container;
  }

  function createInputPanel(opts) {
    var data = opts.data;
    var getBuild = opts.getBuild;
    var onBuildChange = opts.onBuildChange;
    var onCalculate = opts.onCalculate;

    var noneLabel = data.constants.noneLabel;
    var selectOreLabel = data.constants.selectOreLabel;


    var ORE_PROMPT = 'Select Ores';
    var RACE_PROMPT = 'Select Race';
    var WEAPON_TYPE_PROMPT = 'Select Weapon Type';
    var WEAPON_PROMPT = 'Select Weapon';
    var ENHANCEMENT_PROMPT = 'Select Enhancement';
    var ACHIEVEMENT_PROMPT = 'Select Achievement';
    var RUNE_PROMPT = 'Select Rune';

    function toUI(val, prompt) { return (val === noneLabel || val === undefined) ? prompt : val; }
    function fromUI(val, prompt) { return val === prompt ? noneLabel : val; }

    var container = createEl('div', { class: 'fc-input-panel' });

    container.appendChild(sectionHeader('Build'));

    function patch(partial) {
      var merged = {};
      var base = getBuild();
      for (var k in base) { merged[k] = base[k]; }
      for (var p in partial) { merged[p] = partial[p]; }
      onBuildChange(merged);
    }

    var oreSection = createEl('div', { class: 'fc-input-section' });
    oreSection.appendChild(sectionTitle('Ore Slots', 'ore'));

    var oreNames = data.ores.map(function (o) { return o.name; });
    var oreMultipliers = {};
    for (var j = 0; j < data.ores.length; j++) {
      oreMultipliers[data.ores[j].name] = data.ores[j].multiplier;
    }
    var oreSlots = [];
    var oreGrid = createEl('div', { class: 'fc-ore-grid' });
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var slotBuild = getBuild().oreSlots[idx] || { name: noneLabel, amount: 0 };
        var slot = createOreSlot({
          index: idx,
          oreNames: oreNames,
          noneLabel: noneLabel,
          selectOreLabel: selectOreLabel,
          prompt: ORE_PROMPT,
          oreMultipliers: oreMultipliers,
          value: slotBuild.name,
          amount: slotBuild.amount || 0,
          onChange: function (name, amount) {
            var slots = getBuild().oreSlots.slice();
            slots[idx] = { name: name, amount: amount };
            patch({ oreSlots: slots });
            weaponSelector.setOreTotal(oreTotalOf(getBuild()));
            renderWeaponTraits(getBuild());
          }
        });
        oreSlots.push(slot);
        oreGrid.appendChild(slot);
      })(i);
    }
    oreSection.appendChild(oreGrid);

    var weaponTraitsBox = createEl('div', { class: 'fc-golemite-summary fc-weapon-traits', id: 'fc-weapon-traits' });
    function renderWeaponTraits(build) {
      empty(weaponTraitsBox);
      weaponTraitsBox.appendChild(createEl('div', { class: 'fc-weapon-traits-title' }, ['Weapon Traits']));
      var lines = weaponTraitLines(build.oreSlots, data);
      if (!lines.length) {
        weaponTraitsBox.appendChild(createEl('p', { class: 'fc-golemite-summary-empty' }, [
          'Add ores to see the traits your weapon will have. An ore needs at least 10% of the total amount to give its traits.'
        ]));
        return;
      }
      var list = createEl('div', { class: 'fc-weapon-traits-list' });
      lines.forEach(function (line) { list.appendChild(createEl('div', { class: 'fc-weapon-trait' }, [line])); });
      weaponTraitsBox.appendChild(list);
    }
    renderWeaponTraits(getBuild());
    oreSection.appendChild(weaponTraitsBox);

    var weaponSection = createEl('div', { class: 'fc-input-section fc-input-section--flat' });
    weaponSection.appendChild(sectionTitle('Weapon', 'weapon'));

    function oreTotalOf(build) {
      var total = 0;
      for (var t = 0; t < build.oreSlots.length; t++) { total += Number(build.oreSlots[t].amount) || 0; }
      return total;
    }

    var weaponSelector = createWeaponSelector({
      typeMinOre: data.weapon_type_min_ore,
      notEnoughOre: data.not_enough_ore,
      oreTotal: oreTotalOf(getBuild()),
      weaponTypes: data.weapon_types,
      weapons: data.weapons,
      noneLabel: noneLabel,
      weaponTypePrompt: WEAPON_TYPE_PROMPT,
      weaponPrompt: WEAPON_PROMPT,
      enhancementPrompt: ENHANCEMENT_PROMPT,
      weaponType: getBuild().weaponType,
      weaponName: getBuild().weaponName,
      quality: getBuild().quality,
      enhancement: getBuild().enhancement,
      onChange: function (weaponType, weaponName, quality, enhancement) {
        patch({ weaponType: weaponType, weaponName: weaponName, quality: quality, enhancement: enhancement });
        if (runeSelector) { runeSelector.setEnhancement(Number(enhancement) || 0); }
      }
    });
    weaponSection.appendChild(weaponSelector);




    var metaWrap = createEl('div', { class: 'fc-meta-wrap' });
    var raceSection = createEl('div', { class: 'fc-input-section' });
    raceSection.appendChild(sectionTitle('Race', 'race'));

    var raceWrapper = createEl('div', { class: 'fc-race-wrapper' });
    var raceLabel = createEl('label', { for: 'race-select' }, ['Race']);
    var raceOptions = [RACE_PROMPT].concat(data.races.map(function (r) { return r.name; }));
    var raceDropdown = createSearchableDropdown({
      options: raceOptions,
      value: toUI(getBuild().race, RACE_PROMPT),
      placeholder: RACE_PROMPT,
      id: 'race-select',
      onChange: function (race) {
        var picked = fromUI(race, RACE_PROMPT);
        patch({ race: picked });
        syncSituational(picked);
      }
    });
    raceWrapper.append(raceLabel, raceDropdown);

    raceSection.appendChild(raceWrapper);
    metaWrap.appendChild(raceSection);

    var berserkSection = createEl('div', { class: 'fc-input-section' });
    berserkSection.appendChild(sectionTitle('Berserk', 'berserk'));

    var berserkWrapper = createEl('div', { class: 'fc-berserk-wrapper' });
    var berserkLabel = createEl('label', { for: 'berserk' }, ['Berserk']);
    var berserkInput = createEl('input', {
      type: 'number',
      class: 'fc-stat-input-input',
      id: 'berserk',
      value: getBuild().berserk !== undefined ? getBuild().berserk : '',
      min: '0',
      max: '200',
      step: 1,
      placeholder: '0',
      inputmode: 'numeric'
    });
    function commitBerserk() {
      var v = Math.max(0, Math.min(parseFloat(berserkInput.value) || 0, 200));
      berserkInput.value = v;
      patch({ berserk: v });
    }
    var handleBerserkChange = debounce(commitBerserk, 150);
    berserkInput.addEventListener('input', handleBerserkChange);
    berserkInput.addEventListener('change', commitBerserk);
    berserkWrapper.append(berserkLabel, berserkInput);
    berserkSection.appendChild(berserkWrapper);
    metaWrap.appendChild(berserkSection);

    var situationalSection = createEl('div', { class: 'fc-input-section fc-situational-section' });
    situationalSection.appendChild(sectionTitle('Situational', 'race'));
    var situationalGrid = createEl('div', { class: 'fc-situational-grid' });
    situationalSection.appendChild(situationalGrid);

    function numberField(key, labelText, max, toNumber) {
      var wrapper = createEl('div', { class: 'fc-berserk-wrapper' });
      var label = createEl('label', { for: 'fc-' + key }, [labelText]);
      var attrs = {
        type: 'number', class: 'fc-stat-input-input', id: 'fc-' + key,
        value: getBuild()[key] !== undefined ? getBuild()[key] : 0,
        min: '0', step: 1, placeholder: '0', inputmode: 'numeric'
      };
      if (max !== null) { attrs.max = String(max); }
      var input = createEl('input', attrs);
      function commit() {
        var v = Math.max(0, toNumber(parseFloat(input.value) || 0));
        if (max !== null) { v = Math.min(v, max); }
        input.value = v;
        var change = {};
        change[key] = v;
        patch(change);
      }
      input.addEventListener('input', debounce(commit, 150));
      input.addEventListener('change', commit);
      wrapper.append(label, input);
      situationalGrid.appendChild(wrapper);
      return { wrapper: wrapper, input: input };
    }

    var orcHpField = numberField('orcLordHpMissing', 'HP missing %', 100, function (v) { return v; });
    var orcKillsField = numberField('orcLordKillStacks', 'Kill stacks', 5, Math.floor);
    var groveWrapper = createEl('div', { class: 'fc-berserk-wrapper' });
    var groveLabel = createEl('label', { for: 'fc-dryadInGrove' }, ['In grove']);
    var groveInput = createEl('button', { type: 'button', class: 'fc-check', id: 'fc-dryadInGrove', role: 'checkbox' });
    function setGrove(on) {
      groveInput.setAttribute('aria-checked', on ? 'true' : 'false');
      groveInput.classList.toggle('fc-check--on', on);
      groveInput.textContent = on ? '✓' : '';
    }
    setGrove(getBuild().dryadInGrove === true);
    groveInput.addEventListener('click', function () {
      var on = groveInput.getAttribute('aria-checked') !== 'true';
      setGrove(on);
      patch({ dryadInGrove: on });
    });
    groveWrapper.append(groveLabel, groveInput);
    situationalGrid.appendChild(groveWrapper);
    var dryadHpField = numberField('dryadMaxHp', 'Max HP', null, Math.floor);

    function syncSituational(race) {
      var isOrcLord = race === 'Orc Lord';
      var isDryad = race === 'Dryad';
      orcHpField.wrapper.style.display = isOrcLord ? '' : 'none';
      orcKillsField.wrapper.style.display = isOrcLord ? '' : 'none';
      groveWrapper.style.display = isDryad ? '' : 'none';
      dryadHpField.wrapper.style.display = isDryad ? '' : 'none';
      situationalSection.style.display = isOrcLord || isDryad ? '' : 'none';
    }
    syncSituational(getBuild().race);

    var statSection = createEl('div', { class: 'fc-input-section' });
    statSection.appendChild(sectionTitle('Armor Stats', 'armor'));

    var ARMOR_PIECES = [
      { slot: 'helmet', key: 'armorHelmet', label: 'Helmet', prompt: 'Select Helmet' },
      { slot: 'chestplate', key: 'armorChestplate', label: 'Chestplate', prompt: 'Select Chestplate' },
      { slot: 'leggings', key: 'armorLeggings', label: 'Leggings', prompt: 'Select Leggings' }
    ];
    var armorSetGrid = createEl('div', { class: 'fc-armor-set-grid' });
    var armorDropdowns = {};
    ARMOR_PIECES.forEach(function (piece) {
      var wrapper = createEl('div', { class: 'fc-race-wrapper' });
      var label = createEl('label', { for: 'armor-' + piece.slot + '-select' }, [piece.label]);
      var names = Object.keys(ARMOR_SETS).filter(function (n) { return ARMOR_SETS[n].slots.indexOf(piece.slot) !== -1; });
      var dropdown = createSearchableDropdown({
        options: [piece.prompt].concat(names),
        value: toUI(getBuild()[piece.key], piece.prompt),
        placeholder: piece.prompt,
        id: 'armor-' + piece.slot + '-select',
        onChange: function (name) {
          var patchValues = {};
          patchValues[piece.key] = fromUI(name, piece.prompt);
          patch(patchValues);
        }
      });
      armorDropdowns[piece.key] = { dropdown: dropdown, prompt: piece.prompt };
      wrapper.append(label, dropdown);
      armorSetGrid.appendChild(wrapper);
    });
    statSection.appendChild(armorSetGrid);
    statSection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      "Each matching piece gives its share of the weapon bonus: a third per piece, a half per piece for Juggernaut, all of it for Goblin's Crown."
    ]));

    var statInput = createStatInput({
      values: {
        armorLethality: getBuild().armorLethality,
        armorCritChance: getBuild().armorCritChance,
        armorCritDmg: getBuild().armorCritDmg
      },
      onChange: function (values) { patch(values); }
    });
    statSection.appendChild(statInput);

    var abilitySection = createEl('div', { class: 'fc-input-section' });
    abilitySection.appendChild(sectionTitle('Abilities (From Runes)', 'ability'));
    abilitySection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      'Input abilities from Runes. Enter percentage as whole number.'
    ]));

    var abilityGrid = createAbilityGrid({
      values: {
        fireDmg: getBuild().fireDmg,
        fireChance: getBuild().fireChance,
        fireTime: getBuild().fireTime,
        poisonDmg: getBuild().poisonDmg,
        poisonChance: getBuild().poisonChance,
        poisonTime: getBuild().poisonTime,
        lightningDmg: getBuild().lightningDmg,
        lightningChance: getBuild().lightningChance,
        lightningCooldown: getBuild().lightningCooldown,
        blastDmg: getBuild().blastDmg,
        blastChance: getBuild().blastChance
      },
      onChange: function (values) { patch(values); }
    });
    abilitySection.appendChild(abilityGrid);

    var golemiteSection = createEl('div', { class: 'fc-input-section' });
    golemiteSection.appendChild(sectionTitle('Golemites', 'golemite'));
    golemiteSection.appendChild(createEl('p', { class: 'fc-input-section-subtext' }, [
      'Up to two Golemites. Pick the ores you forged each one with, like a weapon. Its rarity is the rarest ore used, and every ore trait is scaled by that rarity (Common ×0.06 up to Divine ×0.30).'
    ]));
    var golemiteInputs = createGolemiteInputs({
      values: getBuild().golemites,
      oreNames: oreNames,
      oreMultipliers: oreMultipliers,
      noneLabel: noneLabel,
      selectOreLabel: selectOreLabel,
      prompt: ORE_PROMPT,
      describe: function (g) { return deriveGolemiteStats(g.slots, data); },
      onChange: function (list) { patch({ golemites: list }); }
    });
    golemiteSection.appendChild(golemiteInputs);

    var runeSection = createEl('div', { class: 'fc-input-section' });
    runeSection.appendChild(sectionTitle('Runes', 'rune'));

    var runeSelector = createRuneSelector({
      runes: data.runes,
      values: getBuild().runes || [],
      noneLabel: noneLabel,
      prompt: RUNE_PROMPT,
      enhancement: Number(getBuild().enhancement) || 0,
      onChange: function (runes) { patch({ runes: runes }); }
    });
    runeSection.appendChild(runeSelector);

    var achievementSection = createEl('div', { class: 'fc-input-section' });
    achievementSection.appendChild(sectionTitle('Achievement', 'achievement'));

    var achievementWrapper = createEl('div', { class: 'fc-achievement-wrapper' });
    var achievementLabel = createEl('label', { for: 'achievement-select' }, ['Achievement']);
    var achievementNames = data.achievements
      .map(function (a) { return a.name; })
      .filter(function (n) { return n !== noneLabel && n !== 'None'; });
    var achievementOptions = [ACHIEVEMENT_PROMPT].concat(achievementNames);
    var achievementDropdown = createSearchableDropdown({
      options: achievementOptions,
      value: toUI(getBuild().achievement, ACHIEVEMENT_PROMPT),
      placeholder: ACHIEVEMENT_PROMPT,
      id: 'achievement-select',
      onChange: function (name) { patch({ achievement: fromUI(name, ACHIEVEMENT_PROMPT) }); }
    });
    achievementWrapper.append(achievementLabel, achievementDropdown);
    achievementSection.appendChild(achievementWrapper);
    metaWrap.appendChild(achievementSection);

    var metaRow = createEl('div', { class: 'fc-meta-row' });
    metaRow.append(metaWrap, situationalSection);

    container.appendChild(createTabber('fc-build', [
      { title: 'Weapon & Ores', content: [weaponSection, oreSection] },
      { title: 'Race & Bonuses', content: [metaRow] },
      { title: 'Runes & Armor', content: [runeSection, statSection] },
      { title: 'Abilities', content: [abilitySection] },
      { title: 'Golemites', content: [golemiteSection] }
    ]));

    var warningsBox = createEl('div', { class: 'fc-warnings fc-hidden' });
    container.appendChild(warningsBox);
    if (opts.actions) { container.appendChild(opts.actions); }


    container.refreshWarnings = function () {
      var list = computeWarnings(getBuild());
      if (abilityGrid.getInvalidAbilityWarnings) {
        list = list.concat(abilityGrid.getInvalidAbilityWarnings());
      }
      empty(warningsBox);
      if (list.length) {
        for (var i = 0; i < list.length; i++) {
          warningsBox.appendChild(createEl('div', { class: 'fc-warning' }, ['⚠ ' + list[i]]));
        }
        warningsBox.classList.remove('fc-hidden');
      } else {
        warningsBox.classList.add('fc-hidden');
      }
    };

    container.setBuild = function (newBuild) {
      for (var s = 0; s < 4; s++) {
        var slot = newBuild.oreSlots[s] || { name: noneLabel, amount: 0 };
        oreSlots[s].setValue(slot.name, slot.amount || 0);
      }
      weaponSelector.setOreTotal(oreTotalOf(newBuild));
      renderWeaponTraits(newBuild);
      weaponSelector.setValues(
        newBuild.weaponType || noneLabel,
        newBuild.weaponName || noneLabel,
        newBuild.quality !== undefined ? newBuild.quality : 100,
        newBuild.enhancement !== undefined ? newBuild.enhancement : 0
      );
      raceDropdown.setValue(toUI(newBuild.race, RACE_PROMPT));
      if (berserkInput) {
        berserkInput.value = newBuild.berserk !== undefined ? newBuild.berserk : 0;
      }
      orcHpField.input.value = newBuild.orcLordHpMissing || 0;
      orcKillsField.input.value = newBuild.orcLordKillStacks || 0;
      setGrove(newBuild.dryadInGrove === true);
      dryadHpField.input.value = newBuild.dryadMaxHp || 0;
      syncSituational(newBuild.race);
      Object.keys(armorDropdowns).forEach(function (key) {
        armorDropdowns[key].dropdown.setValue(toUI(newBuild[key], armorDropdowns[key].prompt));
      });
      statInput.setValues({
        armorLethality: newBuild.armorLethality,
        armorCritChance: newBuild.armorCritChance,
        armorCritDmg: newBuild.armorCritDmg
      });
      abilityGrid.setValues({
        fireDmg: newBuild.fireDmg,
        fireChance: newBuild.fireChance,
        fireTime: newBuild.fireTime,
        poisonDmg: newBuild.poisonDmg,
        poisonChance: newBuild.poisonChance,
        poisonTime: newBuild.poisonTime,
        lightningDmg: newBuild.lightningDmg,
        lightningChance: newBuild.lightningChance,
        lightningCooldown: newBuild.lightningCooldown,
        blastDmg: newBuild.blastDmg,
        blastChance: newBuild.blastChance
      });
      runeSelector.setValues(newBuild.runes || []);
      runeSelector.setEnhancement(Number(newBuild.enhancement) || 0);
      achievementDropdown.setValue(toUI(newBuild.achievement, ACHIEVEMENT_PROMPT));
      golemiteInputs.setValues(newBuild.golemites);
    };



    loadSectionIcons();

    return container;
  }

  var DEFAULT_BUILD = {
    oreSlots: [
      { name: NONE_LABEL, amount: 0 },
      { name: NONE_LABEL, amount: 0 },
      { name: NONE_LABEL, amount: 0 },
      { name: NONE_LABEL, amount: 0 }
    ],
    weaponType: NONE_LABEL,
    weaponName: NONE_LABEL,
    quality: 100,
    enhancement: 0,
    race: NONE_LABEL,
    armorLethality: 0,
    armorCritChance: 0,
    armorCritDmg: 0,
    armorHelmet: NONE_LABEL,
    armorChestplate: NONE_LABEL,
    armorLeggings: NONE_LABEL,
    fireDmg: 0,
    fireChance: 0,
    fireTime: 0,
    poisonDmg: 0,
    poisonChance: 0,
    poisonTime: 0,
    lightningDmg: 0,
    lightningChance: 0,
    lightningCooldown: 0,
    blastDmg: 0,
    blastChance: 0,
    berserk: 0,
    orcLordHpMissing: 0,
    orcLordKillStacks: 0,
    dryadInGrove: false,
    dryadMaxHp: 0,
    runes: [NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL, NONE_LABEL],
    achievement: NONE_LABEL,
    golemites: [emptyGolemite(), emptyGolemite()]
  };

  var SHOW_TRAIT_DPS_KEY = 'fc-show-trait-dps';

  function readShowTraitDps() {
    try { return window.localStorage.getItem(SHOW_TRAIT_DPS_KEY) === '1'; } catch (e) { return false; }
  }

  function saveShowTraitDps(on) {
    try { window.localStorage.setItem(SHOW_TRAIT_DPS_KEY, on ? '1' : '0'); } catch (e) {}
  }

  var state = {
    showTraitDps: readShowTraitDps(),
    gameData: null,
    build: DEFAULT_BUILD,
    inputPanel: null,
    resultsPanel: null
  };




  function deriveBonusType(build) {
    if (!state.gameData || !build.weaponName || build.weaponName === NONE_LABEL) { return ''; }
    var weapon = state.gameData._weapon_index.get(build.weaponName);
    return weapon ? weapon.type : '';
  }



  function computeWarnings(build) {
    var warnings = [];
    if (!build.weaponName || build.weaponName === NONE_LABEL) {
      warnings.push('No weapon selected — weapon damage and most DPS will be 0.');
    }
    var total = 0;
    for (var i = 0; i < build.oreSlots.length; i++) {
      total += Number(build.oreSlots[i].amount) || 0;
    }
    if (total === 0) {
      warnings.push('No ore amounts entered — Average Multiplier is 1.00x and no ore stats or traits apply.');
    }
    for (var j = 0; j < build.oreSlots.length; j++) {
      var slot = build.oreSlots[j];
      if (!slot.name || slot.name === NONE_LABEL) { continue; }
      var amt = Number(slot.amount) || 0;
      if (amt === 0) {
        warnings.push('Slot ' + (j + 1) + ': ' + slot.name + ' is selected but amount is 0.');
      } else if (total > 0 && amt / total < SHARE_GATE) {
        warnings.push('Slot ' + (j + 1) + ': ' + slot.name + ' is below 10% share — it contributes no stats.');
      }
    }
    var weapon = state.gameData && build.weaponName ? state.gameData._weapon_index.get(build.weaponName) : null;
    var minOre = weapon && state.gameData.weapon_type_min_ore ? state.gameData.weapon_type_min_ore[weapon.type] : undefined;
    if (minOre !== undefined && total < minOre) {
      warnings.push(weapon.type + ' weapons need at least ' + minOre + ' total ore (you have ' + total + ').');
    }
    if (!(Number(build.quality) > 0)) {
      warnings.push('Quality is 0% — damage is at base (1.0x), not the usual 2x from 100%.');
    }
    return warnings;
  }

  function armorPieceForEngine(name) {
    return !name || name === NONE_LABEL ? '' : name;
  }

  function transformBuildForEngine(build) {
    return {
      slots: build.oreSlots.map(function (s) {
        var blank = !s.name || s.name === NONE_LABEL;
        return { name: blank && state.gameData ? state.gameData.select_ore : s.name, amount: Math.max(0, Math.floor(Number(s.amount) || 0)) };
      }),
      weapon_name: build.weaponName,
      quality: Number(build.quality) || 0,
      forge_level: Number(build.enhancement) || 0,
      race: build.race,
      bonus_weapon_type: deriveBonusType(build),
      rune_cells: unlockedRuneCells(build.runes, Number(build.enhancement) || 0),
      base_crit_chance: 0,
      base_crit_dmg: 1.45,
      armor_crit_chance: (Number(build.armorCritChance) || 0) / 100,
      armor_crit_dmg: (Number(build.armorCritDmg) || 0) / 100,
      armor_lethality: (Number(build.armorLethality) || 0) / 100,
      armor_helmet: armorPieceForEngine(build.armorHelmet),
      armor_chestplate: armorPieceForEngine(build.armorChestplate),
      armor_leggings: armorPieceForEngine(build.armorLeggings),
      base_lethality: 0,
      abilities: {


        fire_dmg: (Number(build.fireDmg) || 0) / 100,
        fire_chance: (Number(build.fireChance) || 0) / 100,
        fire_time: Number(build.fireTime) || 0,
        poison_dmg: (Number(build.poisonDmg) || 0) / 100,
        poison_chance: (Number(build.poisonChance) || 0) / 100,
        poison_time: Number(build.poisonTime) || 0,
        lightning_dmg: (Number(build.lightningDmg) || 0) / 100,
        lightning_chance: (Number(build.lightningChance) || 0) / 100,
        lightning_cooldown: Number(build.lightningCooldown) || 0,
        blast_dmg: (Number(build.blastDmg) || 0) / 100,
        blast_chance: (Number(build.blastChance) || 0) / 100
      },



      berserk: (Number(build.berserk) || 0) / 100,
      achievement: build.achievement || NONE_LABEL,
      training_day: build.trainingDay === true,
      dryad_in_grove: build.dryadInGrove === true,
      dryad_max_hp: Number(build.dryadMaxHp) || 0,
      orc_lord_hp_missing: (Number(build.orcLordHpMissing) || 0) / 100,
      orc_lord_kill_stacks: Number(build.orcLordKillStacks) || 0,
      golemites: golemiteBuildValues(build.golemites).map(function (g) {
        return golemiteEngineValues(g, state.gameData);
      })
    };
  }

  function recalculate() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      state.resultsPanel.updateResults(result);
      if (state.hero) { state.hero.update(result); }
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: calculation error', err); }
    }
  }

  function handleBuildChange(newBuild) {

    state.build = newBuild;
    if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }
  }

  function resetBuild() {
    state.build = DEFAULT_BUILD;
    if (state.inputPanel) { state.inputPanel.setBuild(DEFAULT_BUILD); }
    if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }
    recalculate();
    showToast('Calculator reset');
  }

  function writeClipboard(text, successMsg) {
    var done = function () { showToast(successMsg || 'Copied to clipboard'); };
    var failed = function () { showToast('Failed to copy', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, failed);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch (e) {
      failed();
    }
    document.body.removeChild(ta);
  }

  function copyResults() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      var text = formatResultsForClipboard(result, state.build);
      writeClipboard(text, 'Results copied to clipboard');
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: copy failed', err); }
      showToast('Failed to copy', true);
    }
  }

  function formatResultsForClipboard(result, build) {
    var activeTraitsText = result.active_traits || 'None';
    function specLines(specs) {
      return specs.filter(function (spec) { return state.showTraitDps || !spec.trait; }).map(function (spec) {
        var value = result[spec.key];
        var capped = spec.cap !== undefined && value >= spec.cap ? ' (CAPPED)' : '';
        return spec.label + ': ' + spec.format(value) + capped;
      });
    }
    var ttkLabels = { ttk_skeleton: 'Skeleton King', ttk_25k: 'Golem', ttk_75k: 'Asura' };
    var ttkLines = TTK_ROWS.map(function (spec) { return ttkLabels[spec.key] + ': ' + spec.format(result[spec.key]); });
    var lines = [
      '=== Forge Calculator Results ===',
      '',
      'Weapon: ' + build.weaponName + ' (' + build.weaponType + ')',
      'Quality: ' + build.quality + '% | Enhancement: +' + build.enhancement,
      'Race: ' + build.race + ' | Weapon-Type Bonus: ' + (deriveBonusType(build) || 'None'),
      '',
      '--- Core DPS ---'
    ].concat(specLines(CORE_ROWS), [
      '',
      '--- Stats (Capped) ---'
    ], specLines(STAT_ROWS), [
      '',
      '--- DPS Breakdown ---'
    ], specLines(DPS_ROWS), [
      '',
      '--- Time to Kill ---'
    ], ttkLines, [
      '',
      '--- Active Traits ---',
      activeTraitsText,
      '',
      '--- Ore Slots ---',
      build.oreSlots.map(function (slot, i) { return 'Slot ' + (i + 1) + ': ' + slot.name + ' x' + slot.amount; }).join('\n'),
      '',
      '--- Runes ---',
      build.runes.filter(function (r) { return r && r !== NONE_LABEL; }).join(', ') || 'None',
      '',
      '--- Achievement ---',
      build.achievement || 'None'
    ]);
    return lines.join('\n');
  }

  function showToast(message, isError) {
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px;' +
      'background: ' + (isError ? '#cc0000' : '#2e7d32') + '; color: white;' +
      'padding: 12px 20px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
      'z-index: 10001; opacity: 0; transition: opacity 0.2s ease;';
    document.body.appendChild(toast);
    window.requestAnimationFrame(function () { toast.style.opacity = '1'; });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 200);
    }, 2500);
  }

  function init(root) {
    var loading = root.querySelector('.fc-loading');
    if (loading) { loading.textContent = 'Loading game data…'; }
    loadGameData().then(function (gameData) {
      state.gameData = gameData;

      var body = createEl('div', { class: 'fc-body' });
      var left = createEl('div', { class: 'fc-left' });
      var right = createEl('div', { class: 'fc-right' });

      state.hero = createHero();

      state.inputPanel = createInputPanel({
        data: gameData,
        getBuild: function () { return state.build; },
        onBuildChange: handleBuildChange,
        onCalculate: recalculate,
        actions: createActionBar({ onReset: resetBuild, onCalculate: recalculate })
      });
      left.appendChild(state.inputPanel);

      state.resultsPanel = createResultsPanel({
        onCopy: copyResults,
        onReset: resetBuild,
        onCalculate: recalculate
      });
      right.appendChild(state.resultsPanel);



      loadSectionIcons();

      body.append(state.hero, left, right);

      root.textContent = '';
      root.appendChild(body);

      recalculate();
      if (state.inputPanel && state.inputPanel.refreshWarnings) { state.inputPanel.refreshWarnings(); }

      if (mw.hook) { mw.hook('forgeCalculator.ready').fire(); }
    }, function (err) {
      if (mw.log) { mw.log('Forge Calculator: failed to load data', err); }
      var msg = createEl('div', {
        class: 'fc-error',
        style: { padding: '1.5rem', color: '#cc0000' }
      }, ['Failed to load calculator data: ' + err.message +
         ' — check that Data:Ores.json, Data:Weapons.json, Data:Races.json, Data:Runes.json and Data:Achievements.json exist.']);
      root.textContent = '';
      root.appendChild(msg);
    });
  }

  function start() {

    if (document.body) {
      document.body.classList.add('fc-page');
    }

    var root = document.getElementById('fc-root');
    if (!root) { return; }
    init(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window.mediaWiki));

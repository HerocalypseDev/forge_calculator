/*!
 * Forge Calculator — Forge Calculator Module for MediaWiki:Common.js
 * -----------------------------------------------------------------------------
 * Consolidated from the standalone web app (Web/js/) for the Forge wiki:
 *
 *   • engine/*   — pure DPS engine, ported verbatim (unchanged math)
 *   • data/*     — loader rewritten to fetch the 5 Data: namespace pages
 *   • utils/*    — only the helpers actually used
 *   • components/* — rewritten with `fc-` class names; tooltips removed;
 *                  achievement is a single-select dropdown (matches the
 *                  authoritative Python GUI + workbook C80 validation list)
 *
 * Mounts into #fc-root on any page that transcludes Template:ForgeCalculator.
 * Requires: Data:Ores.json, Data:Weapons.json, Data:Races.json,
 *           Data:Runes.json, Data:Achievements.json (JsonConfig pages).
 *
 * Paste the contents of this file at the end of MediaWiki:Common.js.
 */
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

  /* ==========================================================================
   * ENGINE CONSTANTS — verbatim from engine/constants.js
   * ======================================================================== */

  // Share scaling gate and ramp
  var SHARE_GATE = 0.10;
  var RAMP_TOP = 0.30;
  var RAMP_SPAN = RAMP_TOP - SHARE_GATE; // 0.20

  // Forge multiplier SWITCH (C18) — level 9 = 1.5 breaks the 0.05/level pattern
  var FORGE_MULT = {
    0: 1.0, 1: 1.05, 2: 1.1, 3: 1.15, 4: 1.2,
    5: 1.25, 6: 1.3, 7: 1.35, 8: 1.4, 9: 1.5
  };

  // Race lethality addends (E44 SWITCH)
  var RACE_LETHALITY = {
    'Archangel': 0.20,
    'Demon': 0.20,
    'Orc': 0.10,
    'Shadow': 0.05,
    'Dragonborn': 0.12
  };

  // Class lethality addends (E44 IFS) — SINGULAR "Gauntlet" (quirk)
  var CLASS_LETHALITY = {
    'Felynx,Gauntlet': 0.20,
    'Vampire,Straight Sword': 0.10
  };

  // Race attack speed addends (E47 SWITCH)
  var RACE_ATK_SPEED = {
    'Shadow': 0.10,
    'Demon': 0.20,
    'Archangel': 0.20
  };

  // Class attack speed addends (E47 IFS) — PLURAL "Gauntlets" (quirk)
  var CLASS_ATK_SPEED = {
    'Goblin,Dagger': 0.10,
    'Golem,Colossal Sword': 0.15,
    'Golem,Great Axe': 0.15,
    'Felynx,Gauntlets': 0.20
  };

  // Dragonborn fire bonuses (C61/C62/C63)
  var RACE_FIRE_DMG = { 'Dragonborn': 0.30 };
  var RACE_FIRE_CHANCE = { 'Dragonborn': 0.40 };
  var RACE_FIRE_TIME = { 'Dragonborn': 3 };

  // Smite bonuses (C71/C72)
  var RACE_SMITE_DMG = { 'Angel': 0.30, 'Archangel': 1.50 };
  var RACE_SMITE_CHANCE = { 'Angel': 0.50, 'Archangel': 0.33 };

  // Minotaur berserk (E53)
  var RACE_BERSERK = { 'Minotaur': 0.30 };

  // Stat caps (E44–E47)
  var CAPS = {
    lethality: 1.5,
    crit_chance: 1.0,
    crit_dmg: 1.0,
    atk_speed: 1.5
  };

  // Active trait power (K6–K9)
  var TRAIT_POWER_SLOPE = 4.5;
  var TRAIT_POWER_FLOOR = 0.1;

  // Core stat keys
  var CORE_STATS = ['lethality', 'crit_chance', 'crit_dmg', 'atk_speed'];

  // Expected data counts from the source workbook
  var EXPECTED_COUNTS = {
    ores: 140,
    weapons: 79,
    races: 16,
    runes: 47,
    achievements: 16
  };

  /* ==========================================================================
   * ENGINE — ported verbatim from engine/*.js (no math changes)
   * ======================================================================== */

  /**
   * Share scaling formula
   * IF(share < 0.1, 0, (base + (max - base) * MIN((share - 0.1) / 0.2, 1)) / divisor)
   */
  function shareScaling(base, max, share, divisor) {
    if (divisor === undefined) { divisor = 100; }
    if (share < SHARE_GATE) { return 0.0; }
    var value = base + (max - base) * Math.min((share - SHARE_GATE) / RAMP_SPAN, 1.0);
    return value / divisor;
  }

  /** Calculate slot shares (J6:J9) — 0 when total is 0 */
  function slotShares(slots) {
    var total = 0;
    for (var i = 0; i < slots.length; i++) { total += slots[i].amount; }
    if (total === 0) { return slots.map(function () { return 0.0; }); }
    return slots.map(function (s) { return s.amount / total; });
  }

  /** Get ore power multiplier for a slot (E6:E9) — "Select Ore"/missing -> 1 */
  function slotPower(slot, game) {
    if (slot.name === game.select_ore) { return 1.0; }
    var ore = game._ore_index.get(slot.name);
    return (ore && typeof ore.multiplier === 'number') ? ore.multiplier : 1.0;
  }

  /** Average ore power (E10) */
  function avgOrePower(slots, game) {
    var powers = slots.map(function (s) { return slotPower(s, game); });
    var total = 0;
    for (var i = 0; i < slots.length; i++) { total += slots[i].amount; }
    if (total !== 0) {
      var weighted = 0;
      for (var j = 0; j < slots.length; j++) { weighted += slots[j].amount * powers[j]; }
      return weighted / total;
    }
    if (powers.length) {
      var sum = 0;
      for (var k = 0; k < powers.length; k++) { sum += powers[k]; }
      return sum / powers.length;
    }
    return 0.0;
  }

  /** Forge multiplier from level (C18 SWITCH) — default 1 outside 0–9 */
  function forgeMultiplier(level) {
    return FORGE_MULT[level] !== undefined ? FORGE_MULT[level] : 1.0;
  }

  /** Weapon base damages (A18 unforged, C18 forged) */
  function weaponBases(weapon, avgPower, quality, forgeLevel) {
    if (!weapon) { return [1.0, 1.0]; }
    var base = weapon.damage * avgPower * (1 + quality / 100.0);
    return [base, base * forgeMultiplier(forgeLevel)];
  }

  /** Attack rate (E21) = (1 + atk_speed_total) / interval */
  function attackRate(weapon, atkSpeedTotal) {
    var interval = (weapon && typeof weapon.interval === 'number') ? weapon.interval : 1.0;
    return (1 + atkSpeedTotal) / interval;
  }

  /** Crit blend multiplier (part of C84) */
  function critBlend(ccTotal, cdTotal) {
    var cc = Math.min(ccTotal, 1.0);
    return cc * cdTotal + (1 - cc);
  }

  /**
   * Stat patterns matching the workbook formulas (from utils/parse.js)
   * e.g. "Crit Chance +14%" -> { stat: 'crit_chance', value: 0.14 }
   */
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
    // Drop exactly one trailing character (the %)
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

  /** Sum one stat's share-scaled contributions across slots */
  function oreStatSum(slots, shares, game, stat) {
    var total = 0.0;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (share < SHARE_GATE || slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      total += shareScaling(rng.base, rng.max, share, rng.divisor);
    }
    return total;
  }

  /** Rune totals from 6 rune cells (A27–A31) */
  function runeTotals(runeCells) {
    var totals = { lethality: 0.0, crit_chance: 0.0, crit_dmg: 0.0, atk_speed: 0.0 };
    for (var i = 0; i < runeCells.length; i++) {
      var parsed = parseTrait(runeCells[i]);
      if (parsed) { totals[parsed.stat] += parsed.value; }
    }
    return totals;
  }

  /** Stat totals with caps (E44–E47) */
  function statTotals(build, game, oreContribs) {
    var runes = runeTotals(build.rune_cells);
    var ach = parseTrait(build.achievement);
    var achStat = ach ? ach.stat : null;
    var achValue = ach ? ach.value : 0.0;

    // Lethality (E44)
    var lethality = oreContribs.lethality
      + build.armor_lethality
      + runes.lethality
      + build.base_lethality
      + (RACE_LETHALITY[build.race] !== undefined ? RACE_LETHALITY[build.race] : 0.0)
      + (CLASS_LETHALITY[build.race + ',' + build.bonus_weapon_type] !== undefined ? CLASS_LETHALITY[build.race + ',' + build.bonus_weapon_type] : 0.0)
      + (achStat === 'lethality' ? achValue : 0.0);

    // Crit Chance (E45) — base_crit_chance (C20) enters ONLY the crit blend
    var crit_chance = oreContribs.crit_chance
      + build.armor_crit_chance
      + runes.crit_chance
      + (achStat === 'crit_chance' ? achValue : 0.0);

    // Crit Damage (E46)
    var crit_dmg = oreContribs.crit_dmg
      + build.armor_crit_dmg
      + runes.crit_dmg;

    // Attack Speed (E47)
    var atk_speed = oreContribs.atk_speed
      + runes.atk_speed
      + (RACE_ATK_SPEED[build.race] !== undefined ? RACE_ATK_SPEED[build.race] : 0.0)
      + (CLASS_ATK_SPEED[build.race + ',' + build.bonus_weapon_type] !== undefined ? CLASS_ATK_SPEED[build.race + ',' + build.bonus_weapon_type] : 0.0)
      + (achStat === 'atk_speed' ? achValue : 0.0);

    return {
      lethality: Math.min(lethality, CAPS.lethality),
      crit_chance: Math.min(crit_chance, CAPS.crit_chance),
      crit_dmg: Math.min(crit_dmg, CAPS.crit_dmg),
      atk_speed: Math.min(atk_speed, CAPS.atk_speed)
    };
  }

  /** Calculate all ore contributions for core stats */
  function calcOreContributions(slots, shares, game) {
    var contribs = {};
    for (var i = 0; i < CORE_STATS.length; i++) {
      contribs[CORE_STATS[i]] = oreStatSum(slots, shares, game, CORE_STATS[i]);
    }
    return contribs;
  }

  /** Duration calculation with workbook quirks */
  function duration(oreTerms, raceTime, abilityTime, minus) {
    var maxOre = 0;
    for (var i = 0; i < oreTerms.length; i++) { if (oreTerms[i] > maxOre) { maxOre = oreTerms[i]; } }
    var combined = maxOre + raceTime;
    if (combined === 0) { return 0.0; }
    var top = maxOre;
    if (raceTime > top) { top = raceTime; }
    if (abilityTime > top) { top = abilityTime; }
    return Math.max(top - minus, 0.0);
  }

  /** Black hole chance (C76) — any Galaxite slot triggers it (COUNTA quirk) */
  function blackholeChance(slots, game) {
    var galaxite = 0;
    var nonblank = 0;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].name === 'Galaxite') { galaxite++; }
      if (slots[i].name) { nonblank++; }
    }
    if (nonblank === 0) { return 0.0; }
    return galaxite / nonblank >= 0.1 ? 0.3 : 0.0;
  }

  /** Get all scaled values for a stat across slots */
  function slotVals(slots, shares, game, stat) {
    var vals = [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var share = shares[i];
      if (share < SHARE_GATE || slot.name === game.select_ore) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore) { continue; }
      var rng = ore.stats[stat];
      if (!rng) { continue; }
      vals.push(shareScaling(rng.base, rng.max, share, rng.divisor));
    }
    return vals;
  }

  function slotMax(slots, shares, game, stat) {
    var vals = slotVals(slots, shares, game, stat);
    if (!vals.length) { return 0.0; }
    var m = vals[0];
    for (var i = 1; i < vals.length; i++) { if (vals[i] > m) { m = vals[i]; } }
    return m;
  }

  function slotSum(slots, shares, game, stat) {
    var vals = slotVals(slots, shares, game, stat);
    var total = 0.0;
    for (var i = 0; i < vals.length; i++) { total += vals[i]; }
    return total;
  }

  /** All proc components (C52–C76) — feed DPS rows C85–C89 (scale on UNFORGED A18) */
  function procComponents(build, shares, game) {
    var fireTerms = slotVals(build.slots, shares, game, 'fire_duration');
    var poisonTerms = slotVals(build.slots, shares, game, 'poison_duration');

    return {
      moon: slotSum(build.slots, shares, game, 'moon'),
      explosion_dmg: slotSum(build.slots, shares, game, 'explosion_dmg') + build.abilities.blast_dmg,
      explosion_chance: Math.max(slotMax(build.slots, shares, game, 'explosion_chance'), build.abilities.blast_chance),
      fire_dmg: slotSum(build.slots, shares, game, 'fire_dmg')
        + (RACE_FIRE_DMG[build.race] !== undefined ? RACE_FIRE_DMG[build.race] : 0.0)
        + build.abilities.fire_dmg,
      fire_chance: Math.max(slotMax(build.slots, shares, game, 'fire_chance'), build.abilities.fire_chance)
        + (RACE_FIRE_CHANCE[build.race] !== undefined ? RACE_FIRE_CHANCE[build.race] : 0.0),
      fire_duration: duration(fireTerms, RACE_FIRE_TIME[build.race] !== undefined ? RACE_FIRE_TIME[build.race] : 0, build.abilities.fire_time, 1),
      poison_dmg: slotSum(build.slots, shares, game, 'poison_dmg') + build.abilities.poison_dmg,
      poison_chance: Math.max(slotMax(build.slots, shares, game, 'poison_chance'), build.abilities.poison_chance),
      poison_duration: duration(poisonTerms, 0, build.abilities.poison_time, 2),
      smite_dmg: slotSum(build.slots, shares, game, 'smite_dmg') + (RACE_SMITE_DMG[build.race] !== undefined ? RACE_SMITE_DMG[build.race] : 0.0),
      smite_chance: Math.max(slotMax(build.slots, shares, game, 'smite_chance'), RACE_SMITE_CHANCE[build.race] !== undefined ? RACE_SMITE_CHANCE[build.race] : 0.0),
      blackhole_dmg: slotSum(build.slots, shares, game, 'blackhole_dmg'),
      blackhole_chance: blackholeChance(build.slots, game)
    };
  }

  /** Active weapon trait text (C14) */
  function activeTraits(build, shares, game) {
    var parts = [];
    for (var i = 0; i < build.slots.length; i++) {
      var slot = build.slots[i];
      var share = shares[i];
      if (slot.name === game.select_ore || share < SHARE_GATE) { continue; }
      var ore = game._ore_index.get(slot.name);
      if (!ore || !ore.is_weapon) { continue; }

      var power = Math.min(
        Math.max((share - SHARE_GATE) * TRAIT_POWER_SLOPE + TRAIT_POWER_FLOOR, TRAIT_POWER_FLOOR),
        1.0
      );

      var text = '';
      if (share >= 0.3) {
        text = ore.trait30 || '';
      } else {
        var trait10 = ore.trait10 || '';
        if (trait10) {
          text = '[' + (power * 100).toFixed(1) + '% power] ' + trait10;
        }
      }
      if (text) { parts.push(text); }
    }
    return parts.length ? parts.join(' | ') : 'No active weapon traits';
  }

  /**
   * Full DPS calculation (C84–C96, E91/E92)
   */
  function calculate(build, game) {
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

    // C84–C89 DPS components
    var weapon_dps = forged * (1 + totals.lethality) * blend * atkRate;
    var explosion_dps = unforged * procs.explosion_dmg * procs.explosion_chance * atkRate;
    var fire_dps = atkRate
      ? unforged * procs.fire_dmg * Math.min(1, procs.fire_chance * atkRate * Math.min(procs.fire_duration, 5))
      : 0.0;
    var poison_dps = atkRate
      ? unforged * procs.poison_dmg * Math.min(1, procs.poison_chance * atkRate * Math.min(procs.poison_duration, 5))
      : 0.0;
    var smite_dps = unforged * atkRate * procs.smite_dmg * Math.min(procs.smite_chance, 1);
    var blackhole_dps = unforged * procs.blackhole_dmg * procs.blackhole_chance * atkRate;
    var total_dps = weapon_dps + explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps;

    // C92 Berserk: E53 = C53 + Minotaur 30%
    var berserkLevel = build.berserk + (RACE_BERSERK[build.race] !== undefined ? RACE_BERSERK[build.race] : 0.0);
    var berserk = null;
    if (berserkLevel !== 0) {
      var lethBoosted = Math.min(totals.lethality + berserkLevel, CAPS.lethality);
      berserk = explosion_dps + fire_dps + poison_dps + smite_dps + blackhole_dps
        + forged * (1 + lethBoosted) * blend * atkRate;
    }

    // C93 Moonstone: E52 = 1 + C52, applied to weapon DPS only
    var moonstone = procs.moon !== 0 ? weapon_dps * (1 + procs.moon) : null;

    // C95 Min DPS / C96 Max Burst (procs on FORGED C18 — preserved quirk)
    var min_dps = forged * (1 + totals.lethality) * atkRate;
    var max_dps = forged * (1 + totals.lethality) * (build.base_crit_dmg + totals.crit_dmg) * atkRate
      + forged * procs.explosion_dmg * atkRate
      + forged * procs.fire_dmg
      + forged * procs.poison_dmg
      + procs.smite_dmg * forged
      + procs.blackhole_dmg * forged;

    // E91/E92 TTK
    var ttk_25k = total_dps > 0 ? 25000 / total_dps : null;
    var ttk_75k = total_dps > 0 ? 75000 / total_dps : null;

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
      weapon_dps: weapon_dps,
      explosion_dps: explosion_dps,
      fire_dps: fire_dps,
      poison_dps: poison_dps,
      smite_dps: smite_dps,
      blackhole_dps: blackhole_dps,
      total_dps: total_dps,
      berserk: berserk,
      moonstone: moonstone,
      min_dps: min_dps,
      max_dps: max_dps,
      ttk_25k: ttk_25k,
      ttk_75k: ttk_75k,
      active_traits: activeTraits(build, shares, game)
    };
  }

  /* ==========================================================================
   * DATA LOADING — Data: namespace pages (JsonConfig)
   * ======================================================================== */

  var DATA_TITLES = {
    ores: 'Data:Ores.json',
    weapons: 'Data:Weapons.json',
    races: 'Data:Races.json',
    runes: 'Data:Runes.json',
    achievements: 'Data:Achievements.json'
  };

  /** Wrap a thenable (jQuery promise) into a native Promise */
  function native(p) {
    return new Promise(function (resolve, reject) {
      Promise.resolve(p).then(resolve, reject);
    });
  }

  /** Load a JSON page via action=query + prop=revisions (standard API) */
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

  /** Load a JSON page via the JsonConfig action=jsondata API */
  function loadViaJsondata(api, title) {
    return native(api.get({ action: 'jsondata', format: 'json', title: title })).then(function (res) {
      var jsondata = res.jsondata;
      if (jsondata && typeof jsondata === 'object' && jsondata.data !== undefined) {
        return jsondata.data;
      }
      if (jsondata && typeof jsondata === 'object' && jsondata.status === 'ok' && jsondata.data !== undefined) {
        return jsondata.data;
      }
      if (jsondata && typeof jsondata === 'object') {
        return jsondata;
      }
      throw new Error('Unexpected jsondata response for ' + title);
    });
  }

  /** Load a JSON page via action=raw (plain fetch fallback) */
  function loadViaRaw(title) {
    var url = mw.config.get('wgScriptPath') + '/index.php?title=' + encodeURIComponent(title) + '&action=raw';
    return window.fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' for ' + title); }
      return r.json();
    });
  }

  /** Try each data-loading strategy in order until one returns valid JSON */
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

  /** Normalize + index loaded data */
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
        // Preserved quirk from data.py: "eapon" (lower-case substring of "weapon")
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
      select_ore: rawOres.select_ore || SELECT_ORE,
      none_label: rawRunes.none || NONE_LABEL,
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

  /** Validate loaded data against expected counts (non-fatal) */
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

    // Check for duplicate ore names (fatal)
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
      loadJSONPage(DATA_TITLES.achievements)
    ]).then(function (all) {
      return buildGameData({
        ores: all[0],
        weapons: all[1],
        races: all[2],
        runes: all[3],
        achievements: all[4]
      });
    });
  }

  /* ==========================================================================
   * DOM HELPERS
   * ======================================================================== */

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

  /* ==========================================================================
   * UI — SEARCHABLE DROPDOWN
   * ======================================================================== */

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
      // The selected value (e.g. "None") must not act as a filter: show the full
      // list unless the user has actually typed a search term that differs from it.
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
      // The arrow always browses the full list, ignoring whatever is in the box.
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
    container.open = open;
    container.close = close;
    container.updateOptions = function (newOptions) {
      options = newOptions;
      filteredOptions = filterOptions(input.value === currentValue ? '' : input.value);
      renderList();
      if (!isOpen && filteredOptions.length > 0) { open(); }
    };

    container.append(input, arrow, listContainer);
    return container;
  }

  /* ==========================================================================
   * UI — ORE SLOT
   * ======================================================================== */

  function createOreSlot(opts) {
    var index = opts.index;
    var oreNames = opts.oreNames;
    var noneLabel = opts.noneLabel;
    var selectOreLabel = opts.selectOreLabel;
    var onChange = opts.onChange;

    var slotId = 'ore-slot-' + index;
    var currentName = opts.value || noneLabel;
    var currentAmount = opts.amount || 0;

    var options = [noneLabel].concat(oreNames.filter(function (n) { return n !== selectOreLabel; }));

    var container = createEl('div', { class: 'fc-ore-slot', id: slotId });
    var label = createEl('label', { class: 'fc-ore-slot-label', for: slotId + '-ore' }, ['Slot ' + (index + 1)]);
    var fields = createEl('div', { class: 'fc-ore-slot-fields' });

    var dropdownWrapper = createEl('div', { class: 'fc-ore-slot-dropdown' });
    var dropdown = createSearchableDropdown({
      options: options,
      value: currentName,
      placeholder: noneLabel,
      id: slotId + '-ore',
      onChange: function (newName) {
        currentName = newName;
        onChange(currentName, currentAmount);
      }
    });
    dropdownWrapper.appendChild(dropdown);

    var amountInput = createEl('input', {
      type: 'number',
      class: 'fc-ore-slot-amount',
      id: slotId + '-amount',
      value: currentAmount,
      min: '0',
      step: '1',
      placeholder: '0',
      inputmode: 'decimal'
    });

    function commitAmount() {
      currentAmount = parseFloat(amountInput.value) || 0;
      amountInput.value = currentAmount;
      onChange(currentName, currentAmount);
    }

    var handleAmountChange = debounce(commitAmount, 150);
    amountInput.addEventListener('input', handleAmountChange);
    amountInput.addEventListener('change', commitAmount);

    fields.append(dropdownWrapper, amountInput);
    container.append(label, fields);

    container.setValue = function (name, amt) {
      currentName = name;
      currentAmount = amt;
      dropdown.setValue(name);
      amountInput.value = amt;
    };
    container.getValue = function () { return { name: currentName, amount: currentAmount }; };
    container.getDropdown = function () { return dropdown; };

    return container;
  }

  /* ==========================================================================
   * UI — WEAPON SELECTOR
   * ======================================================================== */

  function createWeaponSelector(opts) {
    var weaponTypes = opts.weaponTypes;
    var weapons = opts.weapons;
    var noneLabel = opts.noneLabel;
    var onChange = opts.onChange;

    var currentType = opts.weaponType || noneLabel;
    var currentWeapon = opts.weaponName || noneLabel;
    var currentQuality = (opts.quality !== undefined && opts.quality !== null) ? opts.quality : 100;
    var currentEnhancement = (opts.enhancement !== undefined && opts.enhancement !== null) ? opts.enhancement : 0;

    var container = createEl('div', { class: 'fc-weapon-selector' });

    // Weapon Type dropdown
    var typeWrapper = createEl('div', { class: 'fc-weapon-type-wrapper' });
    var typeLabel = createEl('label', { for: 'weapon-type' }, ['Weapon Type']);
    var typeOptions = [noneLabel, 'All Types'].concat(weaponTypes);
    var typeDropdown = createSearchableDropdown({
      options: typeOptions,
      value: currentType,
      placeholder: noneLabel,
      id: 'weapon-type',
      onChange: function (newType) {
        currentType = newType;
        var filteredWeapons;
        if (newType === noneLabel || newType === 'All Types') {
          filteredWeapons = weapons;
        } else {
          filteredWeapons = weapons.filter(function (w) { return w.type === newType; });
        }
        var weaponNames = filteredWeapons.map(function (w) { return w.name; });
        weaponDropdown.updateOptions([noneLabel].concat(weaponNames));
        if (weaponNames.indexOf(currentWeapon) === -1) {
          currentWeapon = noneLabel;
          weaponDropdown.setValue(noneLabel);
        }
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    typeWrapper.append(typeLabel, typeDropdown);

    // Weapon dropdown
    var weaponWrapper = createEl('div', { class: 'fc-weapon-wrapper' });
    var weaponLabel = createEl('label', { for: 'weapon-name' }, ['Weapon']);
    var initialWeapons;
    if (currentType === noneLabel || currentType === 'All Types') {
      initialWeapons = weapons;
    } else {
      initialWeapons = weapons.filter(function (w) { return w.type === currentType; });
    }
    var weaponNames = [noneLabel].concat(initialWeapons.map(function (w) { return w.name; }));
    var weaponDropdown = createSearchableDropdown({
      options: weaponNames,
      value: currentWeapon,
      placeholder: noneLabel,
      id: 'weapon-name',
      onChange: function (newWeapon) {
        currentWeapon = newWeapon;
        onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
      }
    });
    weaponWrapper.append(weaponLabel, weaponDropdown);

    // Quality input
    var qualityWrapper = createEl('div', { class: 'fc-quality-wrapper' });
    var qualityLabel = createEl('label', { for: 'quality' }, ['Quality']);
    var qualityInput = createEl('input', {
      type: 'number',
      class: 'fc-quality-input',
      id: 'quality',
      value: currentQuality,
      min: '0',
      max: '500',
      step: '5',
      inputmode: 'decimal'
    });
    function commitQuality() {
      currentQuality = parseFloat(qualityInput.value) || 0;
      qualityInput.value = currentQuality;
      onChange(currentType, currentWeapon, currentQuality, currentEnhancement);
    }
    var handleQualityChange = debounce(commitQuality, 150);
    qualityInput.addEventListener('input', handleQualityChange);
    qualityInput.addEventListener('change', commitQuality);
    qualityWrapper.append(qualityLabel, qualityInput);

    // Enhancement dropdown
    var enhancementWrapper = createEl('div', { class: 'fc-enhancement-wrapper' });
    var enhancementLabel = createEl('label', { for: 'enhancement' }, ['Enhancement']);
    var enhancementLevels = [];
    for (var i = 0; i < 10; i++) { enhancementLevels.push(String(i)); }
    var enhancementOptions = [noneLabel].concat(enhancementLevels);
    var enhancementDropdown = createSearchableDropdown({
      options: enhancementOptions,
      value: String(currentEnhancement),
      placeholder: noneLabel,
      id: 'enhancement',
      onChange: function (newEnhancement) {
        currentEnhancement = newEnhancement === noneLabel ? 0 : parseInt(newEnhancement, 10);
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
      typeDropdown.setValue(type);
      weaponDropdown.setValue(name);
      qualityInput.value = qual;
      enhancementDropdown.setValue(String(enh));
    };

    return container;
  }

  /* ==========================================================================
   * UI — STAT INPUT
   * ======================================================================== */

  function createStatInput(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }

    var container = createEl('div', { class: 'fc-stat-input' });

    var fields = [
      { key: 'armorLethality', label: 'Armor Lethality', placeholder: '0', min: 0, step: '0.01' },
      { key: 'armorCritChance', label: 'Armor Crit Chance', placeholder: '0', min: 0, step: '0.01' },
      { key: 'armorCritDmg', label: 'Armor Crit Damage', placeholder: '0', min: 0, step: '0.01' },
      { key: 'baseCritChance', label: 'Base Crit Chance', placeholder: '0', min: 0, step: '0.01' }
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
          step: field.step,
          placeholder: field.placeholder,
          inputmode: 'decimal'
        });

        function commit() {
          currentValues[field.key] = parseFloat(input.value) || 0;
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

  /* ==========================================================================
   * UI — ABILITY GRID
   * ======================================================================== */

  function createAbilityGrid(opts) {
    var onChange = opts.onChange;
    var currentValues = {};
    for (var k in opts.values) { currentValues[k] = opts.values[k]; }

    var container = createEl('div', { class: 'fc-ability-grid' });

    function createSection(title, fields, note) {
      var section = createEl('div', { class: 'fc-ability-section' });
      var sectionTitle = createEl('h4', { class: 'fc-ability-section-title' }, [title]);
      section.appendChild(sectionTitle);

      for (var i = 0; i < fields.length; i++) {
        (function (field) {
          var row = createEl('div', { class: 'fc-ability-row' });
          var label = createEl('label', { class: 'fc-ability-label', for: field.key }, [field.label]);
          var input = createEl('input', {
            type: 'number',
            class: 'fc-ability-input',
            id: field.key,
            value: currentValues[field.key] !== undefined ? currentValues[field.key] : '',
            min: String(field.min !== undefined ? field.min : 0),
            max: field.max !== undefined ? String(field.max) : undefined,
            step: field.step,
            placeholder: field.placeholder,
            inputmode: 'decimal'
          });

          function commit() {
            currentValues[field.key] = parseFloat(input.value) || 0;
            input.value = currentValues[field.key];
            var out = {};
            for (var k2 in currentValues) { out[k2] = currentValues[k2]; }
            onChange(out);
          }
          var handleChange = debounce(commit, 150);
          input.addEventListener('input', handleChange);
          input.addEventListener('change', commit);

          var fieldWrapper = createEl('div', { class: 'fc-ability-field' });
          fieldWrapper.appendChild(input);
          row.append(label, fieldWrapper);
          section.appendChild(row);
        })(fields[i]);
      }

      if (note) {
        section.appendChild(createEl('p', { class: 'fc-ability-note' }, [note]));
      }
      return section;
    }

    var fireSection = createSection('Fire', [
      { key: 'fireDmg', label: 'Fire DMG', placeholder: '0', min: 0, step: '0.01' },
      { key: 'fireChance', label: 'Fire Chance', placeholder: '0', min: 0, step: '0.01', max: 1 },
      { key: 'fireTime', label: 'Fire Time (s)', placeholder: '0', min: 0, step: '1' }
    ]);

    var poisonSection = createSection('Poison', [
      { key: 'poisonDmg', label: 'Poison DMG', placeholder: '0', min: 0, step: '0.01' },
      { key: 'poisonChance', label: 'Poison Chance', placeholder: '0', min: 0, step: '0.01', max: 1 },
      { key: 'poisonTime', label: 'Poison Time (s)', placeholder: '0', min: 0, step: '1' }
    ]);

    var blastSection = createSection('Blast', [
      { key: 'blastDmg', label: 'Blast DMG', placeholder: '0', min: 0, step: '0.01' },
      { key: 'blastChance', label: 'Blast Chance', placeholder: '0', min: 0, step: '0.01', max: 1 }
    ], 'Note: Blast has no duration field (workbook quirk)');

    container.append(fireSection, poisonSection, blastSection);

    container.setValues = function (values) {
      for (var key in values) { currentValues[key] = values[key]; }
      var sections = [fireSection, poisonSection, blastSection];
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

    return container;
  }

  /* ==========================================================================
   * UI — RUNE SELECTOR (multi-select via tags)
   * ======================================================================== */

  function createRuneSelector(opts) {
    var runes = opts.runes;
    var noneLabel = opts.noneLabel;
    var onChange = opts.onChange;
    var currentRunes = (opts.selectedRunes || []).slice();

    var container = createEl('div', { class: 'fc-rune-selector' });
    var tagsContainer = createEl('div', { class: 'fc-rune-tags' });
    renderTags();

    var dropdownWrapper = createEl('div', { class: 'fc-rune-dropdown' });
    var runeNames = runes.map(function (r) { return r.name; });
    var dropdown = createSearchableDropdown({
      options: [noneLabel].concat(runeNames),
      value: noneLabel,
      placeholder: noneLabel,
      id: 'rune-selector',
      onChange: function (selected) {
        if (selected === noneLabel) { return; }
        if (currentRunes.indexOf(selected) === -1) {
          currentRunes.push(selected);
          renderTags();
          onChange(currentRunes.slice());
        }
        dropdown.setValue(noneLabel);
      }
    });
    dropdownWrapper.appendChild(dropdown);

    container.append(tagsContainer, dropdownWrapper);

    function renderTags() {
      empty(tagsContainer);
      for (var i = 0; i < currentRunes.length; i++) {
        (function (runeName) {
          var tag = createEl('span', { class: 'fc-rune-tag' });
          var nameSpan = createEl('span', {}, [runeName]);
          var removeBtn = createEl('button', {
            class: 'fc-rune-tag-remove',
            type: 'button',
            'aria-label': 'Remove ' + runeName
          }, ['×']);
          removeBtn.addEventListener('click', function () {
            currentRunes = currentRunes.filter(function (r) { return r !== runeName; });
            renderTags();
            onChange(currentRunes.slice());
          });
          tag.append(nameSpan, removeBtn);
          tagsContainer.appendChild(tag);
        })(currentRunes[i]);
      }
    }

    container.setValues = function (runeNamesList) {
      currentRunes = runeNamesList.slice();
      renderTags();
    };

    container.getValues = function () { return currentRunes.slice(); };

    return container;
  }

  /* ==========================================================================
   * UI — RESULTS CARD + STAT ROW
   * ======================================================================== */

  function createResultsCard(opts) {
    var card = createEl('div', { class: 'fc-card' });
    var head = createEl('div', { class: 'fc-card-head' });
    // Text glyph instead of a data-URI image: TemplateStyles blocks url(data:…)
    var iconEl = createEl('span', { class: 'fc-card-icon' }, ['◆']);
    var titleEl = createEl('span', { class: 'fc-card-title' }, [opts.title]);
    head.append(iconEl, titleEl);

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
    var labelEl = createEl('span', { class: 'fc-stat-label' }, [opts.label]);
    var valueClass = ('fc-stat-val ' + (opts.valueClass || '')).trim();
    var valueEl = createEl('span', { class: valueClass }, [opts.value !== undefined ? opts.value : '']);
    if (opts.isCap) { valueEl.style.color = '#cc0000'; }
    row.append(labelEl, valueEl);
    return row;
  }

  function updateStatRow(row, value, isCap) {
    var valueEl = row.querySelector('.fc-stat-val');
    if (valueEl) {
      valueEl.textContent = value;
      valueEl.style.color = isCap ? '#cc0000' : '';
    }
  }

  function createStatRows(rows) {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
      fragment.appendChild(createStatRow(rows[i]));
    }
    return fragment;
  }

  /* ==========================================================================
   * UI — RESULTS PANEL
   * ======================================================================== */

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
    if (n === null || n === undefined || !isFinite(n)) { return '∞'; }
    if (n < 60) { return fmt2(n) + 's'; }
    var mins = Math.floor(n / 60);
    var secs = Math.round(n % 60);
    return mins + 'm ' + secs + 's';
  }

  function createResultsPanel(handlers) {
    var container = createEl('div', { class: 'fc-results-panel' });

    var head = createEl('div', { class: 'fc-results-head' });
    var title = createEl('h2', { class: 'fc-results-title' }, ['Results']);
    var toolbar = createEl('div', { class: 'fc-toolbar' });
    var copyBtn = createEl('button', { class: 'fc-btn fc-btn--primary', type: 'button' }, ['Copy Results']);
    var resetBtn = createEl('button', { class: 'fc-btn', type: 'button' }, ['Reset']);
    copyBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onCopy(); });
    resetBtn.addEventListener('click', function (e) { e.preventDefault(); handlers.onReset(); });
    toolbar.append(copyBtn, resetBtn);
    head.append(title, toolbar);

    var cardsContainer = createEl('div', { class: 'fc-results-cards' });
    container.append(head, cardsContainer);

    // Core DPS Card
    var coreDpsCard = createResultsCard({
      title: 'Core DPS',
      content: createStatRows([
        { label: 'Weapon Base', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Ore Power (avg)', value: '0.00x', valueClass: 'fc-sv-mult' },
        { label: 'Forged Damage', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Attack Rate', value: '0.00', valueClass: 'fc-sv-rate' },
        { label: 'Weapon DPS', value: '0', valueClass: 'fc-sv-dmg' }
      ])
    });

    // Stats Card
    var statsCard = createResultsCard({
      title: 'Stats (Capped)',
      content: createStatRows([
        { label: 'Lethality', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Crit Chance', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Crit Damage', value: '0.00%', valueClass: 'fc-sv-pct' },
        { label: 'Attack Speed', value: '0.00%', valueClass: 'fc-sv-pct' }
      ])
    });

    // DPS Breakdown Card
    var dpsCard = createResultsCard({
      title: 'DPS Breakdown',
      content: createStatRows([
        { label: 'Weapon DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Fire DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Poison DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Blast DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Black Hole DPS', value: '0', valueClass: 'fc-sv-dmg' },
        { label: 'Total DPS', value: '0', valueClass: 'fc-sv-dmg fc-bold' }
      ])
    });

    // Time to Kill Card
    var ttkCard = createResultsCard({
      title: 'Time to Kill',
      content: createStatRows([
        { label: 'TTK (25k HP)', value: '0.00s', valueClass: 'fc-sv-time' },
        { label: 'TTK (75k HP)', value: '0.00s', valueClass: 'fc-sv-time' }
      ])
    });

    // Traits Card (initially empty)
    var traitsCard = createResultsCard({
      title: 'Active Traits',
      content: createStatRows([
        { label: 'No active traits', value: '' }
      ])
    });

    cardsContainer.append(coreDpsCard, statsCard, dpsCard, ttkCard, traitsCard);

    container.updateResults = function (result) {
      if (!result) { return; }

      var coreRows = coreDpsCard.querySelectorAll('.fc-stat-row');
      if (coreRows.length >= 5) {
        updateStatRow(coreRows[0], fmtDps(result.unforged_damage), false);
        updateStatRow(coreRows[1], fmt2(result.avg_power) + 'x', false);
        updateStatRow(coreRows[2], fmtDps(result.forged_damage), false);
        updateStatRow(coreRows[3], fmt2(result.attack_rate), false);
        updateStatRow(coreRows[4], fmtDps(result.weapon_dps), false);
      }

      var statRows = statsCard.querySelectorAll('.fc-stat-row');
      if (statRows.length >= 4) {
        updateStatRow(statRows[0], pctFmt(result.lethality), result.lethality >= 1.5);
        updateStatRow(statRows[1], pctFmt(result.crit_chance), result.crit_chance >= 1.0);
        updateStatRow(statRows[2], pctFmt(result.crit_dmg), result.crit_dmg >= 1.0);
        updateStatRow(statRows[3], pctFmt(result.atk_speed), result.atk_speed >= 1.5);
      }

      var dpsRows = dpsCard.querySelectorAll('.fc-stat-row');
      if (dpsRows.length >= 6) {
        updateStatRow(dpsRows[0], fmtDps(result.weapon_dps), false);
        updateStatRow(dpsRows[1], fmtDps(result.fire_dps), false);
        updateStatRow(dpsRows[2], fmtDps(result.poison_dps), false);
        updateStatRow(dpsRows[3], fmtDps(result.smite_dps), false);
        updateStatRow(dpsRows[4], fmtDps(result.blackhole_dps), false);
        updateStatRow(dpsRows[5], fmtDps(result.total_dps), false);
      }

      var ttkRows = ttkCard.querySelectorAll('.fc-stat-row');
      if (ttkRows.length >= 2) {
        updateStatRow(ttkRows[0], fmtTime(result.ttk_25k), false);
        updateStatRow(ttkRows[1], fmtTime(result.ttk_75k), false);
      }

      if (result.active_traits) {
        updateResultsCard(traitsCard, createStatRows([
          { label: 'Active Traits', value: result.active_traits }
        ]));
      }
    };

    return container;
  }

  /* ==========================================================================
   * UI — INPUT PANEL
   * ======================================================================== */

  function createInputPanel(opts) {
    var data = opts.data;
    var getBuild = opts.getBuild;
    var onBuildChange = opts.onBuildChange;
    var onCalculate = opts.onCalculate;

    var noneLabel = data.constants.noneLabel;
    var selectOreLabel = data.constants.selectOreLabel;

    var container = createEl('div', { class: 'fc-input-panel' });

    function patch(partial) {
      var merged = {};
      var base = getBuild();
      for (var k in base) { merged[k] = base[k]; }
      for (var p in partial) { merged[p] = partial[p]; }
      onBuildChange(merged);
    }

    /* --- Forge Slots --- */
    var oreSection = createEl('div', { class: 'fc-input-section' });
    oreSection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Forge Slots']));

    var oreNames = data.ores.map(function (o) { return o.name; });
    var oreSlots = [];
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var slotBuild = getBuild().oreSlots[idx] || { name: noneLabel, amount: 0 };
        var slot = createOreSlot({
          index: idx,
          oreNames: oreNames,
          noneLabel: noneLabel,
          selectOreLabel: selectOreLabel,
          value: slotBuild.name,
          amount: slotBuild.amount || 0,
          onChange: function (name, amount) {
            var slots = getBuild().oreSlots.slice();
            slots[idx] = { name: name, amount: amount };
            patch({ oreSlots: slots });
          }
        });
        oreSlots.push(slot);
        oreSection.appendChild(slot);
      })(i);
    }

    /* --- Weapon --- */
    var weaponSection = createEl('div', { class: 'fc-input-section' });
    weaponSection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Weapon']));

    var weaponSelector = createWeaponSelector({
      weaponTypes: data.weapon_types,
      weapons: data.weapons,
      noneLabel: noneLabel,
      weaponType: getBuild().weaponType,
      weaponName: getBuild().weaponName,
      quality: getBuild().quality,
      enhancement: getBuild().enhancement,
      onChange: function (weaponType, weaponName, quality, enhancement) {
        patch({ weaponType: weaponType, weaponName: weaponName, quality: quality, enhancement: enhancement });
      }
    });
    weaponSection.appendChild(weaponSelector);

    /* --- Race & Bonus --- */
    var raceSection = createEl('div', { class: 'fc-input-section' });
    raceSection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Race & Bonus']));

    var raceWrapper = createEl('div', { class: 'fc-race-wrapper' });
    var raceLabel = createEl('label', { for: 'race-select' }, ['Race']);
    var raceOptions = [noneLabel].concat(data.races.map(function (r) { return r.name; }));
    var raceDropdown = createSearchableDropdown({
      options: raceOptions,
      value: getBuild().race || noneLabel,
      placeholder: noneLabel,
      id: 'race-select',
      onChange: function (race) { patch({ race: race }); }
    });
    raceWrapper.append(raceLabel, raceDropdown);

    var bonusWrapper = createEl('div', { class: 'fc-bonus-wrapper' });
    var bonusLabel = createEl('label', { for: 'bonus-type-select' }, ['Bonus Type']);
    var bonusOptions = [noneLabel].concat(data.race_bonus_types);
    var bonusDropdown = createSearchableDropdown({
      options: bonusOptions,
      value: getBuild().bonusType || noneLabel,
      placeholder: noneLabel,
      id: 'bonus-type-select',
      onChange: function (bonusType) { patch({ bonusType: bonusType }); }
    });
    bonusWrapper.append(bonusLabel, bonusDropdown);

    raceSection.append(raceWrapper, bonusWrapper);

    /* --- Armor & Base Stats --- */
    var statSection = createEl('div', { class: 'fc-input-section' });
    statSection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Armor & Base Stats']));

    var statInput = createStatInput({
      values: {
        armorLethality: getBuild().armorLethality,
        armorCritChance: getBuild().armorCritChance,
        armorCritDmg: getBuild().armorCritDmg,
        baseCritChance: getBuild().baseCritChance
      },
      onChange: function (values) { patch(values); }
    });
    statSection.appendChild(statInput);

    /* --- Abilities --- */
    var abilitySection = createEl('div', { class: 'fc-input-section' });
    abilitySection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Abilities']));

    var abilityGrid = createAbilityGrid({
      values: {
        fireDmg: getBuild().fireDmg,
        fireChance: getBuild().fireChance,
        fireTime: getBuild().fireTime,
        poisonDmg: getBuild().poisonDmg,
        poisonChance: getBuild().poisonChance,
        poisonTime: getBuild().poisonTime,
        blastDmg: getBuild().blastDmg,
        blastChance: getBuild().blastChance
      },
      onChange: function (values) { patch(values); }
    });
    abilitySection.appendChild(abilityGrid);

    /* --- Runes --- */
    var runeSection = createEl('div', { class: 'fc-input-section' });
    runeSection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Runes']));

    var runeSelector = createRuneSelector({
      runes: data.runes,
      selectedRunes: getBuild().runes || [],
      noneLabel: noneLabel,
      onChange: function (runes) { patch({ runes: runes }); }
    });
    runeSection.appendChild(runeSelector);

    /* --- Achievement (single-select, matches workbook C80 validation list) --- */
    var achievementSection = createEl('div', { class: 'fc-input-section' });
    achievementSection.appendChild(createEl('h3', { class: 'fc-input-section-title' }, ['Achievement']));

    var achievementWrapper = createEl('div', { class: 'fc-achievement-wrapper' });
    var achievementLabel = createEl('label', { for: 'achievement-select' }, ['Achievement']);
    var achievementNames = data.achievements
      .map(function (a) { return a.name; })
      .filter(function (n) { return n !== noneLabel && n !== 'None'; });
    var achievementOptions = [noneLabel].concat(achievementNames);
    var achievementDropdown = createSearchableDropdown({
      options: achievementOptions,
      value: getBuild().achievement || noneLabel,
      placeholder: noneLabel,
      id: 'achievement-select',
      onChange: function (name) { patch({ achievement: name }); }
    });
    achievementWrapper.append(achievementLabel, achievementDropdown);
    achievementSection.appendChild(achievementWrapper);

    container.append(
      oreSection,
      weaponSection,
      raceSection,
      statSection,
      abilitySection,
      runeSection,
      achievementSection
    );

    /* --- Calculate DPS trigger (manual, no auto-recalc) --- */
    var calcBtn = createEl('button', {
      class: 'fc-btn fc-btn--primary fc-calc-btn',
      type: 'button'
    }, ['Calculate DPS']);
    calcBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (onCalculate) { onCalculate(); }
    });
    container.appendChild(calcBtn);

    container.setBuild = function (newBuild) {
      for (var s = 0; s < 4; s++) {
        var slot = newBuild.oreSlots[s] || { name: noneLabel, amount: 0 };
        oreSlots[s].setValue(slot.name, slot.amount || 0);
      }
      weaponSelector.setValues(
        newBuild.weaponType || noneLabel,
        newBuild.weaponName || noneLabel,
        newBuild.quality !== undefined ? newBuild.quality : 100,
        newBuild.enhancement !== undefined ? newBuild.enhancement : 0
      );
      raceDropdown.setValue(newBuild.race || noneLabel);
      bonusDropdown.setValue(newBuild.bonusType || noneLabel);
      statInput.setValues({
        armorLethality: newBuild.armorLethality,
        armorCritChance: newBuild.armorCritChance,
        armorCritDmg: newBuild.armorCritDmg,
        baseCritChance: newBuild.baseCritChance
      });
      abilityGrid.setValues({
        fireDmg: newBuild.fireDmg,
        fireChance: newBuild.fireChance,
        fireTime: newBuild.fireTime,
        poisonDmg: newBuild.poisonDmg,
        poisonChance: newBuild.poisonChance,
        poisonTime: newBuild.poisonTime,
        blastDmg: newBuild.blastDmg,
        blastChance: newBuild.blastChance
      });
      runeSelector.setValues(newBuild.runes || []);
      achievementDropdown.setValue(newBuild.achievement || noneLabel);
    };

    return container;
  }

  /* ==========================================================================
   * APP — MAIN
   * ======================================================================== */

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
    bonusType: NONE_LABEL,
    armorLethality: 0,
    armorCritChance: 0,
    armorCritDmg: 0,
    baseCritChance: 0,
    fireDmg: 0,
    fireChance: 0,
    fireTime: 0,
    poisonDmg: 0,
    poisonChance: 0,
    poisonTime: 0,
    blastDmg: 0,
    blastChance: 0,
    runes: [],
    achievement: NONE_LABEL
  };

  var state = {
    gameData: null,
    build: DEFAULT_BUILD,
    inputPanel: null,
    resultsPanel: null
  };

  function transformBuildForEngine(build) {
    return {
      slots: build.oreSlots.map(function (s) { return { name: s.name, amount: s.amount }; }),
      weapon_name: build.weaponName,
      quality: build.quality,
      forge_level: build.enhancement,
      race: build.race,
      bonus_weapon_type: build.bonusType,
      rune_cells: build.runes || [],
      base_crit_chance: build.baseCritChance,
      base_crit_dmg: 0,
      armor_crit_chance: build.armorCritChance,
      armor_crit_dmg: build.armorCritDmg,
      armor_lethality: build.armorLethality,
      base_lethality: 0,
      abilities: {
        fire_dmg: build.fireDmg,
        fire_chance: build.fireChance,
        fire_time: build.fireTime,
        poison_dmg: build.poisonDmg,
        poison_chance: build.poisonChance,
        poison_time: build.poisonTime,
        blast_dmg: build.blastDmg,
        blast_chance: build.blastChance
      },
      berserk: 0,
      achievement: build.achievement || NONE_LABEL
    };
  }

  function recalculate() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      state.resultsPanel.updateResults(result);
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: calculation error', err); }
    }
  }

  function handleBuildChange(newBuild) {
    // Inputs only update pending state — results are recomputed when the
    // "Calculate DPS" button is pressed.
    state.build = newBuild;
  }

  function resetBuild() {
    state.build = DEFAULT_BUILD;
    if (state.inputPanel) { state.inputPanel.setBuild(DEFAULT_BUILD); }
    recalculate();
    showToast('Calculator reset');
  }

  function copyResults() {
    if (!state.gameData) { return; }
    try {
      var result = calculate(transformBuildForEngine(state.build), state.gameData);
      var text = formatResultsForClipboard(result, state.build);
      var done = function () { showToast('Results copied to clipboard'); };
      var failed = function () { showToast('Failed to copy', true); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, failed);
      } else {
        // Fallback for browsers without the async Clipboard API
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
    } catch (err) {
      if (mw.log) { mw.log('Forge Calculator: copy failed', err); }
      showToast('Failed to copy', true);
    }
  }

  function formatResultsForClipboard(result, build) {
    var activeTraitsText = result.active_traits || 'None';
    var lines = [
      '=== Forge Calculator Results ===',
      '',
      'Weapon: ' + build.weaponName + ' (' + build.weaponType + ')',
      'Quality: ' + build.quality + '% | Enhancement: +' + build.enhancement,
      'Race: ' + build.race + ' | Bonus: ' + build.bonusType,
      '',
      '--- Core DPS ---',
      'Weapon Base: ' + result.unforged_damage.toFixed(2),
      'Avg Ore Power: ' + result.avg_power.toFixed(2) + 'x',
      'Forged Damage: ' + result.forged_damage.toFixed(2),
      'Attack Rate: ' + result.attack_rate.toFixed(2),
      'Weapon DPS: ' + result.weapon_dps.toFixed(2),
      '',
      '--- Stats (Capped) ---',
      'Lethality: ' + (result.lethality * 100).toFixed(2) + '%' + (result.lethality >= 1.5 ? ' (CAPPED)' : ''),
      'Crit Chance: ' + (result.crit_chance * 100).toFixed(2) + '%' + (result.crit_chance >= 1.0 ? ' (CAPPED)' : ''),
      'Crit Damage: ' + (result.crit_dmg * 100).toFixed(2) + '%' + (result.crit_dmg >= 1.0 ? ' (CAPPED)' : ''),
      'Attack Speed: ' + (result.atk_speed * 100).toFixed(2) + '%' + (result.atk_speed >= 1.5 ? ' (CAPPED)' : ''),
      '',
      '--- DPS Breakdown ---',
      'Weapon DPS: ' + result.weapon_dps.toFixed(2),
      'Fire DPS: ' + result.fire_dps.toFixed(2),
      'Poison DPS: ' + result.poison_dps.toFixed(2),
      'Blast DPS: ' + result.smite_dps.toFixed(2),
      'Black Hole DPS: ' + result.blackhole_dps.toFixed(2),
      'Total DPS: ' + result.total_dps.toFixed(2),
      '',
      '--- Time to Kill ---',
      '25k HP: ' + result.ttk_25k.toFixed(2) + 's',
      '75k HP: ' + result.ttk_75k.toFixed(2) + 's',
      '',
      '--- Active Traits ---',
      activeTraitsText,
      '',
      '--- Forge Slots ---',
      build.oreSlots.map(function (slot, i) { return 'Slot ' + (i + 1) + ': ' + slot.name + ' x' + slot.amount; }).join('\n'),
      '',
      '--- Runes ---',
      build.runes.length > 0 ? build.runes.join(', ') : 'None',
      '',
      '--- Achievement ---',
      build.achievement || 'None'
    ];
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

      // Build layout: fc-body > fc-left + fc-right
      var body = createEl('div', { class: 'fc-body' });
      var left = createEl('div', { class: 'fc-left' });
      var right = createEl('div', { class: 'fc-right' });

      state.inputPanel = createInputPanel({
        data: gameData,
        getBuild: function () { return state.build; },
        onBuildChange: handleBuildChange,
        onCalculate: recalculate
      });
      left.appendChild(state.inputPanel);

      state.resultsPanel = createResultsPanel({
        onCopy: copyResults,
        onReset: resetBuild
      });
      right.appendChild(state.resultsPanel);

      body.append(left, right);

      // Replace the loading placeholder with the calculator
      root.textContent = '';
      root.appendChild(body);

      recalculate();

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

/** Results Panel Component
 * Right panel showing calculated results
 * @module components/ResultsPanel
 */

import { createEl } from '../utils/dom.js';
import { createResultsCard, createStatRows, updateResultsCard, updateStatRow } from './ResultsCard.js';
import { fmtDps, fmtTime, fmt2, pctFmt } from '../utils/format.js';

const CLASS_PANEL = 'ep-results-panel';
const CLASS_TITLE = 'ep-results-title';
const CLASS_CARDS_CONTAINER = 'ep-results-cards';

/**
 * Create the results panel
 * @returns {HTMLElement}
 */
export function createResultsPanel() {
  const container = createEl('div', { class: CLASS_PANEL });

  const title = createEl('h2', { class: CLASS_TITLE }, ['Results']);
  container.appendChild(title);

  const cardsContainer = createEl('div', { class: CLASS_CARDS_CONTAINER });
  container.appendChild(cardsContainer);

  // Core DPS Card
  const coreDpsCard = createResultsCard({
    title: 'Core DPS',
    content: createStatRows([
      { label: 'Weapon Base', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Ore Power (avg)', value: '0.00x', valueClass: 'ep-sv-mult' },
      { label: 'Forged Damage', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Attack Rate', value: '0.00', valueClass: 'ep-sv-rate' },
      { label: 'Weapon DPS', value: '0', valueClass: 'ep-sv-dmg', tooltip: 'Forged damage × (1+Lethality) × Crit Blend × Attack Rate' }
    ])
  });

  // Stats Card
  const statsCard = createResultsCard({
    title: 'Stats (Capped)',
    content: createStatRows([
      { label: 'Lethality', value: '0.00%', valueClass: 'ep-sv-pct', tooltip: 'Cap: 150%' },
      { label: 'Crit Chance', value: '0.00%', valueClass: 'ep-sv-pct', tooltip: 'Cap: 100%' },
      { label: 'Crit Damage', value: '0.00%', valueClass: 'ep-sv-pct', tooltip: 'Cap: 100%' },
      { label: 'Attack Speed', value: '0.00%', valueClass: 'ep-sv-pct', tooltip: 'Cap: 150%' }
    ])
  });

  // DPS Breakdown Card
  const dpsCard = createResultsCard({
    title: 'DPS Breakdown',
    content: createStatRows([
      { label: 'Weapon DPS', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Fire DPS', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Poison DPS', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Blast DPS', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Black Hole DPS', value: '0', valueClass: 'ep-sv-dmg' },
      { label: 'Total DPS', value: '0', valueClass: 'ep-sv-dmg ep-bold' }
    ])
  });

  // Time to Kill Card
  const ttkCard = createResultsCard({
    title: 'Time to Kill',
    content: createStatRows([
      { label: 'TTK (25k HP)', value: '0.00s', valueClass: 'ep-sv-time' },
      { label: 'TTK (75k HP)', value: '0.00s', valueClass: 'ep-sv-time' }
    ])
  });

  // Traits Card (initially empty)
  const traitsCard = createResultsCard({
    title: 'Active Traits',
    content: createStatRows([
      { label: 'No active traits', value: '' }
    ])
  });

  cardsContainer.append(
    coreDpsCard,
    statsCard,
    dpsCard,
    ttkCard,
    traitsCard
  );

  // Store references for updates
  const cards = {
    coreDps: coreDpsCard,
    stats: statsCard,
    dps: dpsCard,
    ttk: ttkCard,
    traits: traitsCard
  };

  container.updateResults = (result) => {
    if (!result) return;

    // Core DPS
    const coreRows = coreDpsCard.querySelectorAll('.ep-stat-row');
    if (coreRows.length >= 5) {
      updateStatRow(coreRows[0], fmtDps(result.unforged_damage), false);
      updateStatRow(coreRows[1], fmt2(result.avg_power) + 'x', false);
      updateStatRow(coreRows[2], fmtDps(result.forged_damage), false);
      updateStatRow(coreRows[3], fmt2(result.attack_rate), false);
      updateStatRow(coreRows[4], fmtDps(result.weapon_dps), false);
    }

    // Stats (with cap highlighting)
    const statRows = statsCard.querySelectorAll('.ep-stat-row');
    if (statRows.length >= 4) {
      updateStatRow(statRows[0], pctFmt(result.lethality), result.lethality >= 1.5);
      updateStatRow(statRows[1], pctFmt(result.crit_chance), result.crit_chance >= 1.0);
      updateStatRow(statRows[2], pctFmt(result.crit_dmg), result.crit_dmg >= 1.0);
      updateStatRow(statRows[3], pctFmt(result.atk_speed), result.atk_speed >= 1.5);
    }

    // DPS Breakdown
    const dpsRows = dpsCard.querySelectorAll('.ep-stat-row');
    if (dpsRows.length >= 6) {
      updateStatRow(dpsRows[0], fmtDps(result.weapon_dps), false);
      updateStatRow(dpsRows[1], fmtDps(result.fire_dps), false);
      updateStatRow(dpsRows[2], fmtDps(result.poison_dps), false);
      updateStatRow(dpsRows[3], fmtDps(result.smite_dps), false);
      updateStatRow(dpsRows[4], fmtDps(result.blackhole_dps), false);
      updateStatRow(dpsRows[5], fmtDps(result.total_dps), false);
    }

    // TTK
    const ttkRows = ttkCard.querySelectorAll('.ep-stat-row');
    if (ttkRows.length >= 2) {
      updateStatRow(ttkRows[0], fmtTime(result.ttk_25k), false);
      updateStatRow(ttkRows[1], fmtTime(result.ttk_75k), false);
    }

    // Traits
    if (result.active_traits && result.active_traits.length > 0) {
      const traitsText = result.active_traits.map(t => `${t.name}: ${t.power}%`).join('; ');
      updateResultsCard(traitsCard, createStatRows([
        { label: 'Active Traits', value: traitsText }
      ]));
    } else {
      updateResultsCard(traitsCard, createStatRows([
        { label: 'No active traits', value: '' }
      ]));
    }
  };

  container.reset = () => {
    container.updateResults({
      unforged_damage: 0,
      avg_power: 0,
      forged_damage: 0,
      attack_rate: 0,
      weapon_dps: 0,
      lethality: 0,
      crit_chance: 0,
      crit_dmg: 0,
      atk_speed: 0,
      fire_dps: 0,
      poison_dps: 0,
      smite_dps: 0,
      blackhole_dps: 0,
      total_dps: 0,
      ttk_25k: 0,
      ttk_75k: 0,
      active_traits: []
    });
  };

  return container;
}
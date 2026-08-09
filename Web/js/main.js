/** Main Application Entry Point
 * Initializes data, UI, and wiring
 * @module main
 */

import { loadGameData } from './data/loader.js';
import { createAppLayout } from './components/AppLayout.js';
import { createInputPanel } from './components/InputPanel.js';
import { createResultsPanel } from './components/ResultsPanel.js';
import { calculate } from './engine/index.js';

// Default build state
const DEFAULT_BUILD = {
  oreSlots: [
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 },
    { name: 'None', amount: 0 }
  ],
  weaponType: 'None',
  weaponName: 'None',
  quality: 100,
  enhancement: 0,
  race: 'None',
  armorLethality: 0,
  armorCritChance: 0,
  armorCritDmg: 0,
  fireDmg: 0,
  fireChance: 0,
  fireTime: 0,
  poisonDmg: 0,
  poisonChance: 0,
  poisonTime: 0,
  blastDmg: 0,
  blastChance: 0,
  runes: ['None', 'None', 'None', 'None', 'None', 'None'],
  achievements: []
};

// LocalStorage key
const STORAGE_KEY = 'forge-calculator-build';

let gameData = null;
let currentBuild = { ...DEFAULT_BUILD };
let inputPanel = null;
let resultsPanel = null;

/**
 * Initialize the application
 */
async function init() {
  try {
    // Load game data
    gameData = await loadGameData();

    // Create layout
    const { root, left, right } = createAppLayout();
    document.body.appendChild(root);

    // Create panels
    inputPanel = createInputPanel({
      data: gameData,
      build: currentBuild,
      onBuildChange: handleBuildChange,
      onCalculate: recalculate
    });
    left.appendChild(inputPanel);

    resultsPanel = createResultsPanel();
    right.appendChild(resultsPanel);

    // Load saved build from localStorage
    loadBuildFromStorage();

    // Initial calculation
    recalculate();

    // Setup global handlers
    setupGlobalHandlers();

    console.log('Forge Calculator initialized');
  } catch (error) {
    console.error('Failed to initialize:', error);
    document.body.innerHTML = `<div style="padding: 2rem; color: #cc0000;">Failed to load calculator: ${error.message}</div>`;
  }
}

/**
 * Handle build changes from input panel
 * @param {Object} newBuild
 */
function handleBuildChange(newBuild) {
  // Inputs only update pending state — results are recomputed when the
  // "Calculate DPS" button is pressed.
  currentBuild = { ...newBuild };
  saveBuildToStorage();
}

/**
 * Auto-detect the race/class weapon-type bonus from the selected weapon's type
 * (workbook E44/E47 check C23 = bonus type, which now always equals the
 * equipped weapon's type). Empty when no weapon is selected.
 * @param {Object} build - Build in InputPanel format
 * @returns {string}
 */
function deriveBonusType(build) {
  if (!gameData || !build.weaponName || build.weaponName === gameData.constants.noneLabel) return '';
  const weapon = gameData._weapon_index.get(build.weaponName);
  return weapon ? weapon.type : '';
}

/**
 * Transform build from InputPanel format (camelCase) to Engine format (snake_case)
 * @param {Object} build - Build in InputPanel format
 * @returns {Object} Build in Engine format
 */
function transformBuildForEngine(build) {
  return {
    slots: build.oreSlots.map(s => ({ name: s.name, amount: s.amount })),
    weapon_name: build.weaponName,
    quality: build.quality,
    forge_level: build.enhancement,
    race: build.race,
    bonus_weapon_type: deriveBonusType(build),
    rune_cells: build.runes || [],
    base_crit_chance: 0,
    base_crit_dmg: 0, // Not in InputPanel
    armor_crit_chance: build.armorCritChance,
    armor_crit_dmg: build.armorCritDmg,
    armor_lethality: build.armorLethality,
    base_lethality: 0, // Not in InputPanel
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
    berserk: 0, // Not in InputPanel
    achievement: (build.achievements || []).join(', ') // Engine expects string
  };
}

/**
 * Perform calculation and update results
 */
function recalculate() {
  if (!gameData) return;

  try {
    const engineBuild = transformBuildForEngine(currentBuild);
    const result = calculate(engineBuild, gameData);
    resultsPanel.updateResults(result);
  } catch (error) {
    console.error('Calculation error:', error);
    resultsPanel.reset();
  }
}

/**
 * Save current build to localStorage
 */
function saveBuildToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBuild));
  } catch (e) {
    console.warn('Failed to save build:', e);
  }
}

/**
 * Load build from localStorage
 */
function loadBuildFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all fields exist
      currentBuild = { ...DEFAULT_BUILD, ...parsed };
      // Ensure oreSlots is an array of 4 objects
      if (!Array.isArray(currentBuild.oreSlots) || currentBuild.oreSlots.length !== 4) {
        currentBuild.oreSlots = DEFAULT_BUILD.oreSlots;
      }
      // Normalize runes to 6 fixed cells (pad old variable-length arrays)
      if (!Array.isArray(currentBuild.runes) || currentBuild.runes.length !== 6) {
        const old = Array.isArray(currentBuild.runes) ? currentBuild.runes : [];
        currentBuild.runes = Array.from({ length: 6 }, (_, i) => old[i] ?? 'None');
      }
      // Update UI
      if (inputPanel && inputPanel.updateFromBuild) {
        inputPanel.updateFromBuild(currentBuild);
      }
    }
  } catch (e) {
    console.warn('Failed to load build:', e);
    currentBuild = { ...DEFAULT_BUILD };
  }
}

/**
 * Reset to default build
 */
function resetBuild() {
  currentBuild = { ...DEFAULT_BUILD };
  saveBuildToStorage();
  if (inputPanel && inputPanel.updateFromBuild) {
    inputPanel.updateFromBuild(currentBuild);
  }
  recalculate();
}

/**
 * Copy results to clipboard
 */
function copyResults() {
  if (!gameData) return;

  try {
    const engineBuild = transformBuildForEngine(currentBuild);
    const result = calculate(engineBuild, gameData);
    const text = formatResultsForClipboard(result, currentBuild);
    navigator.clipboard.writeText(text).then(() => {
      showToast('Results copied to clipboard');
    }).catch(() => {
      showToast('Failed to copy', true);
    });
  } catch (e) {
    console.error('Copy failed:', e);
    showToast('Failed to copy', true);
  }
}

/**
 * Format results for clipboard
 * @param {Object} result
 * @param {Object} build
 * @returns {string}
 */
function formatResultsForClipboard(result, build) {
  const lines = [
    '=== Forge Calculator Results ===',
    '',
    `Weapon: ${build.weaponName} (${build.weaponType})`,
    `Quality: ${build.quality}% | Enhancement: +${build.enhancement}`,
    `Race: ${build.race} | Weapon-Type Bonus: ${deriveBonusType(build) || 'None'}`,
    '',
    '--- Core DPS ---',
    `Base Damage: ${result.unforged_damage.toFixed(2)}`,
    `Average Multiplier: ${result.avg_power.toFixed(2)}x`,
    `Weapon Damage: ${result.forged_damage.toFixed(2)}`,
    `Attack Rate: ${result.attack_rate.toFixed(2)}`,
    `Weapon DPS: ${result.weapon_dps.toFixed(2)}`,
    '',
    '--- Stats (Capped) ---',
    `Lethality: ${(result.lethality * 100).toFixed(2)}%${result.lethality >= 1.5 ? ' (CAPPED)' : ''}`,
    `Crit Chance: ${(result.crit_chance * 100).toFixed(2)}%${result.crit_chance >= 1.0 ? ' (CAPPED)' : ''}`,
    `Crit Damage: ${(result.crit_dmg * 100).toFixed(2)}%${result.crit_dmg >= 1.0 ? ' (CAPPED)' : ''}`,
    `Attack Speed: ${(result.atk_speed * 100).toFixed(2)}%${result.atk_speed >= 1.5 ? ' (CAPPED)' : ''}`,
    '',
    '--- DPS Breakdown ---',
    `Weapon DPS: ${result.weapon_dps.toFixed(2)}`,
    `Explosion DPS: ${result.explosion_dps.toFixed(2)}`,
    `Fire DPS: ${result.fire_dps.toFixed(2)}`,
    `Poison DPS: ${result.poison_dps.toFixed(2)}`,
    `Smite DPS: ${result.smite_dps.toFixed(2)}`,
    `Black Hole DPS: ${result.blackhole_dps.toFixed(2)}`,
    `Total DPS: ${result.total_dps.toFixed(2)}`,
    '',
    '--- Time to Kill ---',
    `Golem: ${result.ttk_25k.toFixed(2)}s`,
    `Asura: ${result.ttk_75k.toFixed(2)}s`,
    '',
    '--- Active Traits ---',
    ...(result.active_traits.length > 0
      ? result.active_traits.map(t => `${t.name}: ${t.power}%`)
      : ['None']),
    '',
    '--- Forge Slots ---',
    ...build.oreSlots.map((slot, i) => `Slot ${i + 1}: ${slot.name} x${slot.amount}`),
    '',
    '--- Runes ---',
    build.runes.filter(r => r && r !== 'None').join(', ') || 'None',
    '',
    '--- Achievements ---',
    build.achievements.length > 0 ? build.achievements.join(', ') : 'None'
  ];
  return lines.join('\n');
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {boolean} isError
 */
function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${isError ? '#cc0000' : '#2e7d32'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

/**
 * Setup global event handlers (keyboard shortcuts, etc.)
 */
function setupGlobalHandlers() {
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + R = Reset (prevent default browser reload)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      resetBuild();
    }
    // Ctrl/Cmd + C = Copy results (when not in input)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const active = document.activeElement;
      if (!(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable))) {
        e.preventDefault();
        copyResults();
      }
    }
    // Escape = Clear search in any dropdown
    if (e.key === 'Escape') {
      document.querySelectorAll('.ep-searchable-input').forEach(input => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.blur();
      });
    }
  });

  // Reset button (if we add one to UI)
  // Could add a button in the future
}

// Export for potential external use
export { init, recalculate, resetBuild, copyResults };

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
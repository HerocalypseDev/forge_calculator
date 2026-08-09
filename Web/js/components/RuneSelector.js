/** Rune Selector Component
 * 3 lines × 2 slots = 6 fixed rune selections, matching the workbook's
 * 6 rune cells (C27/D27, C28/D28, C29/D29).
 * @module components/RuneSelector
 */

import { createEl } from '../utils/dom.js';
import { createSearchableDropdown } from './SearchableDropdown.js';

const CLASS_CONTAINER = 'ep-rune-selector';
const CLASS_LINE = 'ep-rune-line';
const CLASS_SLOT = 'ep-rune-slot';
const CLASS_LABEL = 'ep-rune-line-label';

const RUNE_SLOT_COUNT = 6;

// Prompt display ↔ "None" sentinel translation (see WeaponSelector.js).
const toUI = (val, sentinel, prompt) => (val === sentinel || val === undefined ? prompt : val);
const fromUI = (val, sentinel, prompt) => (val === prompt ? sentinel : val);

/**
 * Create rune selector with 3 lines × 2 slots
 * @param {Object} options
 * @param {Rune[]} options.runes - All runes
 * @param {string[]} options.values - 6 selected rune names (sentinels for empty)
 * @param {string} options.noneLabel - "None" sentinel label
 * @param {string} [options.prompt] - "Select Rune" placeholder
 * @param {Function} options.onChange - Callback (values[6]) => void
 * @returns {HTMLElement}
 */
export function createRuneSelector({ runes, values = [], noneLabel, prompt = noneLabel, onChange }) {
  // Normalize to exactly 6 cells (pad short arrays from old saved builds)
  const cell = (i) => values[i] ?? noneLabel;
  let current = Array.from({ length: RUNE_SLOT_COUNT }, (_, i) => cell(i));

  const container = createEl('div', { class: CLASS_CONTAINER });
  const runeNames = runes.map(r => r.name);
  const options = [prompt, ...runeNames];

  const dropdowns = [];
  for (let line = 0; line < 3; line++) {
    const lineEl = createEl('div', { class: CLASS_LINE });
    const lineLabel = createEl('span', { class: CLASS_LABEL }, [`Rune ${line + 1}`]);
    lineEl.appendChild(lineLabel);
    for (let col = 0; col < 2; col++) {
      const idx = line * 2 + col;
      const dropdown = createSearchableDropdown({
        options,
        value: toUI(current[idx], noneLabel, prompt),
        placeholder: prompt,
        id: `rune-slot-${idx}`,
        onChange: (name) => {
          current[idx] = fromUI(name, noneLabel, prompt);
          onChange([...current]);
        }
      });
      dropdowns.push(dropdown);
      const slotEl = createEl('div', { class: CLASS_SLOT });
      slotEl.appendChild(dropdown);
      lineEl.appendChild(slotEl);
    }
    container.appendChild(lineEl);
  }

  // Expose methods
  container.setValues = (vals = []) => {
    current = Array.from({ length: RUNE_SLOT_COUNT }, (_, i) => vals[i] ?? noneLabel);
    for (let i = 0; i < RUNE_SLOT_COUNT; i++) {
      dropdowns[i].setValue(toUI(current[i], noneLabel, prompt));
    }
  };
  container.getValues = () => [...current];

  return container;
}

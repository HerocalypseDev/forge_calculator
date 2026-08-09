/** Stat Row Component
 * Single stat row with label, value, and optional tooltip
 * @module components/StatRow
 */

import { createEl } from '../utils/dom.js';
import { attachTooltip, detachTooltip } from './Tooltip.js';

const CLASS_ROW = 'ep-stat-row';
const CLASS_LABEL = 'ep-stat-label';
const CLASS_VALUE = 'ep-stat-val';

/**
 * Create a stat row
 * @param {Object} options
 * @param {string} options.label - Stat label
 * @param {string} options.value - Formatted value
 * @param {string} [options.valueClass] - Additional class for value (e.g., 'ep-sv-dmg')
 * @param {string} [options.tooltip] - Tooltip text
 * @param {boolean} [options.isCap] - Whether value is at cap
 * @returns {HTMLElement}
 */
export function createStatRow({ label, value, valueClass = '', tooltip = '', isCap = false }) {
  const row = createEl('div', { class: CLASS_ROW });

  const labelEl = createEl('span', { class: CLASS_LABEL }, [label]);
  const valueEl = createEl('span', { class: `${CLASS_VALUE} ${valueClass}`.trim() }, [value]);

  if (isCap) {
    valueEl.style.color = '#cc0000';
  }

  row.append(labelEl, valueEl);

  if (tooltip) {
    attachTooltip(valueEl, tooltip);
    valueEl.style.cursor = 'help';
  }

  return row;
}

/**
 * Update a stat row's value
 * @param {HTMLElement} row
 * @param {string} value
 * @param {boolean} [isCap]
 */
export function updateStatRow(row, value, isCap = false) {
  const valueEl = row.querySelector(`.${CLASS_VALUE}`);
  if (valueEl) {
    valueEl.textContent = value;
    valueEl.style.color = isCap ? '#cc0000' : '';
  }
}

/**
 * Batch create stat rows from config
 * @param {Array<{label: string, value: string, valueClass?: string, tooltip?: string, isCap?: boolean}>} rows
 * @returns {DocumentFragment}
 */
export function createStatRows(rows) {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    fragment.appendChild(createStatRow(row));
  }
  return fragment;
}
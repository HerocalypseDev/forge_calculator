
import { createEl } from '../utils/dom.js';
import { attachTooltip, detachTooltip } from './Tooltip.js';

const CLASS_ROW = 'ep-stat-row';
const CLASS_LABEL = 'ep-stat-label';
const CLASS_VALUE = 'ep-stat-val';

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

export function updateStatRow(row, value, isCap = false) {
  const valueEl = row.querySelector(`.${CLASS_VALUE}`);
  if (valueEl) {
    valueEl.textContent = value;
    valueEl.style.color = isCap ? '#cc0000' : '';
  }
}

export function createStatRows(rows) {
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    fragment.appendChild(createStatRow(row));
  }
  return fragment;
}
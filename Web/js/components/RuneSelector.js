
import { createEl } from '../utils/dom.js';
import { createSearchableDropdown } from './SearchableDropdown.js';

const CLASS_CONTAINER = 'ep-rune-selector';
const CLASS_LINE = 'ep-rune-line';
const CLASS_SLOT = 'ep-rune-slot';
const CLASS_LABEL = 'ep-rune-line-label';

const RUNE_SLOT_COUNT = 6;

const toUI = (val, sentinel, prompt) => (val === sentinel || val === undefined ? prompt : val);
const fromUI = (val, sentinel, prompt) => (val === prompt ? sentinel : val);

export function createRuneSelector({ runes, values = [], noneLabel, prompt = noneLabel, onChange }) {
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

  container.setValues = (vals = []) => {
    current = Array.from({ length: RUNE_SLOT_COUNT }, (_, i) => vals[i] ?? noneLabel);
    for (let i = 0; i < RUNE_SLOT_COUNT; i++) {
      dropdowns[i].setValue(toUI(current[i], noneLabel, prompt));
    }
  };
  container.getValues = () => [...current];

  return container;
}

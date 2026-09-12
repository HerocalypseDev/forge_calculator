
import { createEl } from '../utils/dom.js';
import { createSearchableDropdown } from './SearchableDropdown.js';
import { debounce, on } from '../utils/events.js';

const CLASS_SLOT = 'ep-ore-slot';
const CLASS_LABEL = 'ep-ore-slot-label';
const CLASS_FIELDS = 'ep-ore-slot-fields';
const CLASS_DROPDOWN = 'ep-ore-slot-dropdown';
const CLASS_AMOUNT = 'ep-ore-slot-amount';
const CLASS_MULT = 'ep-ore-slot-mult';

const toUI = (val, sentinel, prompt) => (val === sentinel || val === undefined ? prompt : val);
const fromUI = (val, sentinel, prompt) => (val === prompt ? sentinel : val);

export function createOreSlot({
  index, oreNames, noneLabel, selectOreLabel,
  prompt = noneLabel, oreMultipliers = {},
  value, amount, onChange
}) {
  const slotId = `ore-slot-${index}`;
  let currentName = value || noneLabel;
  let currentAmount = amount || 0;

  const options = [prompt, ...oreNames.filter(n => n !== selectOreLabel)];

  const container = createEl('div', { class: CLASS_SLOT, id: slotId });

  const label = createEl('label', { class: CLASS_LABEL, for: `${slotId}-ore` }, [`Slot ${index + 1}`]);

  const fields = createEl('div', { class: CLASS_FIELDS });

  const dropdownWrapper = createEl('div', { class: CLASS_DROPDOWN });
  const dropdown = createSearchableDropdown({
    options,
    value: toUI(currentName, noneLabel, prompt),
    placeholder: prompt,
    id: `${slotId}-ore`,
    onChange: (newName) => {
      const parsed = fromUI(newName, noneLabel, prompt);
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

  const multLabel = createEl('span', { class: CLASS_MULT }, ['']);
  const updateMult = () => {
    const m = Number(oreMultipliers[currentName]);
    multLabel.textContent = m ? `×${String(parseFloat(m.toFixed(2)))}` : '';
  };

  const amountInput = createEl('input', {
    type: 'number',
    class: CLASS_AMOUNT,
    id: `${slotId}-amount`,
    value: currentAmount,
    min: '0',
    step: '1',
    placeholder: '0',
    inputmode: 'decimal'
  });

  const handleAmountChange = debounce((e) => {
    currentAmount = parseFloat(e.target.value) || 0;
    amountInput.value = currentAmount;
    onChange(currentName, currentAmount);
  }, 150);

  on(amountInput, 'input', handleAmountChange);
  on(amountInput, 'change', (e) => {
    currentAmount = parseFloat(e.target.value) || 0;
    amountInput.value = currentAmount;
    onChange(currentName, currentAmount);
  });

  fields.append(dropdownWrapper, multLabel, amountInput);
  container.append(label, fields);

  container.setValue = (name, amt) => {
    currentName = name;
    currentAmount = amt;
    dropdown.setValue(toUI(name, noneLabel, prompt));
    amountInput.value = amt;
    updateMult();
  };
  container.getValue = () => ({ name: currentName, amount: currentAmount });
  container.getDropdown = () => dropdown;

  updateMult();
  return container;
}

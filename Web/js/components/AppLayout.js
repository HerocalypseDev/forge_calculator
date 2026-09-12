
import { createEl } from '../utils/dom.js';

const CLASS_PAGE = 'ep-page';
const CLASS_TOP = 'ep-top';
const CLASS_IMAGE = 'ep-image';
const CLASS_BODY = 'ep-body';
const CLASS_LEFT = 'ep-left';
const CLASS_RIGHT = 'ep-right';

export function createAppLayout() {
  const root = createEl('div', { class: CLASS_PAGE });

  const top = createEl('div', { class: CLASS_TOP });
  const image = createEl('div', { class: CLASS_IMAGE });
  top.appendChild(image);

  const body = createEl('div', { class: CLASS_BODY });

  const left = createEl('div', { class: CLASS_LEFT });

  const right = createEl('div', { class: CLASS_RIGHT });

  body.append(left, right);
  root.append(top, body);

  return { root, top, image, body, left, right };
}
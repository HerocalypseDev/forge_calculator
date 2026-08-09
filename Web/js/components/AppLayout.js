/** App Layout Component
 * Main page structure with ep-page, ep-top, ep-body, ep-left, ep-right
 * @module components/AppLayout
 */

import { createEl } from '../utils/dom.js';

const CLASS_PAGE = 'ep-page';
const CLASS_TOP = 'ep-top';
const CLASS_IMAGE = 'ep-image';
const CLASS_BODY = 'ep-body';
const CLASS_LEFT = 'ep-left';
const CLASS_RIGHT = 'ep-right';

/**
 * Create the main app layout
 * @returns {Object} { root, top, image, body, left, right }
 */
export function createAppLayout() {
  const root = createEl('div', { class: CLASS_PAGE });

  // Top section (title/image area)
  const top = createEl('div', { class: CLASS_TOP });
  const image = createEl('div', { class: CLASS_IMAGE });
  top.appendChild(image);

  // Body section (main content)
  const body = createEl('div', { class: CLASS_BODY });

  // Left panel (inputs)
  const left = createEl('div', { class: CLASS_LEFT });

  // Right panel (results)
  const right = createEl('div', { class: CLASS_RIGHT });

  body.append(left, right);
  root.append(top, body);

  return { root, top, image, body, left, right };
}
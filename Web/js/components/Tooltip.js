/** Tooltip Component
 * Hover tooltip with delay and positioning
 * @module components/Tooltip
 */

let tooltipEl = null;
let hideTimeout = null;
let showTimeout = null;
let currentTarget = null;

/**
 * Initialize tooltip element
 */
function ensureTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'ep-tooltip';
    tooltipEl.style.cssText = `
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      background: #ffffe0;
      color: #1a1a1a;
      border: 1px solid #c8a85a;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 12px;
      line-height: 1.5;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transition: opacity 0.15s ease;
    `;
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

/**
 * Show tooltip for an element
 * @param {HTMLElement} target
 * @param {string} text
 */
export function showTooltip(target, text) {
  if (!target || !text) return;

  clearTimeout(hideTimeout);
  clearTimeout(showTimeout);

  currentTarget = target;

  showTimeout = setTimeout(() => {
    const el = ensureTooltip();
    el.textContent = text;
    el.style.opacity = '1';
    positionTooltip(target, el);
  }, 350);
}

/**
 * Hide tooltip
 */
export function hideTooltip() {
  clearTimeout(showTimeout);
  clearTimeout(hideTimeout);

  if (tooltipEl) {
    tooltipEl.style.opacity = '0';
  }
  currentTarget = null;
}

/**
 * Position tooltip near target
 * @param {HTMLElement} target
 * @param {HTMLElement} tooltip
 */
function positionTooltip(target, tooltip) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Default: below target, centered
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  let top = rect.bottom + 8;

  // Flip horizontally if off-screen
  if (left < 8) left = 8;
  if (left + tooltipRect.width > viewportWidth - 8) {
    left = viewportWidth - tooltipRect.width - 8;
  }

  // Flip vertically if off-screen
  if (top + tooltipRect.height > viewportHeight - 8) {
    top = rect.top - tooltipRect.height - 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

/**
 * Attach tooltip to an element
 * @param {HTMLElement} el
 * @param {string} text
 */
export function attachTooltip(el, text) {
  if (!el || !text) return;

  const handleMouseEnter = () => showTooltip(el, text);
  const handleMouseLeave = () => hideTooltip();
  const handleFocus = () => showTooltip(el, text);
  const handleBlur = () => hideTooltip();

  el.addEventListener('mouseenter', handleMouseEnter);
  el.addEventListener('mouseleave', handleMouseLeave);
  el.addEventListener('focus', handleFocus);
  el.addEventListener('blur', handleBlur);

  // Store handlers for cleanup
  el._tooltipHandlers = { handleMouseEnter, handleMouseLeave, handleFocus, handleBlur };
}

/**
 * Remove tooltip from element
 * @param {HTMLElement} el
 */
export function detachTooltip(el) {
  if (!el || !el._tooltipHandlers) return;

  const { handleMouseEnter, handleMouseLeave, handleFocus, handleBlur } = el._tooltipHandlers;
  el.removeEventListener('mouseenter', handleMouseEnter);
  el.removeEventListener('mouseleave', handleMouseLeave);
  el.removeEventListener('focus', handleFocus);
  el.removeEventListener('blur', handleBlur);
  delete el._tooltipHandlers;
}
/** Data loader - fetches and indexes all JSON files
 * @module data/index
 */

import { loadGameData as load } from './loader.js';

/**
 * Load and index all game data from JSON files
 * @returns {Promise<GameData>}
 */
export async function loadGameData() {
  return load();
}

/** @type {GameData|null} */
let _cachedData = null;

/**
 * Get cached game data, loading if necessary
 * @returns {Promise<GameData>}
 */
export async function getGameData() {
  if (!_cachedData) {
    _cachedData = await loadGameData();
  }
  return _cachedData;
}

/**
 * Clear cached data (for testing)
 */
export function clearCache() {
  _cachedData = null;
}
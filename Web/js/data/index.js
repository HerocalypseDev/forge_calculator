
import { loadGameData as load } from './loader.js';

export async function loadGameData() {
  return load();
}

let _cachedData = null;

export async function getGameData() {
  if (!_cachedData) {
    _cachedData = await loadGameData();
  }
  return _cachedData;
}

export function clearCache() {
  _cachedData = null;
}
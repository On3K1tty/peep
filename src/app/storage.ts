import type { GameSave } from '../engine/types';

const STORAGE_KEY = 'voxeldom_save';

/** Save to localStorage (and TG CloudStorage if available) */
export function saveGame(save: GameSave): boolean {
  try {
    const json = JSON.stringify(save);
    localStorage.setItem(STORAGE_KEY, json);

    // TG CloudStorage
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.CloudStorage) {
      tg.CloudStorage.setItem(STORAGE_KEY, json);
    }
    return true;
  } catch {
    return false;
  }
}

/** Load from localStorage (fallback) */
export function loadGame(): GameSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as GameSave;
    if (save.v !== 1) return null;
    return save;
  } catch {
    return null;
  }
}

/** Load from TG CloudStorage (async) */
export function loadGameTG(): Promise<GameSave | null> {
  return new Promise((resolve) => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.CloudStorage) { resolve(loadGame()); return; }

    tg.CloudStorage.getItem(STORAGE_KEY, (err: any, val: string) => {
      if (err || !val) { resolve(loadGame()); return; }
      try {
        const save = JSON.parse(val) as GameSave;
        resolve(save.v === 1 ? save : null);
      } catch {
        resolve(null);
      }
    });
  });
}

/** Encode save for URL sharing (base64) */
export function encodeForURL(save: GameSave): string {
  const json = JSON.stringify(save);
  return btoa(unescape(encodeURIComponent(json)));
}

/** Decode save from URL parameter */
export function decodeFromURL(encoded: string): GameSave | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const save = JSON.parse(json) as GameSave;
    return save.v === 1 ? save : null;
  } catch {
    return null;
  }
}

/** List all saves (future: multiple slots) */
export function listSaves(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith('voxeldom_')) keys.push(k);
  }
  return keys;
}

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

const isWeb = !isTauri;

let cachedPlatform: 'tauri' | 'web' | null = null;

export function getPlatform(): 'tauri' | 'web' {
  if (cachedPlatform) return cachedPlatform;
  cachedPlatform = isTauri ? 'tauri' : 'web';
  return cachedPlatform;
}

export function isTauriPlatform(): boolean {
  return getPlatform() === 'tauri';
}

export function isWebPlatform(): boolean {
  return getPlatform() === 'web';
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

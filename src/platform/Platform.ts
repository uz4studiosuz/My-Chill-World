/**
 * Thin wrapper over the CrazyGames SDK v3.
 * Every call is guarded, so the game also runs on localhost / other hosts without the SDK.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { CrazyGames?: { SDK: any } }
}

let sdk: any = null;
let env: 'crazygames' | 'local' | 'disabled' = 'disabled';
let playing = false;

function safe(fn: () => void) {
  try { fn(); } catch (e) { console.warn('[platform]', e); }
}

export const Platform = {
  get environment() { return env; },

  async init(timeoutMs = 4000) {
    const s = window.CrazyGames?.SDK;
    if (!s) return;
    try {
      await Promise.race([s.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('SDK init timeout')), timeoutMs))]);
      sdk = s;
      env = s.environment;
    } catch (e) {
      console.warn('[platform] SDK unavailable', e);
    }
  },

  loadingStart() { safe(() => sdk?.game.loadingStart()); },
  loadingStop() { safe(() => sdk?.game.loadingStop()); },

  /** Idempotent: CrazyGames wants exactly one start per stop. */
  gameplayStart() {
    if (playing) return;
    playing = true;
    safe(() => sdk?.game.gameplayStart());
  },
  gameplayStop() {
    if (!playing) return;
    playing = false;
    safe(() => sdk?.game.gameplayStop());
  },

  /** On CrazyGames, SDK data is synced to the cloud for logged-in players. */
  getItem(key: string): string | null {
    if (env === 'crazygames') {
      try { return sdk.data.getItem(key); } catch (e) { console.warn(e); }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },

  setItem(key: string, value: string) {
    if (env === 'crazygames') {
      try { sdk.data.setItem(key, value); return; } catch (e) { console.warn(e); }
    }
    try { localStorage.setItem(key, value); } catch { /* storage blocked (private mode) */ }
  },

  removeItem(key: string) {
    if (env === 'crazygames') {
      try { sdk.data.removeItem(key); return; } catch (e) { console.warn(e); }
    }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

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
let adBusy = false;
/** Ads failed (Basic Launch has no ads, or an ad blocker): no ad buttons for the rest of the session. */
let adsBroken = false;
let lastMidgame = 0;

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

  /** While an ad plays the game is paused and silent (set by the game). */
  onAd: (playing: boolean) => {},

  /** Ads work on CrazyGames (and in its local test mode). */
  get adsAvailable() { return !!sdk && !adsBroken && (env === 'crazygames' || env === 'local'); },

  /** The player's language from CrazyGames (for example 'en-US', 'uz-UZ'), if known. */
  get locale(): string | undefined { try { return sdk?.user?.systemInfo?.locale; } catch { return undefined; } },

  /**
   * A short ad at a natural break (opening a world, back to the menu). At most one every 3 minutes;
   * the promise settles when the game may go on (also when there is no ad).
   */
  midgameAd(): Promise<void> {
    if (!this.adsAvailable || adBusy || Date.now() - lastMidgame < 180000) return Promise.resolve();
    lastMidgame = Date.now();
    return new Promise((done) => {
      adBusy = true;
      const end = () => { if (!adBusy) return; adBusy = false; this.onAd(false); done(); };
      safe(() => sdk.ad.requestAd('midgame', { adStarted: () => this.onAd(true), adFinished: end, adError: end }));
      setTimeout(end, 60000);
    });
  },

  /** The player chose to watch an ad for a reward: true when it was watched to the end. */
  rewardedAd(): Promise<boolean> {
    if (!this.adsAvailable || adBusy) return Promise.resolve(false);
    return new Promise((done) => {
      adBusy = true;
      let settled = false;
      const end = (ok: boolean) => { if (settled) return; settled = true; adBusy = false; this.onAd(false); done(ok); };
      safe(() => sdk.ad.requestAd('rewarded', { adStarted: () => this.onAd(true), adFinished: () => end(true), adError: () => { adsBroken = true; end(false); } }));
      setTimeout(() => end(false), 90000);
    });
  },

  /**
   * On CrazyGames, SDK data is synced to the cloud for logged-in players. When the cloud has no copy (for example a
   * world too big for it was kept in this browser instead), the browser's own copy is used.
   */
  getItem(key: string): string | null {
    if (env === 'crazygames') {
      try { const v = sdk.data.getItem(key); if (v !== null && v !== undefined) return v; } catch (e) { console.warn(e); }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },

  setItem(key: string, value: string) {
    // always keep a copy in this browser too (the cloud has a size limit)
    if (env === 'crazygames') {
      try { sdk.data.setItem(key, value); } catch (e) { console.warn(e); }
    }
    try { localStorage.setItem(key, value); } catch { /* storage blocked (private mode) or full */ }
  },

  removeItem(key: string) {
    if (env === 'crazygames') {
      try { sdk.data.removeItem(key); } catch (e) { console.warn(e); }
    }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

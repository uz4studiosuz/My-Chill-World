/**
 * Where the game keeps its worlds: this browser's storage. Every call is guarded (private mode, full storage).
 */
export const Platform = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },

  setItem(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch (e) { console.warn('[storage]', e); }
  },

  removeItem(key: string) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

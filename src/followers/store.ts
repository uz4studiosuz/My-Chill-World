import type { WorldSave } from '../save/SaveStore';

/**
 * The followers' town is kept in the project (public/followers-data/world.json) and published with the site.
 * Only the local dev server can write it (npm run dev on the owner's computer): the site itself only reads it.
 */
export const DEV = import.meta.env.DEV;
const WORLD_URL = '/followers-data/world.json';

export async function loadWorld(): Promise<WorldSave | null> {
  try {
    const r = await fetch(DEV ? '/__followers/world' : `${WORLD_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const s = (await r.json()) as WorldSave;
    return s?.meta && s.buildings ? s : null;
  } catch {
    return null;
  }
}

type Status = (state: 'saving' | 'saved' | 'error', note?: string) => void;
let listener: Status = () => {};
export const onSaveStatus = (fn: Status) => { listener = fn; };

let busy = false;
let queued: WorldSave | null = null;

/** Write the town into the project (dev only; the newest copy wins when saves pile up). */
export function saveWorld(s: WorldSave) {
  if (!DEV) return;
  queued = s;
  if (!busy) void flush();
}

async function flush() {
  busy = true;
  while (queued) {
    const s = queued;
    queued = null;
    listener('saving');
    try {
      const r = await fetch('/__followers/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
      listener(r.ok ? 'saved' : 'error', r.ok ? undefined : await r.text());
    } catch (e) {
      listener('error', String(e));
    }
  }
  busy = false;
}

/** Commit the town file and push it to GitHub (the site is rebuilt from there). */
export async function pushWorld(people: number): Promise<{ ok: boolean; text: string }> {
  try {
    const r = await fetch('/__followers/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ people }) });
    return { ok: r.ok, text: await r.text() };
  } catch (e) {
    return { ok: false, text: String(e) };
  }
}

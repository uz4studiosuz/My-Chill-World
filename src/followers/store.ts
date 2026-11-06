import type { WorldSave } from '../save/SaveStore';
import { Online } from '../online/Online';

/**
 * The followers' town is kept in Supabase (table followers_world): everyone reads it, only the admin writes it
 * (the admin key is checked on the server). The copy in public/followers-data/world.json is the older way
 * (written by the dev server): it is used when it is newer, or when the cloud has no town yet.
 */
export const DEV = import.meta.env.DEV;
/** /followers?sandbox on the dev server: a fresh town to rehearse or film in, never saved. */
export const SANDBOX = DEV && new URLSearchParams(location.search).has('sandbox');
/** /followers?view on the dev server: see the town as a visitor does. */
const AS_VISITOR = DEV && new URLSearchParams(location.search).has('view');
const WORLD_URL = '/followers-data/world.json';
const KEY = 'mcw_followers_admin';

// ---------- the admin ----------

let secret = localStorage.getItem(KEY) ?? '';
/** This device was let in as the admin (the key is checked again by the server at every save). */
export const isAdmin = () => !!secret || (DEV && !AS_VISITOR);
/** The admin key is known here (saves go to the cloud). */
export const hasKey = () => !!secret;

/** Try a typed text as the admin key: true = let in, false = wrong, null = the server did not answer. */
export async function tryAdmin(text: string): Promise<boolean | null> {
  const ok = await Online.followersIsAdmin(text);
  if (ok) { secret = text; localStorage.setItem(KEY, text); }
  return ok;
}

export function logout() {
  secret = '';
  localStorage.removeItem(KEY);
}

// ---------- loading ----------

async function fromFile(): Promise<WorldSave | null> {
  try {
    const r = await fetch(DEV ? '/__followers/world' : `${WORLD_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const s = (await r.json()) as WorldSave;
    return s?.meta && s.buildings ? s : null;
  } catch {
    return null;
  }
}

async function fromCloud(): Promise<WorldSave | null> {
  const r = await Online.followersPull();
  if (!r) return null;
  try {
    const s = JSON.parse(r.json) as WorldSave;
    return s?.meta && s.buildings ? s : null;
  } catch {
    return null;
  }
}

/** When the town now shown was saved (to notice a newer one). */
export let loadedAt = 0;

/** The newest saved town (cloud or project file), or null for a fresh one. */
export async function loadWorld(): Promise<WorldSave | null> {
  if (SANDBOX) return null;
  const [cloud, file] = await Promise.all([fromCloud(), fromFile()]);
  const best = cloud && file ? (cloud.meta.updated >= file.meta.updated ? cloud : file) : cloud ?? file;
  loadedAt = best?.meta.updated ?? 0;
  return best;
}

/** A newer town was saved since this one was opened (the admin is building or adding followers). */
export async function newerExists() {
  const u = await Online.followersUpdated();
  return u > loadedAt + 1000;
}

// ---------- saving ----------

type Status = (state: 'saving' | 'saved' | 'error', note?: string) => void;
let listener: Status = () => {};
export const onSaveStatus = (fn: Status) => { listener = fn; };

let busy = false;
let queued: WorldSave | null = null;
let cloudAt = 0;
let urgent = false;

/**
 * Keep the town: on the admin's computer in the project file, and with the admin key in the cloud
 * (at most every 45 s, at once when asked). Visitors never save.
 */
export function saveWorld(s: WorldSave, now = false) {
  if (SANDBOX || !isAdmin()) return;
  queued = s;
  urgent ||= now;
  if (!busy) void flush();
}

async function flush() {
  busy = true;
  while (queued) {
    const s = queued;
    queued = null;
    const json = JSON.stringify(s);
    const errors: string[] = [];
    let wrote = false;
    listener('saving');
    if (DEV) {
      try {
        const r = await fetch('/__followers/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: json });
        if (r.ok) wrote = true; else errors.push(await r.text());
      } catch (e) { errors.push(String(e)); }
    }
    if (secret && (urgent || Date.now() - cloudAt > 45_000)) {
      urgent = false;
      cloudAt = Date.now();
      const people = s.population.reduce((a, f) => a + f.members.length, 0);
      const err = await Online.followersPush(secret, s.meta.updated, json, people);
      if (err) errors.push(err); else { wrote = true; loadedAt = s.meta.updated; }
    }
    if (errors.length) listener('error', errors.join(' · '));
    else if (wrote) listener('saved');
  }
  busy = false;
}

/** Commit the town file and push it to GitHub (dev server only). */
export async function pushWorld(people: number): Promise<{ ok: boolean; text: string }> {
  try {
    const r = await fetch('/__followers/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ people }) });
    return { ok: r.ok, text: await r.text() };
  } catch (e) {
    return { ok: false, text: String(e) };
  }
}

/** A finished video: on the dev server it goes into release/followers/videos, elsewhere it is downloaded. */
export async function keepVideo(blob: Blob, name: string): Promise<string> {
  if (DEV) {
    try {
      const r = await fetch(`/__followers/video?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
      if (r.ok) return await r.text();
    } catch { /* falls back to a download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return name;
}

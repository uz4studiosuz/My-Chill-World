import { Platform } from '../platform/Platform';
import { EconomyState } from '../sim/Economy';
import { BuildingKind } from '../buildings/BuildingTypes';
import { Sample } from '../sim/History';
import { PopulationSave } from '../people/Population';

/** v5 = multiple cities (one per Town Hall) on a 192×192 map. Older worlds are hidden (incompatible). */
export const SAVE_VERSION = 5;
const INDEX_KEY = 'mcw_index';
const worldKey = (id: string) => `mcw_w_${id}`;

export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  day: number;
  population: number;
  money: number;
  updated: number;
  v?: number;
}

export interface WorldSave {
  v: number;
  meta: WorldMeta;
  eco: EconomyState;
  roads: number[];
  roundabouts?: number[];
  footpaths?: number[];
  canals?: number[];
  terrain?: { height: number[]; water: number[] };
  sandbox?: boolean;
  cleared: number[];
  stumps?: [number, number][];
  buildings: { id: number; kind: BuildingKind; city?: number; x: number; z: number; stored: number; cropT?: number; graves?: any[]; cattleCount?: number }[];
  population: PopulationSave;
  cam: { x: number; z: number; yaw: number; view: number };
  time?: number;
  history?: Sample[];
}

/** Multiple worlds: a small index + one key per world. */
export const SaveStore = {
  list(): WorldMeta[] {
    try {
      const arr = JSON.parse(Platform.getItem(INDEX_KEY) ?? '[]') as WorldMeta[];
      return Array.isArray(arr) ? arr.filter((m) => m.v === SAVE_VERSION).sort((a, b) => b.updated - a.updated) : [];
    } catch {
      return [];
    }
  },

  load(id: string): WorldSave | null {
    try {
      const s = JSON.parse(Platform.getItem(worldKey(id)) ?? 'null') as WorldSave | null;
      return s && s.v === SAVE_VERSION ? s : null;
    } catch {
      return null;
    }
  },

  save(s: WorldSave) {
    s.meta.updated = Date.now();
    s.meta.v = SAVE_VERSION;
    Platform.setItem(worldKey(s.meta.id), JSON.stringify(s));
    let index: WorldMeta[] = [];
    try { index = JSON.parse(Platform.getItem(INDEX_KEY) ?? '[]'); } catch { /* corrupt index */ }
    index = index.filter((m) => m.id !== s.meta.id);
    index.push(s.meta);
    Platform.setItem(INDEX_KEY, JSON.stringify(index));
  },

  remove(id: string) {
    Platform.removeItem(worldKey(id));
    let index: WorldMeta[] = [];
    try { index = JSON.parse(Platform.getItem(INDEX_KEY) ?? '[]'); } catch { /* corrupt index */ }
    Platform.setItem(INDEX_KEY, JSON.stringify(index.filter((m) => m.id !== id)));
  },

  newId() {
    return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  },
};

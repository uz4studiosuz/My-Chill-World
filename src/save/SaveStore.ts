import { Platform } from '../platform/Platform';
import { EconomyState } from '../sim/Economy';
import { BuildingKind } from '../buildings/BuildingTypes';
import { Sample } from '../sim/History';
import { PopulationSave } from '../people/Population';
import type { GoalsSave } from '../sim/Goals';
import type { LeisureSave } from '../game/Leisure';

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
  /** City score for the records table. */
  score?: number;
  calm?: boolean;
  creative?: boolean;
  /** A town in an online world (shared with other players). */
  online?: { worldId: string; code: string; world: string; host: boolean; started: string; daySeconds: number };
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
  buildings: { id: number; kind: BuildingKind; city?: number; x: number; z: number; stored: number; cropT?: number; graves?: any[]; cattleCount?: number; crop?: string; cropManual?: boolean; built?: number; level?: number; owner?: number; parent?: number; rot?: number; wageF?: number; forSale?: number; investor?: number; shares?: { city: number; pct: number }[]; abroad?: { d: number; us: number; them: number; n?: string }[]; abroadSum?: { us: number; them: number }; paid?: number; investShare?: number; route?: number[]; strike?: number; born?: number; total?: { revenue: number; items: Record<string, number>; days: number }; books?: { revenue: number; wages: number; tax: number; profit: number; items?: Record<string, number> }; sold?: Record<string, number>; sales?: number }[];
  /** Roads ordered and still being laid by the builders. */
  roadJobs?: { tiles: [number, number][]; done: number; lit: boolean; city: number; money: number; stone: number; kind?: string; style?: number; wood?: number; iron?: number }[];
  population: PopulationSave;
  cam: { x: number; z: number; yaw: number; view: number };
  time?: number;
  history?: Sample[];
  goals?: GoalsSave;
  log?: { day: number; text: string }[];
  lit?: number[];
  rails?: number[];
  calm?: boolean;
  creative?: boolean;
  /** Achievements earned (id -> day). */
  achievements?: Record<string, number>;
  /** Online: what the town still pays back to investors among the players. */
  onlineDebts?: { to: string; city: string; left: number; perDay: number }[];
  leisure?: LeisureSave;
  pipes?: number[];
  /** Pipes are the only water mains (older saves get pipes under their roads once). */
  pipes2?: boolean;
  /** Homes and towers join the water through a pipe under them (older saves get those pipes once). */
  pipes3?: boolean;
  /** Electric cables (power runs through them only); older saves get cables under their roads once. */
  cables?: number[];
  cables1?: boolean;
  /** Zoning: tile * 4 + zone (1 homes, 2 shops, 3 factories). */
  zones?: number[];
  /** People marked as favourites. */
  favourites?: number[];
  /** People who died or moved away (for the family trees). */
  archive?: import('../people/Population').ArchivedPerson[];
  /** The economy of the region: a crisis or a boom until a day. */
  cycle?: { kind: 'crisis' | 'boom'; until: number };
  /** Tunnels bored through the mountains (roads and railways may run through them). */
  bores?: number[];
  trade?: { relation: number[] };
  worldHistory?: [number, { day: number; pop: number; money: number; happy: number }[]][];
  dealings?: [number, { day: number; text: string; money: number }[]][];
  /** Price of every good in every town, one value per day. */
  priceHistory?: [number, Record<string, number[]>][];
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

import * as THREE from 'three';
import { fbm } from '../utils/rng';
import { N, inBounds, idx } from './grid';
import type { WorldMap } from './WorldMap';

/**
 * The land beyond the map: the same noise that made the map, carried on past its edges, so the world goes on —
 * meadows, lakes, hills, the dry south and the cold north, the rivers flowing out, and far away the sea.
 */

/** The smooth fields of one place (before they become water, hills or desert). */
export interface WildFields { lake: number; mount: number; detail: number; arid: number; cold: number; forest: number; n: number; sea: number }

export function wildFields(seed: number, x: number, z: number, out: WildFields): WildFields {
  out.lake = fbm(x * 0.05 + 500, z * 0.05 + 500, seed + 21, 3);
  out.mount = fbm(x * 0.035 + 900, z * 0.035 + 900, seed + 31, 4);
  out.detail = fbm(x * 0.2, z * 0.2, seed + 41, 2);
  const south = Math.max(-1.2, Math.min(1.25, z / N));
  out.arid = fbm(x * 0.014 + 300, z * 0.014 + 700, seed + 61, 3) + 0.03 + (Math.min(0.92, south) - 0.62) * 0.45;
  out.cold = (0.36 - south) * 3.2 + (fbm(x * 0.02 + 40, z * 0.02 + 90, seed + 71, 2) - 0.5) * 0.6;
  out.forest = fbm(x * 0.07 + 100, z * 0.07 + 100, seed + 3);
  out.n = fbm(x * 0.08, z * 0.08, seed);
  // the sea: far from the map the land gives way to oceans
  const dx = Math.max(0, Math.abs(x - N / 2) - N / 2), dz = Math.max(0, Math.abs(z - N / 2) - N / 2);
  const far = Math.hypot(dx, dz);
  // mostly sea: past the map's own land only big islands and continents rise out of it
  out.sea = fbm(x * 0.006 + 77, z * 0.006 + 33, seed + 91, 4) - 0.5 + 0.06 - Math.min(0.22, far / 650) + Math.max(0, 0.45 - far / 200);
  return out;
}

/** Mix two places' fields (to hide the seam where the globe wraps round). */
export function mixFields(a: WildFields, b: WildFields, k: number) {
  for (const key of Object.keys(a) as (keyof WildFields)[]) a[key] = a[key] + (b[key] - a[key]) * k;
  return a;
}

const C = {
  grassA: new THREE.Color('#8cb156'), grassB: new THREE.Color('#a4c064'), dark: new THREE.Color('#759e48'), forest: new THREE.Color('#4f7d36'),
  sand: new THREE.Color('#d9c99a'), steppeA: new THREE.Color('#b8b06a'), steppeB: new THREE.Color('#a8a25c'),
  desertA: new THREE.Color('#e2cc92'), desertB: new THREE.Color('#d5ba7c'), rockLow: new THREE.Color('#8f9a6a'),
  rock: new THREE.Color('#9b978e'), rockDark: new THREE.Color('#827f78'), snow: new THREE.Color('#f2f4f6'),
  tundra: new THREE.Color('#8fa792'), lake: new THREE.Color('#3f93c4'), sea: new THREE.Color('#2f7fb3'), deep: new THREE.Color('#1d5f8f'),
};
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const tmp = new THREE.Color();

/** What a place is: water (1 lake or river, 2 sea), its hill height (0 = flat) and its ground colour. */
export interface WildTile { water: 0 | 1 | 2; h: number; cold: number; arid: number; forest: number; n: number; sea: number }

export function wildTile(f: WildFields, river: boolean, col: THREE.Color, out: WildTile): WildTile {
  out.cold = Math.max(0, Math.min(1, f.cold));
  out.arid = Math.max(0, Math.min(1, f.arid));
  if (out.cold > 0.3) out.arid = Math.min(out.arid, 0.4);
  out.forest = f.forest; out.n = f.n; out.sea = f.sea;
  if (f.sea < 0) {
    out.water = 2; out.h = 0;
    col.copy(C.sea).lerp(C.deep, Math.min(1, -f.sea * 6));
    return out;
  }
  if (river || f.lake > 0.68) { out.water = 1; out.h = 0; col.copy(C.lake); return out; }
  out.water = 0;
  const m = Math.max(0, (f.mount - 0.58) / 0.3);
  out.h = Math.min(10, Math.floor(m * 9 * (0.75 + 0.5 * f.detail)));
  if (f.sea < 0.012 || f.lake > 0.665) { col.copy(C.sand); return out; }
  groundColor(out.h, f.arid, out.cold, f.n, f.forest, col);
  return out;
}

/** The colour of dry ground, the same as the map's: meadow, forest, steppe, desert, tundra, rock and snow. */
export function groundColor(h: number, arid: number, cold: number, n: number, forest: number, col: THREE.Color) {
  if (h > 0) {
    if (h >= 7) col.copy(C.snow);
    else if (h >= 3) col.copy(C.rock).lerp(C.rockDark, n);
    else col.copy(C.rockLow).lerp(C.rock, (h - 1) * 0.5 + n * 0.3);
    return col;
  }
  col.copy(C.grassA).lerp(C.grassB, n);
  let ar = Math.max(0, Math.min(1, arid));
  if (cold > 0.3) ar = Math.min(ar, 0.4);
  const st = smooth(0.52, 0.58, ar), de = smooth(0.6, 0.66, ar);
  if (forest > 0.6) col.lerp(C.forest, 0.55 * (1 - st) * (1 - de));
  else if (forest > 0.52) col.lerp(C.dark, 0.3 * (1 - de));
  if (st > 0) col.lerp(tmp.copy(C.steppeA).lerp(C.steppeB, n), st);
  if (de > 0) col.lerp(tmp.copy(C.desertA).lerp(C.desertB, n), de);
  const cd = smooth(0.3, 0.7, cold);
  if (cd > 0) col.lerp(C.tundra, cd * 0.7);
  return col;
}
export const LAKE_COLOR = C.lake;

/**
 * The rivers flowing out of the map, carried on outside it: every place where the river leaves the map keeps
 * winding outwards. Returns the set of outside tiles (key `(x + off) * span + (z + off)`) that are river.
 */
export function riversOut(map: WorldMap, reach: number) {
  const off = reach, span = N + reach * 2;
  const set = new Set<number>();
  const key = (x: number, z: number) => (x + off) * span + (z + off);
  const lake = (x: number, z: number) => fbm(x * 0.05 + 500, z * 0.05 + 500, map.seed + 21, 3) > 0.68;
  const starts: { x: number; z: number; dx: number; dz: number }[] = [];
  const edge = (x: number, z: number, dx: number, dz: number) => { if (map.water[idx(x, z)] && !lake(x, z)) starts.push({ x, z, dx, dz }); };
  for (let i = 0; i < N; i++) { edge(i, 0, 0, -1); edge(i, N - 1, 0, 1); edge(0, i, -1, 0); edge(N - 1, i, 1, 0); }
  // one river per run of water along an edge (its middle)
  const runs: typeof starts = [];
  for (const s of starts) {
    const last = runs[runs.length - 1];
    if (last && last.dx === s.dx && last.dz === s.dz && Math.abs(last.x - s.x) + Math.abs(last.z - s.z) <= 4) continue;
    runs.push(s);
  }
  for (const r of runs) {
    let px = r.x + 0.5, pz = r.z + 0.5;
    const base = Math.atan2(r.dz, r.dx);
    for (let step = 0; step < reach * 3; step++) {
      const ang = base + (fbm(step * 0.03 + r.x * 0.1, r.z * 0.1, map.seed + 51, 2) - 0.5) * 2.2;
      px += Math.cos(ang) * 0.5; pz += Math.sin(ang) * 0.5;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = Math.floor(px) + dx, z = Math.floor(pz) + dz;
        if (inBounds(x, z) || Math.hypot(x + 0.5 - px, z + 0.5 - pz) > 1.5) continue;
        if (x < -off || z < -off || x >= N + off || z >= N + off) continue;
        set.add(key(x, z));
      }
      if (px < -off || pz < -off || px > N + off || pz > N + off) break;
    }
  }
  return { set, key, off, span };
}

/** The planet: our map covers 72° of it; one turn round the equator is ROUND tiles. */
export const SPAN = (72 * Math.PI) / 180;
export const ROUND = (N * Math.PI * 2) / SPAN;
export const T0 = Math.PI / 2 - SPAN / 2;
/** Behind the planet, opposite the map, the two ends of the world meet (mixed over a band so there is no line). */
const SEAM = N / 2 + ROUND / 2, BAND = 160;
/** A tile's x brought into the one turn of the world that holds the map. */
/** From pole to pole: half a turn. Past one pole the world goes on from the other (both are ice, so it closes unseen). */
export const ROUND_Z = ROUND / 2;
export const Z0 = (-T0 / SPAN) * N;
export const wrapZ = (tz: number) => ((((tz - Z0) % ROUND_Z) + ROUND_Z) % ROUND_Z) + Z0;
export const wrapX = (tx: number) => ((((tx - (SEAM - ROUND)) % ROUND) + ROUND) % ROUND) + SEAM - ROUND;
const SNOW = new THREE.Color('#f2f4f6');
const fa = {} as WildFields, fb = {} as WildFields;

/**
 * Any place in the world outside the map (x wraps round the planet, z runs from pole to pole): water, hill and
 * colour, with ice towards the poles. The same for the globe and for the land around the map.
 */
export function worldSample(seed: number, tx: number, tz: number, river: boolean, col: THREE.Color, out: WildTile) {
  const x = wrapX(tx);
  tz = wrapZ(tz);
  wildFields(seed, x, tz, fa);
  const d = SEAM - x;
  if (d < BAND) mixFields(fa, wildFields(seed, x - ROUND, tz, fb), 0.5 * (1 - d / BAND));
  else if (x - (SEAM - ROUND) < BAND) mixFields(fa, wildFields(seed, x + ROUND, tz, fb), 0.5 * (1 - (x - (SEAM - ROUND)) / BAND));
  wildTile(fa, river, col, out);
  if (out.h > 0) col.multiplyScalar(1 + out.h * 0.015);
  const ice = polarIce(tz);
  if (ice > 0) { col.lerp(SNOW, ice); out.cold = Math.max(out.cold, 1); }
  // the polar ice cap: flat white land, the same at both poles
  if (ice > 0.5) { out.water = 0; out.h = 0; col.copy(SNOW); }
  return out;
}

/** Ice towards the poles (0 … 0.95) for a row of the world. */
export function polarIce(tz: number) {
  tz = wrapZ(tz);
  const lat = Math.abs(Math.cos(T0 + (tz / N) * SPAN));
  return lat > 0.78 ? Math.min(0.95, (lat - 0.78) * 7) : 0;
}
/** How far the rivers are followed out of the map (tiles). */
export const RIVER_REACH = 220;

import { DIRS, N, idx, inBounds } from './grid';
import { WorldMap } from './WorldMap';
import { fbm, mulberry32 } from '../utils/rng';

/** Radius around the map centre kept flat and dry for the starting town. */
export const CENTER_CLEAR = 15;

export function generateWorld(seed: number): WorldMap {
  const map = new WorldMap(seed);
  const rnd = mulberry32(seed * 31 + 7);
  const c = N / 2;
  const distC = (x: number, z: number) => Math.hypot(x + 0.5 - c, z + 0.5 - c);

  carveRiver(map, rnd, seed);

  // Lakes
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      if (distC(x, z) < CENTER_CLEAR + 4) continue;
      if (fbm(x * 0.05 + 500, z * 0.05 + 500, seed + 21, 3) > 0.68) map.water[idx(x, z)] = 1;
    }
  }

  // Mountains: noise ranges + one guaranteed mountain near the town (stone for quarries)
  const waterDist = distanceField(map.water, 4);

  // Climate: dry steppe and sandy desert regions away from the town and from water
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const k = idx(x, z);
      let a = fbm(x * 0.014 + 300, z * 0.014 + 700, seed + 61, 3) + 0.03;
      const town = Math.max(0, 1 - (distC(x, z) - CENTER_CLEAR) / 14);
      a -= town * 0.25 + (waterDist[k] < 3 ? (3 - waterDist[k]) * 0.05 : 0);
      map.arid[k] = Math.max(0, Math.min(1, a));
    }
  }
  const ma = rnd() * Math.PI * 2, md = 24 + rnd() * 6;
  const mx = c + Math.cos(ma) * md, mz = c + Math.sin(ma) * md;
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const k = idx(x, z);
      if (map.water[k] || waterDist[k] < 3 || distC(x, z) < CENTER_CLEAR) continue;
      const m = fbm(x * 0.035 + 900, z * 0.035 + 900, seed + 31, 4);
      let v = Math.max(0, (m - 0.58) / 0.3);
      v = Math.max(v, Math.max(0, 1 - Math.hypot(x - mx, z - mz) / 10) * 1.1);
      const detail = fbm(x * 0.2, z * 0.2, seed + 41, 2);
      map.height[k] = Math.min(10, Math.floor(v * 9 * (0.75 + 0.5 * detail)));
    }
  }
  return map;
}

function carveRiver(map: WorldMap, rnd: () => number, seed: number) {
  const c = N / 2;
  const a = 8 + rnd() * (N - 16), b = 8 + rnd() * (N - 16);
  const horizontal = rnd() < 0.5;
  let px = horizontal ? -2 : a, pz = horizontal ? a : -2;
  const tx = horizontal ? N + 2 : b, tz = horizontal ? b : N + 2;
  const width = 1.3 + rnd() * 0.6;
  const avoid = CENTER_CLEAR + 8;

  for (let step = 0; step < 2000; step++) {
    const ang = Math.atan2(tz - pz, tx - px) + (fbm(step * 0.03, 0, seed + 51, 2) - 0.5) * 2.4;
    let dx = Math.cos(ang), dz = Math.sin(ang);
    const ox = px - c, oz = pz - c, d = Math.hypot(ox, oz);
    if (d < avoid && d > 0.001) {
      const push = ((avoid - d) / avoid) * 2;
      dx += (ox / d) * push;
      dz += (oz / d) * push;
      const l = Math.hypot(dx, dz);
      dx /= l;
      dz /= l;
    }
    px += dx * 0.5;
    pz += dz * 0.5;

    const r = Math.ceil(width);
    for (let z = Math.floor(pz) - r; z <= Math.floor(pz) + r; z++) {
      for (let x = Math.floor(px) - r; x <= Math.floor(px) + r; x++) {
        if (inBounds(x, z) && Math.hypot(x + 0.5 - px, z + 0.5 - pz) <= width) map.water[idx(x, z)] = 1;
      }
    }
    if (px < -3 || pz < -3 || px > N + 3 || pz > N + 3) break;
  }
}

/** Manhattan distance to the nearest set cell, capped at `max`. */
function distanceField(src: Uint8Array, max: number) {
  const dist = new Uint8Array(N * N).fill(max);
  let frontier: number[] = [];
  for (let k = 0; k < src.length; k++) if (src[k]) { dist[k] = 0; frontier.push(k); }
  for (let step = 1; step < max && frontier.length; step++) {
    const next: number[] = [];
    for (const k of frontier) {
      const x = k % N, z = (k / N) | 0;
      for (const d of DIRS) {
        const nx = x + d.dx, nz = z + d.dz;
        if (!inBounds(nx, nz)) continue;
        const nk = idx(nx, nz);
        if (dist[nk] > step) { dist[nk] = step; next.push(nk); }
      }
    }
    frontier = next;
  }
  return dist;
}

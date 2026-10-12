import { MAP_SIZE } from '../config';

export const N = MAP_SIZE;

export interface Tile { x: number; z: number }

export const idx = (x: number, z: number) => z * N + x;
export const inBounds = (x: number, z: number) => x >= 0 && z >= 0 && x < N && z < N;
export const tileToWorld = (t: number) => t - N / 2 + 0.5;
export const worldToTile = (w: number) => Math.floor(w + N / 2);
export const clampTile = (t: Tile): Tile => ({
  x: Math.min(N - 1, Math.max(0, t.x)),
  z: Math.min(N - 1, Math.max(0, t.z)),
});

// Bit flags: N = -z, E = +x, S = +z, W = -x
export const DIRS = [
  { bit: 1, dx: 0, dz: -1 },
  { bit: 2, dx: 1, dz: 0 },
  { bit: 4, dx: 0, dz: 1 },
  { bit: 8, dx: -1, dz: 0 },
] as const;

export const oppositeBit = (bit: number) => (bit === 1 ? 4 : bit === 2 ? 8 : bit === 4 ? 1 : 2);

export function dirBit(from: Tile, to: Tile): number {
  for (const d of DIRS) if (from.x + d.dx === to.x && from.z + d.dz === to.z) return d.bit;
  return 0;
}

/** L-shaped path: longer axis first, then the other. */
export function lPath(a: Tile, b: Tile): Tile[] {
  const out: Tile[] = [];
  const sx = Math.sign(b.x - a.x), sz = Math.sign(b.z - a.z);
  const xFirst = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z);
  let x = a.x, z = a.z;
  out.push({ x, z });
  if (xFirst) {
    while (x !== b.x) { x += sx; out.push({ x, z }); }
    while (z !== b.z) { z += sz; out.push({ x, z }); }
  } else {
    while (z !== b.z) { z += sz; out.push({ x, z }); }
    while (x !== b.x) { x += sx; out.push({ x, z }); }
  }
  return out;
}

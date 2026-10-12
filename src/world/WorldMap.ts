import { LEVEL_H, WATER_BED } from '../config';
import { DIRS, N, idx, inBounds } from './grid';

/** Static terrain data: mountain height levels and water. */
export class WorldMap {
  readonly height = new Uint8Array(N * N);
  readonly water = new Uint8Array(N * N);
  /** 0 = green meadow, ~0.55 = dry steppe, ~0.65+ = sandy desert (from the seed). */
  readonly arid = new Float32Array(N * N);

  constructor(readonly seed: number) {}

  /** Flat, dry ground — roads and buildings go here. */
  isLand(k: number) {
    return this.water[k] === 0 && this.height[k] === 0;
  }

  topY(k: number) {
    return this.water[k] ? WATER_BED : this.height[k] * LEVEL_H;
  }

  isShore(x: number, z: number) {
    if (!this.isLand(idx(x, z))) return false;
    return DIRS.some((d) => inBounds(x + d.dx, z + d.dz) && this.water[idx(x + d.dx, z + d.dz)]);
  }

  /** Number of mountain tiles within a square radius. */
  mountainsNear(x: number, z: number, r: number) {
    let n = 0;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (inBounds(x + dx, z + dz) && this.height[idx(x + dx, z + dz)] > 0) n++;
      }
    }
    return n;
  }
}

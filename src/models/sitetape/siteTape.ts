import * as THREE from 'three';
import { box, merge } from '../quality';

/**
 * Yellow-and-black hazard tape on little posts around a construction site of `size` tiles.
 * Centred on the building, models face +z.
 */
export function siteTapeGeometry(size: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const half = size / 2 - 0.03;
  const seg = 0.12;
  const corners: [number, number][] = [[-half, -half], [half, -half], [half, half], [-half, half]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / seg));
    for (let k = 0; k < n; k++) {
      // the entrance side (+z) keeps a gap in the middle for the builders
      const f0 = k / n, f1 = (k + 1) / n;
      if (i === 2 && f0 > 0.4 && f1 < 0.6) continue;
      const x = ax + (bx - ax) * (f0 + f1) / 2, z = az + (bz - az) * (f0 + f1) / 2;
      const along = len / n;
      const color = k % 2 ? '#1d1d1f' : '#f5c518';
      for (const y of [0.14, 0.24]) parts.push(box(bx !== ax ? along : 0.012, 0.035, bz !== az ? along : 0.012, x, y, z, color));
    }
    // posts at the corners and every half tile
    const posts = Math.max(1, Math.round(len / 0.5));
    for (let k = 0; k < posts; k++) {
      const f = k / posts;
      parts.push(box(0.03, 0.28, 0.03, ax + (bx - ax) * f, 0.14, az + (bz - az) * f, k === 0 ? '#e85a3a' : '#f4f4f2'));
    }
  }
  return merge(parts);
}

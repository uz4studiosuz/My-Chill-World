import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/**
 * A tall block of flats: `floors` storeys on a plot of `size` tiles, rows of windows and balconies,
 * a lit entrance and a roof with a water tank. Walls in `wall`, trim and balconies in `trim`.
 */
export function towerGeometry(floors: number, size: number, wall: string, trim: string): THREE.BufferGeometry {
  const fh = 0.2;
  const w = size * 0.78, d = size * 0.62;
  const z0 = -size * 0.1;
  const h = floors * fh + 0.12;
  const parts: THREE.BufferGeometry[] = [
    box(size - 0.06, 0.02, size - 0.06, 0, 0.01, 0, '#bdb7aa'),
    box(w, 0.12, d, 0, 0.06, z0, '#8e8a83'),
    box(w, h - 0.12, d, 0, 0.12 + (h - 0.12) / 2, z0, wall),
    box(w + 0.04, 0.05, d + 0.04, 0, h + 0.025, z0, trim),
    // entrance with a canopy
    box(0.26, 0.16, 0.02, 0, 0.08, z0 + d / 2 + 0.005, '#3d2a1e'),
    box(0.4, 0.02, 0.14, 0, 0.19, z0 + d / 2 + 0.07, trim),
    // roof: a little water tank and a lift room
    shape('cylinder', 0.14, 0.14, 0.14, -w / 4, h + 0.12, z0, '#9aa3ab', 'y', 10),
    box(0.22, 0.12, 0.18, w / 4, h + 0.11, z0, trim),
  ];
  const cols = Math.max(3, Math.round(w / 0.13));
  for (let f = 0; f < floors; f++) {
    const y = 0.12 + f * fh + fh * 0.55;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (c + 0.5) * (w / cols);
      // front and back windows
      parts.push(box(w / cols * 0.55, fh * 0.45, 0.012, x, y, z0 + d / 2 + 0.004, '#a8d0e6'));
      parts.push(box(w / cols * 0.55, fh * 0.45, 0.012, x, y, z0 - d / 2 - 0.004, '#a8d0e6'));
    }
    // balconies on every other floor
    if (f % 2 === 1) for (let c = 0; c < cols; c += 2) parts.push(box(w / cols * 0.8, 0.025, 0.06, -w / 2 + (c + 0.5) * (w / cols), y - fh * 0.32, z0 + d / 2 + 0.03, trim));
    // side windows
    parts.push(box(0.012, fh * 0.45, d * 0.5, -w / 2 - 0.004, y, z0, '#a8d0e6'), box(0.012, fh * 0.45, d * 0.5, w / 2 + 0.004, y, z0, '#a8d0e6'));
  }
  return merge(parts);
}

/** 15 flats: eight floors. */
export const tower15Geometry = () => towerGeometry(8, 2, '#e6dccb', '#c4553d');
/** 30 flats: twelve floors. */
export const tower30Geometry = () => towerGeometry(12, 2, '#dbe5ec', '#3f6fb5');
/** 50 flats: sixteen floors on a big plot. */
export const tower50Geometry = () => towerGeometry(16, 3, '#efe6d2', '#4f7d4a');

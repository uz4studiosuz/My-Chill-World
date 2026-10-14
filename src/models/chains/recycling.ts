import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { METAL, PAVE } from './_shared';

/** Recycling plant (2×2): sorting hall, conveyor and coloured bins. */
export function recyclingGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    box(1.2, 0.5, 0.8, -0.2, 0.25, -0.45, '#4c9a52'),
    box(1.26, 0.06, 0.86, -0.2, 0.53, -0.45, '#2d6a33'),
    shape('cylinder', 0.3, 0.6, 0.3, 0.7, 0.3, -0.5, '#cfd6dc'),
    box(0.4, 0.2, 0.02, -0.2, 0.3, -0.045, '#f2f4f6'),
    box(0.16, 0.16, 0.02, -0.2, 0.3, -0.04, '#4c9a52'),
    box(0.9, 0.04, 0.12, 0.2, 0.2, 0.15, METAL),
    box(0.02, 0.2, 0.02, -0.2, 0.1, 0.15, METAL), box(0.02, 0.2, 0.02, 0.6, 0.1, 0.15, METAL),
    ...[['#3a6fd1', -0.6], ['#f2c230', -0.35], ['#4c9a52', -0.1], ['#d9443b', 0.15]].map(([c, x]) => box(0.18, 0.18, 0.18, x as number, 0.09, 0.7, c as string)),
  ]);
}

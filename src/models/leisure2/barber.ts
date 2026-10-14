import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';

/** Barber shop: small shop with a striped pole. */
export function barberGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.66, 0.42, 0.5, 0, 0.21, -0.12, '#f4f1ea'),
    box(0.72, 0.05, 0.56, 0, 0.445, -0.12, '#26292e'),
    box(0.46, 0.22, 0.02, -0.04, 0.16, 0.135, '#a8d0e6'),
    box(0.7, 0.04, 0.16, 0, 0.32, 0.2, '#d9443b'),
    box(0.68, 0.035, 0.165, 0, 0.29, 0.2, '#f4f4f2'),
    shape('cylinder', 0.05, 0.32, 0.05, 0.27, 0.18, 0.17, '#f4f4f2', 'y', 8),
    ...[0.08, 0.16, 0.24].map((y) => shape('cylinder', 0.055, 0.03, 0.055, 0.27, y, 0.17, y === 0.16 ? '#2f7fc1' : '#d9443b', 'y', 8)),
    shape('sphere', 0.07, 0.07, 0.07, 0.27, 0.36, 0.17, '#f4f4f2', 'y', 8),
    box(0.16, 0.07, 0.07, -0.25, 0.06, 0.25, '#8a5a35'),
  ]);
}

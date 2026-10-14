import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';

/** Bakery (1×1): brick oven chimney, awning and a bread sign. */
export function bakeryGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.42, 0.56, 0, 0.21, -0.12, '#f1dcc6'),
    box(0.76, 0.06, 0.62, 0, 0.45, -0.12, '#a65e43'),
    box(0.12, 0.3, 0.12, 0.22, 0.58, -0.2, '#a65e43'),
    box(0.5, 0.18, 0.02, 0, 0.17, 0.165, '#a8d0e6'),
    box(0.74, 0.03, 0.16, 0, 0.32, 0.24, '#e8a13a'),
    box(0.74, 0.03, 0.16, 0, 0.3, 0.24, '#f4f1ea'),
    box(0.2, 0.08, 0.02, 0, 0.38, 0.165, '#6b4a2e'),
    shape('sphere', 0.12, 0.05, 0.07, 0, 0.385, 0.18, '#d9a04a'),
    ...[-0.25, 0.25].map((x) => box(0.12, 0.08, 0.12, x, 0.04, 0.38, '#8a5a35')),
  ]);
}

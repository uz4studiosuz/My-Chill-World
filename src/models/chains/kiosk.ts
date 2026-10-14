import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';

/** Coffee & ice-cream cart under a red-and-white umbrella. */
export function kioskGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, '#76b04f'),
    box(0.5, 0.022, 0.5, 0, 0.012, 0.05, PAVE),
    box(0.3, 0.16, 0.18, 0, 0.13, 0, '#d9443b'),
    box(0.32, 0.02, 0.2, 0, 0.22, 0, '#f4f1ea'),
    cylX(0.04, 0.02, -0.16, 0.04, 0.06, '#26292e', 10), cylX(0.04, 0.02, 0.16, 0.04, 0.06, '#26292e', 10),
    box(0.02, 0.36, 0.02, 0.1, 0.36, -0.05, '#cccccc'),
    shape('cone', 0.5, 0.12, 0.5, 0.1, 0.58, -0.05, '#f4f1ea', 'y', 8),
    shape('cone', 0.42, 0.1, 0.42, 0.1, 0.6, -0.05, '#d9443b', 'y', 8),
    box(0.05, 0.06, 0.05, -0.08, 0.26, 0.04, '#6b4a2e'), box(0.04, 0.05, 0.04, 0.02, 0.255, 0.04, '#f2c230'),
    box(0.08, 0.1, 0.06, -0.3, 0.05, 0.3, '#6b4a2e'), box(0.08, 0.1, 0.06, 0.3, 0.05, 0.3, '#6b4a2e'),
  ]);
}

import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';

/** Dairy: white hall, milk tanks and a cow sign. */
export function dairyGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    box(1.1, 0.45, 0.8, -0.3, 0.225, -0.4, '#f4f1ea'),
    box(1.16, 0.06, 0.86, -0.3, 0.48, -0.4, '#3a6fd1'),
    ...[-0.6, -0.3, 0, 0.3].map((x) => box(0.14, 0.12, 0.02, x - 0.3 + 0.3, 0.26, -0.005, '#a8d0e6')),
    box(0.2, 0.26, 0.02, -0.3, 0.13, -0.005, '#6b4a2e'),
    shape('cylinder', 0.3, 0.7, 0.3, 0.65, 0.35, -0.55, '#e9edf0', 'y', 14),
    shape('dome', 0.3, 0.1, 0.3, 0.65, 0.75, -0.55, '#cfd6dc', 'y', 14),
    shape('cylinder', 0.3, 0.7, 0.3, 0.65, 0.35, -0.1, '#e9edf0', 'y', 14),
    shape('dome', 0.3, 0.1, 0.3, 0.65, 0.75, -0.1, '#cfd6dc', 'y', 14),
    box(0.3, 0.16, 0.02, -0.3, 0.6, -0.005, '#f4f1ea'), box(0.08, 0.08, 0.025, -0.36, 0.6, -0.005, '#26292e'), box(0.06, 0.06, 0.025, -0.22, 0.62, -0.005, '#26292e'),
  ]);
}

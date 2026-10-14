import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { GOLD } from './_shared';

/** Casino: dark hall with golden trim, a lit sign and a canopy. */
export function casinoGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#3a3540'),
    box(1.6, 0.7, 1.0, 0, 0.35, -0.4, '#3b2a55'),
    box(1.66, 0.06, 1.06, 0, 0.73, -0.4, GOLD),
    box(1.0, 0.25, 0.7, 0, 0.88, -0.45, '#2c1f42'),
    shape('dome', 0.6, 0.25, 0.6, 0, 1.0, -0.45, GOLD, 'y', 16),
    box(1.2, 0.18, 0.04, 0, 0.58, 0.11, '#d9443b'),
    ...[-0.45, -0.15, 0.15, 0.45].map((x) => box(0.14, 0.08, 0.05, x, 0.58, 0.13, '#ffe066')),
    box(0.5, 0.36, 0.02, 0, 0.18, 0.105, '#f2b33d'),
    box(1.0, 0.04, 0.5, 0, 0.42, 0.36, '#2c1f42'),
    ...[-0.45, 0.45].map((x) => shape('cylinder', 0.05, 0.42, 0.05, x, 0.21, 0.58, GOLD, 'y', 8)),
    box(0.3, 0.012, 0.9, 0, 0.026, 0.5, '#b0303a'),
    ...[-0.8, 0.8].flatMap((x) => [shape('cylinder', 0.04, 0.5, 0.04, x, 0.25, 0.75, '#26292e', 'y', 6), shape('sphere', 0.12, 0.12, 0.12, x, 0.55, 0.75, '#ffe066', 'y', 8)]),
  ]);
}

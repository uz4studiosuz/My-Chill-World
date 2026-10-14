import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { GRASS, PAVING, WOOD, METAL, shrub } from './_shared';

/** Two park benches and a litter bin. */
export function benchGeometry(): THREE.BufferGeometry {
  const bench = (x: number, z: number) => [
    box(0.4, 0.03, 0.12, x, 0.1, z, WOOD), box(0.4, 0.12, 0.03, x, 0.17, z - 0.06, WOOD),
    box(0.03, 0.09, 0.1, x - 0.17, 0.045, z, METAL), box(0.03, 0.09, 0.1, x + 0.17, 0.045, z, METAL),
  ];
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.9, 0.022, 0.3, 0, 0.012, 0.1, PAVING),
    ...bench(-0.2, -0.05), ...bench(0.25, -0.05),
    box(0.08, 0.14, 0.08, 0.44, 0.07, 0.1, '#4c9a52'),
    ...shrub(-0.3, -0.35, 0.6), ...shrub(0.3, -0.35, 0.6, '#5f9a3e'),
  ]);
}

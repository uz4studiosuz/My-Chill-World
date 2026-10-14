import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { METAL } from './_shared';

/** Hydro dam: a concrete wall with sluices and a turbine house. */
export function hydroGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#9d9d9a'),
    box(1.9, 0.5, 0.4, 0, 0.1, -0.5, '#cfc8b6'),
    ...[-0.6, -0.2, 0.2, 0.6].map((x) => box(0.2, 0.16, 0.42, x, 0.16, -0.5, '#4fa3d1')),
    box(1.9, 0.05, 0.44, 0, 0.375, -0.5, '#a9a294'),
    box(0.8, 0.3, 0.5, 0.3, 0.15, 0.4, '#e9edf0'), box(0.84, 0.04, 0.54, 0.3, 0.32, 0.4, '#3a6fd1'),
    ...[0, 1, 2].map((i) => box(0.03, 0.4, 0.03, -0.6 + i * 0.15, 0.2, 0.5, METAL)),
  ]);
}

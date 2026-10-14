import * as THREE from 'three';
import { box, cylX, merge } from '../../utils/voxel';
import { PAVE } from './_shared';

/** Gym: glass-front hall with a dumbbell sign. */
export function gymGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.8, 0.5, 0.6, 0, 0.25, -0.12, '#3a4350'),
    box(0.84, 0.05, 0.64, 0, 0.525, -0.12, '#f07167'),
    box(0.66, 0.3, 0.02, 0, 0.2, 0.185, '#8fc1e3'),
    box(0.16, 0.26, 0.025, 0.24, 0.13, 0.19, '#26292e'),
    cylX(0.02, 0.3, 0, 0.44, 0.2, '#cfd6dc', 6), cylX(0.06, 0.04, -0.15, 0.44, 0.2, '#26292e', 10), cylX(0.06, 0.04, 0.15, 0.44, 0.2, '#26292e', 10),
    ...[-0.2, 0.0].map((x) => box(0.12, 0.05, 0.05, x, 0.08, 0.17, '#5d6670')),
  ]);
}

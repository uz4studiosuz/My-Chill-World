import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { METAL } from './_shared';

/** Supermarket: wide glass front, sign and trolleys. */
export function supermarketGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#9d9d9a'),
    box(1.8, 0.5, 1.0, 0, 0.25, -0.45, '#e9edf0'),
    box(1.86, 0.06, 1.06, 0, 0.53, -0.45, '#d9443b'),
    box(1.5, 0.28, 0.02, 0, 0.18, 0.055, '#6f9fc8'),
    box(0.9, 0.12, 0.03, 0, 0.42, 0.06, '#d9443b'), box(0.7, 0.05, 0.035, 0, 0.42, 0.065, '#f4f4f2'),
    ...[-0.75, -0.45, 0.45, 0.75].map((x) => box(0.02, 0.012, 0.32, x, 0.016, 0.72, '#f4f4f2')),
    box(0.16, 0.08, 0.1, 0.0, 0.06, 0.3, METAL), box(0.16, 0.08, 0.1, 0.0, 0.06, 0.42, METAL),
  ]);
}

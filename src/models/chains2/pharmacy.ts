import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { PAVE } from './_shared';

/** Pharmacy: white shop with a green cross. */
export function pharmacyGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.4, 0.55, 0, 0.2, -0.12, '#f4f4f2'),
    box(0.76, 0.05, 0.6, 0, 0.425, -0.12, '#2e8b57'),
    box(0.5, 0.18, 0.02, 0, 0.16, 0.16, '#a8d0e6'),
    box(0.16, 0.05, 0.03, 0, 0.36, 0.16, '#2e8b57'), box(0.05, 0.16, 0.03, 0, 0.36, 0.16, '#2e8b57'),
    box(0.74, 0.03, 0.14, 0, 0.3, 0.23, '#2e8b57'),
  ]);
}

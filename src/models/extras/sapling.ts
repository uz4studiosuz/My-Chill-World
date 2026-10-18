import * as THREE from 'three';
import { box, merge } from '../quality';
import { GRASS } from './_shared';

/** A young tree: plane tree (chinor) or fir (archa). */
export function saplingGeometry(kind = 0): THREE.BufferGeometry {
  if (kind % 2 === 0) {
    return merge([
      box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
      box(0.3, 0.025, 0.3, 0, 0.015, 0, '#6b4a2e'),
      box(0.08, 0.5, 0.08, 0, 0.25, 0, '#7a5a3e'),
      box(0.6, 0.3, 0.6, 0, 0.6, 0, '#4f8a3a'),
      box(0.44, 0.2, 0.44, 0, 0.82, 0, '#5f9a3e'),
      box(0.3, 0.16, 0.7, 0, 0.55, 0, '#4f8a3a'),
    ]);
  }
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.3, 0.025, 0.3, 0, 0.015, 0, '#6b4a2e'),
    box(0.07, 0.2, 0.07, 0, 0.1, 0, '#6b4a2e'),
    box(0.5, 0.2, 0.5, 0, 0.3, 0, '#2d5a32'),
    box(0.38, 0.2, 0.38, 0, 0.5, 0, '#336b3a'),
    box(0.24, 0.2, 0.24, 0, 0.7, 0, '#3a7a42'),
    box(0.1, 0.12, 0.1, 0, 0.86, 0, '#3a7a42'),
  ]);
}

import * as THREE from 'three';
import { box, merge } from '../quality';

/** Flowers and ribbons on a wedding car. */
export function weddingDecorGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.1, 0.03, 0.06, 0, 0.18, -0.02, '#f2efe2'),
    box(0.04, 0.035, 0.04, -0.03, 0.2, -0.02, '#e85a7a'),
    box(0.04, 0.035, 0.04, 0.03, 0.2, -0.02, '#e07ba8'),
    box(0.012, 0.008, 0.3, -0.05, 0.1, 0.0, '#e85a7a'),
    box(0.012, 0.008, 0.3, 0.05, 0.1, 0.0, '#e85a7a'),
    box(0.06, 0.04, 0.02, 0, 0.08, 0.16, '#f2efe2'),
  ]);
}

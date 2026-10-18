import * as THREE from 'three';
import { box, merge } from '../quality';

export function headstoneGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.18, 0.02, 0.22, 0, 0.01, 0.02, '#554133'),
    box(0.13, 0.15, 0.04, 0, 0.085, -0.07, '#8f8e8b'),
    box(0.09, 0.03, 0.04, 0, 0.175, -0.07, '#8f8e8b'),
    box(0.04, 0.03, 0.04, 0.02, 0.03, 0.06, '#d9443b'),
  ]);
}


// ---------- services & businesses ----------

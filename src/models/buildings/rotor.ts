import * as THREE from 'three';
import { box, merge } from '../quality';

/** Rotor of the wind turbine (spins). */
export function rotorGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.06, 0.06, 0.06, 0, 0, 0, '#cfd6dc'),
    box(0.04, 0.6, 0.02, 0, 0.3, 0, '#f2f4f6'),
    box(0.04, 0.6, 0.02, 0, 0.3, 0, '#f2f4f6').rotateZ((Math.PI * 2) / 3),
    box(0.04, 0.6, 0.02, 0, 0.3, 0, '#f2f4f6').rotateZ((Math.PI * 4) / 3),
  ]);
}

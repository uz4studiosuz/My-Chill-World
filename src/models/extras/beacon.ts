import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** Two-colour beacon on an emergency vehicle's roof (tinted per frame). */
export function beaconGeometry(): THREE.BufferGeometry {
  return merge([box(0.05, 0.035, 0.035, -0.03, 0.19, 0.0, '#ff3b30'), box(0.05, 0.035, 0.035, 0.03, 0.19, 0.0, '#3a7bff')]);
}

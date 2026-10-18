import * as THREE from 'three';
import { box, merge } from '../quality';

export function lampHeadGeometry(): THREE.BufferGeometry {
  return merge([box(0.08, 0.09, 0.08, -0.15, 0.55, 0), box(0.08, 0.09, 0.08, 0.15, 0.55, 0)]);
}

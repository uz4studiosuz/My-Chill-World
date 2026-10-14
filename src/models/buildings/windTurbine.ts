import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function windTurbineGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.5, 0.06, 0.5, 0, 0.03, 0, '#9aa0a6'),
    box(0.08, 1.6, 0.08, 0, 0.8, 0, '#f2f4f6'),
    box(0.16, 0.1, 0.24, 0, 1.62, 0, '#e9edf0'),
  ]);
}

import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** Four windmill sails around the hub (rotated as one piece). */
export function millSailsGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.06, 0.06, 0.06, 0, 0, 0, '#6b4a2e'),
    box(0.06, 0.62, 0.015, 0, 0.34, 0, '#efe6d2'), box(0.06, 0.62, 0.015, 0, -0.34, 0, '#efe6d2'),
    box(0.62, 0.06, 0.015, 0.34, 0, 0, '#efe6d2'), box(0.62, 0.06, 0.015, -0.34, 0, 0, '#efe6d2'),
  ]);
}

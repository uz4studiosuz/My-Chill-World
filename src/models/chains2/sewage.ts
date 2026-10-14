import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { PAVE, METAL } from './_shared';

/** Sewage treatment: round settling tanks with water and a pump house. */
export function sewageGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    shape('cylinder', 0.8, 0.14, 0.8, -0.45, 0.07, -0.45, '#cfc8b6', 'y', 20),
    shape('cylinder', 0.68, 0.145, 0.68, -0.45, 0.075, -0.45, '#6b8a5a', 'y', 20),
    shape('cylinder', 0.8, 0.14, 0.8, 0.45, 0.07, -0.45, '#cfc8b6', 'y', 20),
    shape('cylinder', 0.68, 0.145, 0.68, 0.45, 0.075, -0.45, '#5f8fa0', 'y', 20),
    box(0.5, 0.3, 0.4, 0.4, 0.15, 0.5, '#e9edf0'), box(0.54, 0.04, 0.44, 0.4, 0.32, 0.5, '#3a6fd1'),
    cylX(0.04, 1.2, -0.1, 0.06, 0.1, METAL, 8),
  ]);
}

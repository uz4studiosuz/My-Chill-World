import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';

/** Coal mine: headframe tower, coal heap and a cart. */
export function coalmineGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#5a5246'),
    ...[[-0.5, -0.6], [-0.1, -0.6], [-0.5, -0.2], [-0.1, -0.2]].map(([x, z]) => box(0.05, 0.9, 0.05, x, 0.45, z, '#3d4148')),
    box(0.5, 0.05, 0.5, -0.3, 0.9, -0.4, '#3d4148'),
    cylX(0.14, 0.04, -0.3, 1.0, -0.4, '#8c8f94', 14),
    box(0.5, 0.25, 0.4, 0.5, 0.125, -0.5, '#6d6a62'),
    shape('cone', 0.8, 0.3, 0.7, 0.3, 0.15, 0.45, '#26292e', 'y', 10),
    box(0.2, 0.1, 0.14, -0.5, 0.08, 0.5, '#8a5a35'),
  ]);
}

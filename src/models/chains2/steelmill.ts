import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** Steel mill: blast furnace, hall and glowing slag. */
export function steelmillGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#8c8f94'),
    box(1.1, 0.5, 0.8, -0.35, 0.25, -0.45, '#5d6670'),
    box(1.16, 0.06, 0.86, -0.35, 0.53, -0.45, '#3d4148'),
    shape('cylinder', 0.4, 1.0, 0.4, 0.55, 0.5, -0.45, '#6f7880', 'y', 12),
    shape('cone', 0.4, 0.2, 0.4, 0.55, 1.1, -0.45, '#3d4148', 'y', 12),
    shape('cylinder', 0.12, 0.6, 0.12, 0.85, 1.3, -0.7, '#4a5058', 'y', 8),
    box(0.4, 0.04, 0.3, 0.4, 0.03, 0.5, '#ff7a1a'),
    ...[0, 1, 2].map((i) => box(0.6, 0.04, 0.06, -0.4, 0.03 + i * 0.045, 0.55, '#9aa3ab')),
  ]);
}

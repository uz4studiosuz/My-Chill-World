import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function powerPlantGeometry(): THREE.BufferGeometry {
  const brick = '#a65e43', dark = '#5a5f66';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#9d9d9a'),
    box(1.1, 0.55, 0.9, -0.3, 0.275, -0.35, brick),
    box(1.16, 0.06, 0.96, -0.3, 0.58, -0.35, dark),
    box(0.2, 1.3, 0.2, 0.45, 0.65, -0.55, brick),
    box(0.24, 0.06, 0.24, 0.45, 1.33, -0.55, dark),
    box(0.3, 0.3, 0.3, 0.55, 0.15, 0.1, '#8c8f94'),
    box(0.36, 0.04, 0.36, 0.55, 0.32, 0.1, '#6f7378'),
    box(0.03, 0.5, 0.03, 0.75, 0.25, 0.55, '#6f7378'),
    box(0.25, 0.03, 0.03, 0.75, 0.48, 0.55, '#6f7378'),
    box(0.3, 0.28, 0.02, -0.3, 0.14, 0.105, '#3d4148'),
  ];
  for (let i = 0; i < 4; i++) parts.push(box(0.14, 0.1, 0.02, -0.7 + i * 0.27, 0.38, 0.105, '#f2d27a'));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    parts.push(box(0.06, 0.06, 0.4, -0.85 + i * 0.07, 0.03 + j * 0.06, 0.55, j ? '#8a5a35' : '#9c6a40'));
  }
  return merge(parts);
}

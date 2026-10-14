import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { METAL } from './_shared';

/** Sawmill (2×2): open saw shed, log pile and stacks of planks. */
export function sawmillGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b8a07a'),
    ...[[-0.8, -0.8], [0.2, -0.8], [-0.8, 0.0], [0.2, 0.0]].map(([x, z]) => box(0.05, 0.42, 0.05, x, 0.21, z, '#6b4a2e')),
    box(1.16, 0.05, 0.96, -0.3, 0.44, -0.4, '#8a5a35'),
    box(0.6, 0.12, 0.3, -0.3, 0.08, -0.4, METAL),
    cylX(0.08, 0.02, -0.3, 0.2, -0.4, '#cfd6dc', 12),
    box(0.4, 0.06, 0.08, -0.3, 0.17, -0.4, '#c98a5a'),
  ];
  for (let i = 0; i < 6; i++) parts.push(shape('cylinder', 0.6, 0.09, 0.09, 0.6, 0.06 + Math.floor(i / 3) * 0.09, -0.55 + (i % 3) * 0.1, '#8a5a35', 'x', 8));
  for (let i = 0; i < 5; i++) parts.push(box(0.5, 0.03, 0.18, 0.45, 0.03 + i * 0.035, 0.5, i % 2 ? '#e2c48e' : '#d4b27a'));
  for (let i = 0; i < 4; i++) parts.push(box(0.5, 0.03, 0.18, -0.35, 0.03 + i * 0.035, 0.55, i % 2 ? '#e2c48e' : '#d4b27a'));
  return merge(parts);
}

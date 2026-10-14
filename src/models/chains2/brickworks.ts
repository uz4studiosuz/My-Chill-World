import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** Brickworks: kiln with a tall chimney and stacks of red bricks. */
export function brickworksGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b8a07a'),
    box(1.0, 0.4, 0.7, -0.35, 0.2, -0.5, '#a65e43'),
    box(1.06, 0.06, 0.76, -0.35, 0.43, -0.5, '#6d4c3d'),
    shape('cylinder', 0.18, 1.1, 0.18, 0.5, 0.55, -0.6, '#8a4a35', 'y', 10),
    box(0.3, 0.24, 0.02, -0.35, 0.12, -0.145, '#26292e'),
  ];
  for (let i = 0; i < 8; i++) parts.push(box(0.28, 0.07, 0.18, -0.6 + (i % 4) * 0.32, 0.04 + Math.floor(i / 4) * 0.075, 0.5, i % 2 ? '#c4553d' : '#b24a35'));
  return merge(parts);
}

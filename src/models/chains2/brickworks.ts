import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { door, parapet, windows } from '../details';

/** Brickworks: a long kiln with arched firing doors, a tall chimney, a clay pit, a drying shed and pallets of bricks. */
export function brickworksGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#b8a07a'),
    // the kiln: brick body, a row of glowing firing doors, a vaulted roof
    box(1.0, 0.4, 0.7, -0.35, 0.2, -0.5, '#a65e43'), box(1.02, 0.04, 0.72, -0.35, 0.02, -0.5, '#7d4433'),
    shape('arch', 1.0, 0.16, 0.7, -0.35, 0.48, -0.5, '#8a4a35', 'y', 12),
    ...[-0.7, -0.47, -0.24, -0.01].flatMap((x) => [shape('arch', 0.12, 0.14, 0.02, x, 0.07 + 0.07, -0.145, '#26292e', 'y', 8), box(0.08, 0.03, 0.012, x, 0.04, -0.14, '#ff8a3a')]),
    // the chimney with bands
    shape('cylinder', 0.18, 1.1, 0.18, 0.5, 0.55, -0.6, '#8a4a35', 'y', 10),
    ...[0.4, 0.75].map((y) => shape('cylinder', 0.19, 0.04, 0.19, 0.5, y, -0.6, '#6d3a2a', 'y', 10)),
    shape('cylinder', 0.21, 0.04, 0.21, 0.5, 1.1, -0.6, '#3a3532', 'y', 10),
    // the office with windows
    box(0.36, 0.3, 0.3, 0.55, 0.15, -0.05, '#e3d6c4'), box(0.4, 0.04, 0.34, 0.55, 0.32, -0.05, '#6d4c3d'),
    ...parapet(0.55, -0.05, 0.4, 0.34, 0.34, '#6d4c3d', 0.02, 0.03),
    ...windows('front', 0.55, -0.05, 0.18, 0.15, 0.2, 2, { w: 0.08, h: 0.08 }),
    ...door(0.4, 0.105, 0.08, 0.18, '#5c3a21'),
    // the drying shed: an open roof on posts over racks of green bricks
    box(0.7, 0.02, 0.36, -0.35, 0.3, 0.12, '#6d4c3d'),
    ...[-0.68, -0.02].flatMap((x) => [-0.04, 0.28].map((z) => box(0.03, 0.29, 0.03, x, 0.145, z, '#6b4a2e'))),
    ...[0.06, 0.13, 0.2].map((y) => box(0.6, 0.012, 0.26, -0.35, y, 0.12, '#c9a37a')),
    // the clay pit
    box(0.5, 0.012, 0.36, 0.55, 0.02, 0.62, '#8a6a4a'), shape('dome', 0.3, 0.08, 0.22, 0.6, 0.04, 0.6, '#b07a52', 'y', 8),
  ];
  // pallets of finished bricks
  for (let i = 0; i < 8; i++) {
    const x = -0.7 + (i % 4) * 0.27, y = 0.04 + Math.floor(i / 4) * 0.075;
    parts.push(box(0.24, 0.07, 0.18, x, y + 0.012, 0.6, i % 2 ? '#c4553d' : '#b24a35'));
    if (i < 4) parts.push(box(0.25, 0.02, 0.19, x, 0.012, 0.6, '#a8794d'));
  }
  return merge(parts);
}

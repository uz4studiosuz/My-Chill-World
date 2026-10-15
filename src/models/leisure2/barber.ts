import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';
import { bench, door, parapet, planter, shopFront, sign, windows } from '../details';

/** Barber shop: a small two-storey shop with a striped awning, the red-white-blue pole and a flat upstairs. */
export function barberGeometry(): THREE.BufferGeometry {
  const wall = '#f4f1ea';
  const awning: THREE.BufferGeometry[] = [];
  // a striped awning over the shop window
  for (let i = 0; i < 8; i++) awning.push(box(0.085, 0.03, 0.16, -0.31 + i * 0.087, 0.33, 0.21, i % 2 ? '#f4f4f2' : '#d9443b'));
  for (let i = 0; i < 8; i++) awning.push(box(0.085, 0.05, 0.012, -0.31 + i * 0.087, 0.295, 0.29, i % 2 ? '#f4f4f2' : '#d9443b'));
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.66, 0.6, 0.5, 0, 0.3, -0.12, wall),
    box(0.68, 0.04, 0.52, 0, 0.02, -0.12, '#8d8a83'),
    box(0.68, 0.025, 0.52, 0, 0.4, -0.12, '#cfc8b6'),
    box(0.72, 0.04, 0.56, 0, 0.62, -0.12, '#26292e'),
    ...parapet(0, -0.12, 0.72, 0.56, 0.64, '#26292e'),
    box(0.14, 0.12, 0.14, 0.18, 0.7, -0.24, '#8a7d70'), box(0.16, 0.02, 0.16, 0.18, 0.77, -0.24, '#5d544b'),
    ...shopFront(-0.07, 0.05, 0.135, 0.38, 0.2),
    ...door(0.2, 0.135, 0.12, 0.22, '#26292e', { glass: true }),
    ...awning,
    ...sign(-0.05, 0.37, 0.14, 0.4, 0.035, '#26292e', '#f2c230'),
    // upstairs: two windows with flower boxes
    ...windows('front', 0, -0.12, 0.33, 0.25, 0.5, 2, { w: 0.12, h: 0.12 }),
    ...[-0.165, 0.165].map((x) => box(0.15, 0.03, 0.04, x, 0.425, 0.155, '#e85a7a')),
    ...windows('left', 0, -0.12, 0.33, 0.25, 0.5, 2, { w: 0.1, h: 0.11 }),
    // the barber's pole
    shape('cylinder', 0.05, 0.32, 0.05, 0.31, 0.2, 0.17, '#f4f4f2', 'y', 8),
    ...[0.1, 0.18, 0.26].map((y) => shape('cylinder', 0.055, 0.03, 0.055, 0.31, y, 0.17, y === 0.18 ? '#2f7fc1' : '#d9443b', 'y', 8)),
    shape('sphere', 0.07, 0.07, 0.07, 0.31, 0.38, 0.17, '#f4f4f2', 'y', 8),
    ...bench(-0.25, 0.38), ...planter(0.4, 0.38),
  ]);
}

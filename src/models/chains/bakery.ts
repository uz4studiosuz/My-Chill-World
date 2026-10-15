import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';
import { bench, door, planter, shopFront, sign, windows } from '../details';

/** Bakery (1×1): a cosy shop with a brick oven chimney, a striped awning, loaves in the window and a pitched tiled roof. */
export function bakeryGeometry(): THREE.BufferGeometry {
  const awning: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) awning.push(box(0.092, 0.025, 0.17, -0.32 + i * 0.092, 0.33, 0.25, i % 2 ? '#f4f1ea' : '#e8a13a'), box(0.092, 0.045, 0.012, -0.32 + i * 0.092, 0.3, 0.335, i % 2 ? '#f4f1ea' : '#e8a13a'));
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.44, 0.56, 0, 0.22, -0.12, '#f1dcc6'),
    box(0.72, 0.04, 0.58, 0, 0.02, -0.12, '#a89f90'),
    // a pitched tiled roof with a ridge
    shape('wedge', 0.78, 0.16, 0.32, 0, 0.52, 0.02, '#a65e43'), shape('wedge', 0.78, 0.16, 0.32, 0, 0.52, -0.26, '#a65e43'),
    box(0.78, 0.02, 0.03, 0, 0.6, -0.12, '#8a4a35'),
    // the oven chimney
    box(0.12, 0.3, 0.12, 0.22, 0.58, -0.2, '#a65e43'), box(0.15, 0.03, 0.15, 0.22, 0.735, -0.2, '#6d4c3d'),
    ...shopFront(-0.08, 0.05, 0.165, 0.4, 0.2),
    ...door(0.24, 0.165, 0.12, 0.22, '#6b4a2e', { glass: true }),
    ...awning,
    ...sign(-0.02, 0.4, 0.17, 0.42, 0.04, '#6b4a2e', '#f2d27a'),
    shape('sphere', 0.12, 0.05, 0.07, 0, 0.44, 0.18, '#d9a04a'),
    // loaves on the shelf in the window
    ...[-0.22, -0.12, -0.02, 0.08].map((x) => shape('capsule', 0.07, 0.035, 0.035, x, 0.11, 0.15, '#d9a04a', 'x', 8)),
    ...windows('left', 0, -0.12, 0.35, 0.28, 0.26, 2, { w: 0.1, h: 0.1 }),
    // bread crates and a bench outside
    ...[-0.25, 0.25].map((x) => box(0.12, 0.08, 0.12, x, 0.05, 0.4, '#8a5a35')),
    box(0.1, 0.03, 0.1, -0.25, 0.1, 0.4, '#e8c07a'),
    ...bench(0.05, 0.42), ...planter(0.42, 0.4),
  ]);
}

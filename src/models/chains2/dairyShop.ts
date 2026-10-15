import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';
import { bench, door, parapet, planter, roofKit, shopFront, sign, windows } from '../details';

/**
 * Dairy shop: a cream-white shop with a black-and-white cow-print awning, a big milk bottle on the roof,
 * a cold counter seen through the window and crates of milk bottles by the door.
 */
export function dairyShopGeometry(): THREE.BufferGeometry {
  const blue = '#3b78c2', cream = '#fbf6ea';
  // the awning: white with black patches, like a cow
  const awning = [
    box(0.74, 0.025, 0.15, 0, 0.32, 0.23, '#f7f7f4'), box(0.74, 0.04, 0.012, 0, 0.3, 0.305, '#f7f7f4'),
    ...[[-0.24, 0.22], [-0.05, 0.25], [0.16, 0.21], [0.3, 0.26]].map(([x, z]) => box(0.09, 0.028, 0.06, x, 0.322, z, '#24272b')),
    ...[-0.3, -0.1, 0.12, 0.28].map((x) => box(0.05, 0.03, 0.013, x, 0.3, 0.306, '#24272b')),
  ];
  // milk crates with bottles by the door
  const crate = (x: number, z: number) => [
    box(0.12, 0.06, 0.1, x, 0.05, z, blue),
    ...[-0.03, 0.03].flatMap((dx) => [-0.022, 0.022].flatMap((dz) => [
      shape('cylinder', 0.022, 0.05, 0.022, x + dx, 0.1, z + dz, '#ffffff', 'y', 8), box(0.014, 0.012, 0.014, x + dx, 0.13, z + dz, '#d84c3a'),
    ])),
  ];
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.58, 0.55, 0, 0.29, -0.12, cream),
    box(0.72, 0.04, 0.57, 0, 0.02, -0.12, '#8d8a83'),
    box(0.72, 0.03, 0.57, 0, 0.4, -0.12, blue),
    box(0.76, 0.04, 0.6, 0, 0.6, -0.12, '#d7d0bf'),
    ...parapet(0, -0.12, 0.76, 0.6, 0.62, '#d7d0bf'),
    ...roofKit(-0.12, -0.2, 0.35, 0.35, 0.62, 3),
    ...shopFront(-0.1, 0.05, 0.16, 0.4, 0.22),
    // the cold counter behind the glass: white shelves with bottles and cheese
    box(0.34, 0.08, 0.06, -0.1, 0.1, 0.11, '#e9eef2'), ...[-0.22, -0.14, -0.06, 0.02].map((x) => shape('cylinder', 0.018, 0.05, 0.018, x, 0.16, 0.11, '#ffffff', 'y', 8)),
    box(0.06, 0.035, 0.04, 0.08, 0.155, 0.11, '#f2c84b'),
    ...door(0.22, 0.16, 0.13, 0.24, '#26292e', { glass: true, lamp: true }),
    ...awning,
    ...sign(-0.1, 0.36, 0.165, 0.36, 0.035, blue, '#ffffff'),
    // a big milk bottle on the roof
    shape('cylinder', 0.09, 0.2, 0.09, 0.18, 0.74, -0.06, '#ffffff', 'y', 12),
    shape('cone', 0.09, 0.07, 0.09, 0.18, 0.875, -0.06, '#ffffff', 'y', 12),
    shape('cylinder', 0.045, 0.04, 0.045, 0.18, 0.93, -0.06, '#ffffff', 'y', 10),
    shape('cylinder', 0.05, 0.02, 0.05, 0.18, 0.955, -0.06, blue, 'y', 10),
    box(0.15, 0.06, 0.012, 0.18, 0.74, 0.03, blue),
    // upstairs
    ...windows('left', 0, -0.12, 0.35, 0.275, 0.5, 2, { w: 0.1, h: 0.1 }),
    ...windows('right', 0, -0.12, 0.35, 0.275, 0.5, 2, { w: 0.1, h: 0.1 }),
    ...crate(0.4, 0.3), ...crate(0.4, 0.17),
    ...bench(-0.32, 0.4), ...planter(-0.42, 0.24),
  ]);
}

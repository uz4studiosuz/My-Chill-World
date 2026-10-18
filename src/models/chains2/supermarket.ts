import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { METAL } from './_shared';
import { lamp, parapet, planter, roofKit, shopFront, sign, windows } from '../details';

/** Supermarket: a wide hall with a glass front, an entrance canopy, the big sign, a car park with lamps and trolleys. */
export function supermarketGeometry(): THREE.BufferGeometry {
  const wall = '#e9edf0', red = '#d9443b';
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#9d9d9a'),
    // the hall with a red top band, a parapet and machinery on the roof
    box(1.8, 0.52, 1.0, 0, 0.26, -0.45, wall),
    box(1.82, 0.04, 1.02, 0, 0.02, -0.45, '#8d8a83'),
    box(1.84, 0.1, 1.04, 0, 0.5, -0.45, red),
    box(1.8, 0.012, 1.0, 0, 0.556, -0.45, '#8a8f98'),
    ...parapet(0, -0.45, 1.84, 1.04, 0.55, '#b5362f'),
    ...roofKit(-0.4, -0.5, 0.8, 0.7, 0.55, 5), ...roofKit(0.45, -0.5, 0.6, 0.6, 0.55, 9),
    // the shop windows either side of the entrance, and the entrance under a glass canopy
    ...shopFront(-0.55, 0.05, 0.055, 0.62, 0.26),
    ...shopFront(0.55, 0.05, 0.055, 0.62, 0.26),
    box(0.36, 0.3, 0.012, 0, 0.2, 0.055, '#6f9fc8'), box(0.012, 0.3, 0.02, 0, 0.2, 0.06, '#26292e'),
    box(0.5, 0.025, 0.24, 0, 0.36, 0.17, '#cfd6dc'), box(0.02, 0.33, 0.02, -0.23, 0.18, 0.28, METAL), box(0.02, 0.33, 0.02, 0.23, 0.18, 0.28, METAL),
    ...sign(0, 0.42, 0.075, 0.9, 0.1, red, '#ffffff'),
    // side windows of the offices and a loading door at the back
    ...windows('left', 0, -0.45, 0.9, 0.5, 0.3, 3, { w: 0.14, h: 0.12 }),
    ...windows('right', 0, -0.45, 0.9, 0.5, 0.3, 3, { w: 0.14, h: 0.12 }),
    box(0.4, 0.3, 0.02, 0.5, 0.17, -0.96, '#9aa3ab'), ...[0.08, 0.16, 0.24].map((y) => box(0.4, 0.008, 0.024, 0.5, y, -0.96, '#7d828a')),
    // car park: bays, lamps, a trolley shelter and trolleys
    ...[-0.75, -0.45, 0.45, 0.75].map((x) => box(0.02, 0.012, 0.32, x, 0.016, 0.72, '#f4f4f2')),
    ...lamp(-0.9, 0.62, 0.42), ...lamp(0.9, 0.62, 0.42),
    box(0.3, 0.02, 0.14, -0.3, 0.2, 0.42, '#cfd6dc'), box(0.012, 0.19, 0.012, -0.44, 0.1, 0.36, METAL), box(0.012, 0.19, 0.012, -0.16, 0.1, 0.36, METAL),
    ...[-0.4, -0.3, -0.2].map((x) => box(0.08, 0.06, 0.1, x, 0.05, 0.42, METAL)),
    box(0.1, 0.07, 0.12, 0.25, 0.055, 0.42, METAL), box(0.012, 0.06, 0.012, 0.25, 0.1, 0.48, METAL),
    ...planter(-0.85, 0.2), ...planter(0.85, 0.2),
    shape('cylinder', 0.035, 0.06, 0.035, 0.4, 0.04, 0.2, '#3f6b4a', 'y', 8),
  ];
  return merge(parts);
}

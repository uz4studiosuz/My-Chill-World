import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { PAVE } from './_shared';
import { door, lamp, parapet, roofKit, windows } from '../details';

/** Dairy: a white hall with a blue band, steel milk tanks with ladders and pipes, a cow sign and a milk tanker at the bay. */
export function dairyGeometry(): THREE.BufferGeometry {
  const blue = '#3a6fd1';
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    box(1.1, 0.48, 0.8, -0.3, 0.24, -0.4, '#f4f1ea'),
    box(1.12, 0.04, 0.82, -0.3, 0.02, -0.4, '#8d8a83'),
    box(1.12, 0.05, 0.82, -0.3, 0.33, -0.4, blue),
    box(1.16, 0.05, 0.86, -0.3, 0.5, -0.4, '#5d6670'),
    box(1.1, 0.012, 0.8, -0.3, 0.531, -0.4, '#8a8f98'),
    ...parapet(-0.3, -0.4, 1.16, 0.86, 0.525, '#5d6670'),
    ...roofKit(-0.3, -0.45, 0.8, 0.5, 0.525, 29),
    ...windows('front', -0.3, -0.4, 0.55, 0.4, 0.2, 4, { from: -0.45, to: 0.45, w: 0.13, h: 0.1 }),
    ...windows('front', -0.3, -0.4, 0.55, 0.4, 0.42, 5, { w: 0.13, h: 0.08 }),
    ...windows('left', -0.3, -0.4, 0.55, 0.4, 0.2, 3, { w: 0.13, h: 0.1 }),
    ...door(-0.3, 0.0, 0.18, 0.26, '#6b4a2e', { canopy: blue }),
    // the cow sign on the roof edge
    box(0.3, 0.16, 0.02, -0.3, 0.63, -0.005, '#f4f1ea'), box(0.08, 0.08, 0.025, -0.36, 0.63, -0.005, '#26292e'), box(0.06, 0.06, 0.025, -0.22, 0.65, -0.005, '#26292e'),
    box(0.012, 0.1, 0.012, -0.42, 0.56, -0.01, '#5d6670'), box(0.012, 0.1, 0.012, -0.18, 0.56, -0.01, '#5d6670'),
  ];
  // two steel tanks with a ring, a ladder and a dome
  for (const z of [-0.55, -0.1]) {
    parts.push(
      shape('cylinder', 0.3, 0.7, 0.3, 0.65, 0.35, z, '#e9edf0', 'y', 16), shape('dome', 0.3, 0.1, 0.3, 0.65, 0.75, z, '#cfd6dc', 'y', 16),
      shape('cylinder', 0.31, 0.02, 0.31, 0.65, 0.4, z, '#b8c0c8', 'y', 16),
      ...[0.12, 0.24, 0.36, 0.48, 0.6].map((y) => box(0.012, 0.012, 0.06, 0.49, y, z, '#8a8f98')),
      box(0.012, 0.66, 0.012, 0.49, 0.33, z - 0.03, '#8a8f98'), box(0.012, 0.66, 0.012, 0.49, 0.33, z + 0.03, '#8a8f98'),
    );
  }
  parts.push(
    box(0.3, 0.03, 0.03, 0.4, 0.3, -0.33, '#b8c0c8'),
    // a milk tanker at the bay
    box(0.14, 0.12, 0.14, 0.45, 0.09, 0.55, '#3a6fd1'), box(0.13, 0.05, 0.142, 0.45, 0.13, 0.55, '#6f9fc8'),
    shape('capsule', 0.16, 0.14, 0.4, 0.45, 0.13, 0.27, '#e9edf0', 'z', 12),
    ...[0.6, 0.35, 0.15].flatMap((z) => [-0.06, 0.06].map((dx) => shape('cylinder', 0.07, 0.025, 0.07, 0.45 + dx, 0.035, z, '#1d2127', 'x', 12))),
    ...lamp(-0.9, 0.5, 0.4), ...lamp(0.1, 0.5, 0.4),
  );
  return merge(parts);
}

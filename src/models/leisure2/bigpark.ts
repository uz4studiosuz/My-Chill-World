import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { tree } from './_shared';

/** Central park (3×3): lawns, a pond with a bridge, a pavilion, benches and lots of trees. */
export function bigparkGeometry(): THREE.BufferGeometry {
  const parts = [
    box(2.94, 0.02, 2.94, 0, 0.01, 0, '#86c062'),
    box(0.3, 0.012, 2.9, 0.15, 0.024, 0, '#d8cfb2'),
    box(2.9, 0.012, 0.3, 0, 0.024, 0.55, '#d8cfb2'),
    shape('cylinder', 1.0, 0.02, 0.7, -0.75, 0.024, -0.6, '#5fb2e0', 'y', 20),
    box(0.5, 0.05, 0.12, -0.75, 0.06, -0.6, '#8a5a35'),
    // pavilion (shiyponcha)
    shape('cylinder', 0.6, 0.06, 0.6, 0.85, 0.04, -0.75, '#e9e2d0', 'y', 12),
    ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return shape('cylinder', 0.04, 0.4, 0.04, 0.85 + Math.cos(a) * 0.25, 0.27, -0.75 + Math.sin(a) * 0.25, '#f4f4f2', 'y', 6); }),
    shape('cone', 0.75, 0.25, 0.75, 0.85, 0.58, -0.75, '#2f7fc1', 'y', 6),
    ...[-0.9, -0.45, 0.6, 1.05].map((x) => box(0.24, 0.07, 0.08, x, 0.06, 0.82, '#8a5a35')),
    ...tree(-1.2, 0.3, 0.55), ...tree(-0.6, 0.25, 0.45), ...tree(1.2, 0.2, 0.5), ...tree(0.7, 1.15, 0.45), ...tree(-1.1, 1.15, 0.5),
    ...tree(-0.2, 1.2, 0.4, '#3f7a30'), ...tree(1.25, -1.25, 0.5, '#3f7a30'), ...tree(-1.25, -1.25, 0.45), ...tree(0.45, -1.2, 0.4),
    ...[[-0.4, 1.3, '#f28cb8'], [1.2, 0.85, '#f2b33d'], [-1.3, -0.1, '#d9443b']].map(([x, z, c]) => box(0.3, 0.05, 0.2, x as number, 0.04, z as number, c as string)),
  ];
  return merge(parts);
}

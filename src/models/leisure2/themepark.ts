import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { PAVE, GRASS, tree } from './_shared';

/** Amusement park (4×4): entrance gate, roller coaster, stalls, trees. The ferris wheel and carousel are separate meshes. */
export function themeparkGeometry(): THREE.BufferGeometry {
  const parts = [
    box(3.94, 0.02, 3.94, 0, 0.01, 0, GRASS),
    box(0.5, 0.015, 3.6, 0, 0.025, 0.1, PAVE),
    box(3.4, 0.015, 0.45, 0, 0.025, 0.2, PAVE),
    // gate
    ...[-0.4, 0.4].map((x) => box(0.1, 0.6, 0.1, x, 0.3, 1.85, '#d9443b')),
    box(0.95, 0.16, 0.08, 0, 0.62, 1.85, '#f2b33d'),
    box(0.7, 0.06, 0.09, 0, 0.62, 1.86, '#d9443b'),
    // ferris wheel stand
    ...[-0.12, 0.12].map((x) => box(0.05, 1.1, 0.05, -1.1 + x, 0.55, -1.15, '#9aa3ab')),
    box(0.6, 0.06, 0.4, -1.1, 0.03, -1.15, '#8e96a1'),
    // carousel base
    shape('cylinder', 0.9, 0.08, 0.9, 1.05, 0.04, 1.0, '#e9e2d0', 'y', 20),
    // roller coaster: a looping track on posts
    ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => {
      const x = 0.4 + i * 0.2, h = 0.35 + Math.sin(i * 0.9) * 0.25 + 0.25;
      return [box(0.03, h, 0.03, x, h / 2, -1.45, '#5d6670'), box(0.22, 0.04, 0.12, x, h, -1.45, '#d9443b')];
    }),
    ...[0, 1, 2, 3, 4, 5].flatMap((i) => {
      const z = -1.3 + i * 0.2, h = 0.3 + Math.cos(i) * 0.15 + 0.2;
      return [box(0.03, h, 0.03, 1.8, h / 2, z, '#5d6670'), box(0.12, 0.04, 0.22, 1.8, h, z, '#d9443b')];
    }),
    // stalls: candy floss, ice cream, tickets
    ...[[-1.35, 0.75, '#f28cb8'], [-0.85, 0.75, '#6fb6ff'], [-1.35, 1.45, '#7be08f']].flatMap(([x, z, c]) => [
      box(0.32, 0.22, 0.26, x as number, 0.11, z as number, '#f4f1ea'),
      shape('wedge', 0.38, 0.1, 0.32, x as number, 0.27, z as number, c as string),
    ]),
    // swing ride
    shape('cylinder', 0.06, 0.8, 0.06, 1.05, 0.4, -0.35, '#9aa3ab', 'y', 8),
    shape('cone', 0.7, 0.18, 0.7, 1.05, 0.86, -0.35, '#f2b33d', 'y', 12),
    ...tree(-1.75, -0.2, 0.45), ...tree(-1.7, 0.3, 0.4), ...tree(1.75, 1.75, 0.45), ...tree(-1.75, -1.75, 0.5), ...tree(0.45, 1.65, 0.38),
    ...[-0.35, 0.35].map((x) => box(0.24, 0.07, 0.1, x, 0.06, -0.4, '#8a5a35')),
  ];
  return merge(parts);
}

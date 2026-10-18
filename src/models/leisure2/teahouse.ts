import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { GOLD, tree } from './_shared';

/** Teahouse (choyxona): blue-tiled hall, a terrace with carved columns and raised tapchans with red carpets. */
export function teahouseGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#d8cfbd'),
    box(1.5, 0.48, 0.7, 0, 0.24, -0.58, '#efe6d2'),
    box(1.56, 0.05, 0.76, 0, 0.505, -0.58, '#2f7fc1'),
    ...[-0.5, -0.17, 0.17, 0.5].map((x) => box(0.2, 0.26, 0.02, x, 0.24, -0.225, '#2f7fc1')),
    // aivan: terrace roof on carved wooden columns
    box(1.6, 0.05, 0.75, 0, 0.5, 0.15, '#8a5a35'),
    box(1.64, 0.04, 0.79, 0, 0.535, 0.15, '#6b4a2e'),
    ...[-0.75, -0.25, 0.25, 0.75].map((x) => shape('cylinder', 0.05, 0.48, 0.05, x, 0.25, 0.48, '#a8794d', 'y', 8)),
    // tapchans
    ...[-0.45, 0.45].flatMap((x) => [
      box(0.5, 0.1, 0.42, x, 0.07, 0.15, '#8a5a35'),
      box(0.46, 0.015, 0.38, x, 0.125, 0.15, '#b0303a'),
      box(0.18, 0.04, 0.18, x, 0.15, 0.15, '#6b4a2e'),
      shape('cylinder', 0.05, 0.04, 0.05, x, 0.19, 0.15, '#f4f4f2', 'y', 8),
    ]),
    // samovar and a plov kazan by the side
    shape('cylinder', 0.1, 0.16, 0.1, 0.82, 0.1, 0.72, GOLD, 'y', 10),
    shape('cone', 0.06, 0.06, 0.06, 0.82, 0.21, 0.72, GOLD, 'y', 8),
    shape('cylinder', 0.22, 0.08, 0.22, -0.8, 0.07, 0.75, '#5d6670', 'y', 12),
    shape('dome', 0.24, 0.06, 0.24, -0.8, 0.11, 0.75, '#26292e', 'y', 12),
    ...tree(0.85, -0.15, 0.4), ...tree(-0.85, -0.12, 0.38),
  ];
  return merge(parts);
}

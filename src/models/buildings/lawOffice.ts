import * as THREE from 'three';
import { box, merge, shape } from '../quality';

export function lawOfficeGeometry(): THREE.BufferGeometry {
  const stone = '#e8dfcc', trim = '#cbb99b', roof = '#405b70', gold = '#d5ad55';
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.04, 1.8, 0, 0.02, 0, '#b7b5a9'),
    box(1.5, 1.2, 1.05, 0, 0.64, -0.24, stone),
    box(1.58, 0.09, 1.13, 0, 1.28, -0.24, roof),
    box(1.0, 0.08, 0.26, 0, 0.93, 0.38, trim),
    shape('pyramid', 1.02, 0.18, 0.28, 0, 1.05, 0.38, roof),
    ...[-0.42, 0.42].map((x) => shape('cylinder', 0.08, 0.74, 0.08, x, 0.48, 0.4, '#f3eee2', 'y', 10)),
    box(0.32, 0.5, 0.03, 0, 0.31, 0.3, '#394e5a'),
    ...[-0.55, 0.55].flatMap((x) => [0.4, 0.82].map((y) => box(0.25, 0.24, 0.025, x, y, 0.3, '#6f9fc8'))),
    box(0.55, 0.08, 0.16, 0, 0.07, 0.56, trim),
    box(0.035, 0.52, 0.035, 0, 1.59, -0.24, gold),
    box(0.6, 0.035, 0.035, 0, 1.72, -0.24, gold),
    ...[-0.26, 0.26].flatMap((x) => [
      box(0.02, 0.17, 0.02, x, 1.62, -0.24, gold),
      shape('cylinder', 0.2, 0.035, 0.2, x, 1.53, -0.24, gold, 'y', 10),
    ]),
  ];
  return merge(parts);
}

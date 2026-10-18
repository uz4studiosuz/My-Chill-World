import * as THREE from 'three';
import { box, merge } from '../quality';

/** Academy (2×2): columns, a dome and a small sports ground. */
export function academyGeometry(): THREE.BufferGeometry {
  const wall = '#efe6d2', trim = '#d8cdb5', roof = '#2d4f8a';
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#bdb7aa'),
    box(1.5, 0.7, 0.8, 0, 0.35, -0.5, wall),
    box(1.58, 0.06, 0.88, 0, 0.73, -0.5, trim),
    box(1.6, 0.1, 0.25, 0, 0.62, 0.0, trim),
    box(0.5, 0.25, 0.5, 0, 0.88, -0.5, roof),
    box(0.3, 0.15, 0.3, 0, 1.06, -0.5, roof),
    box(0.03, 0.18, 0.03, 0, 1.2, -0.5, '#d4af37'),
    ...[-0.6, -0.3, 0, 0.3, 0.6].map((x) => box(0.07, 0.56, 0.07, x, 0.3, 0.0, '#f4f1ea')),
    box(1.5, 0.04, 0.3, 0, 0.02, 0.05, trim),
    box(0.22, 0.32, 0.02, 0, 0.16, -0.095, '#6b4a2e'),
    ...[-0.5, -0.25, 0.25, 0.5].flatMap((x) => [box(0.14, 0.14, 0.02, x, 0.3, -0.095, '#a8d0e6'), box(0.14, 0.12, 0.02, x, 0.55, -0.095, '#a8d0e6')]),
    box(1.6, 0.022, 0.5, 0, 0.012, 0.62, '#c4553d'),
    box(1.3, 0.024, 0.3, 0, 0.014, 0.62, '#4f9a3e'),
    box(0.02, 0.1, 0.2, -0.6, 0.06, 0.62, '#ffffff'), box(0.02, 0.1, 0.2, 0.6, 0.06, 0.62, '#ffffff'),
  ]);
}

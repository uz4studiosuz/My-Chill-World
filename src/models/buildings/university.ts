import * as THREE from 'three';
import { box, merge } from '../quality';

export function universityGeometry(): THREE.BufferGeometry {
  const wall = '#e7d9bd', roof = '#7d4a3a', trim = '#f4efe2';
  const parts = [
    box(2.9, 0.02, 2.9, 0, 0.01, 0, '#9ea58f'),
    box(2.4, 0.9, 1.0, 0, 0.45, -0.6, wall),
    box(2.5, 0.08, 1.1, 0, 0.94, -0.6, roof),
    box(0.8, 1.4, 0.8, 0, 0.7, -0.6, wall),
    box(0.9, 0.08, 0.9, 0, 1.44, -0.6, roof),
    box(0.5, 0.2, 0.5, 0, 1.58, -0.6, trim),
    box(0.4, 0.14, 0.4, 0, 1.75, -0.6, roof),
    box(0.04, 0.2, 0.04, 0, 1.92, -0.6, '#cccccc'),
    box(0.8, 0.12, 0.5, 0, 0.06, 0.1, '#c9c3b2'),
    box(0.6, 0.5, 0.04, 0, 0.25, -0.06, '#5a7f9c'),
    box(0.9, 0.03, 0.6, 0.9, 0.04, 0.8, '#7ea65b'),
    box(0.9, 0.03, 0.6, -0.9, 0.04, 0.8, '#7ea65b'),
  ];
  for (let row = 0; row < 3; row++) for (let col = -4; col <= 4; col++) {
    if (Math.abs(col) < 2 && row < 2) continue;
    parts.push(box(0.16, 0.14, 0.02, col * 0.26, 0.25 + row * 0.26, -0.09, '#a8d0e6'));
  }
  for (const x of [-0.3, -0.1, 0.1, 0.3]) parts.push(box(0.06, 0.5, 0.06, x, 0.3, 0.0, trim));
  return merge(parts);
}

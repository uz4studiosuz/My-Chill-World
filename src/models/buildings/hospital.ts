import * as THREE from 'three';
import { box, merge } from '../quality';

export function hospitalGeometry(): THREE.BufferGeometry {
  const wall = '#f2f4f6', trim = '#cfd6dc', red = '#d9443b', glass = '#a8d0e6';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#bcb8ae'),
    box(1.5, 0.9, 0.9, 0, 0.45, -0.3, wall),
    box(1.56, 0.06, 0.96, 0, 0.93, -0.3, trim),
    box(0.7, 1.2, 0.8, 0.55, 0.6, -0.3, wall),
    box(0.76, 0.06, 0.86, 0.55, 1.23, -0.3, trim),
    box(0.34, 0.1, 0.02, 0.55, 1.0, 0.115, red),
    box(0.1, 0.34, 0.02, 0.55, 1.0, 0.115, red),
    box(0.6, 0.04, 0.34, -0.3, 0.4, 0.3, red),
    box(0.4, 0.3, 0.02, -0.3, 0.15, 0.16, '#5a7f9c'),
    box(0.4, 0.12, 0.2, 0.0, 0.07, 0.62, '#e9edf0'),
    box(0.32, 0.06, 0.2, -0.55, 0.08, 0.65, '#e9edf0'),
  ];
  for (const x of [-0.6, -0.3, 0, 0.3]) for (const y of [0.3, 0.62]) parts.push(box(0.16, 0.14, 0.02, x, y, 0.16, glass));
  return merge(parts);
}

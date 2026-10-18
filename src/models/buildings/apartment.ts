import * as THREE from 'three';
import { box, merge } from '../quality';

export function apartmentGeometry(): THREE.BufferGeometry {
  const wall = '#e9e2d3', trim = '#c9c0ad', roof = '#5d6670';
  const floors = 5, fh = 0.32;
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#9d9d9a'),
    box(1.9, 0.015, 0.34, 0, 0.018, 0.78, '#6f7378'),
    box(1.5, floors * fh, 1.1, 0, (floors * fh) / 2, -0.25, wall),
    box(1.56, 0.08, 1.16, 0, floors * fh + 0.04, -0.25, roof),
    box(0.3, 0.2, 0.3, 0.45, floors * fh + 0.18, -0.4, '#8a8f98'),
    box(0.3, 0.32, 0.03, 0, 0.16, 0.31, '#5c3a21'),
  ];
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 0.18;
    parts.push(box(1.52, 0.02, 1.12, 0, f * fh, -0.25, trim));
    for (const x of [-0.55, -0.2, 0.2, 0.55]) {
      if (f === 0 && Math.abs(x) < 0.3) continue;
      parts.push(box(0.2, 0.14, 0.02, x, y, 0.31, '#a8d0e6'));
      if (f > 0) parts.push(box(0.26, 0.03, 0.12, x, y - 0.09, 0.37, trim));
    }
    for (const z of [-0.6, -0.2, 0.1]) parts.push(box(0.02, 0.14, 0.18, 0.76, y, z, '#a8d0e6'), box(0.02, 0.14, 0.18, -0.76, y, z, '#a8d0e6'));
  }
  return merge(parts);
}

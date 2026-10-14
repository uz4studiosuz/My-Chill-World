import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { GLASS } from './_shared';

export function townHallGeometry(): THREE.BufferGeometry {
  const wall = '#eee6d4', roof = '#3567c4', trim = '#d8cdb5';
  const parts = [
    box(1.9, 0.02, 0.55, 0, 0.01, 0.68, '#9d9d9a'),
    box(1.5, 0.84, 1.0, 0, 0.42, -0.2, wall),
    box(1.6, 0.1, 1.1, 0, 0.89, -0.2, roof),
    box(1.2, 0.08, 0.8, 0, 0.98, -0.2, roof),
    box(0.36, 0.5, 0.36, 0, 1.25, -0.2, wall),
    box(0.42, 0.08, 0.42, 0, 1.53, -0.2, roof),
    box(0.24, 0.14, 0.24, 0, 1.64, -0.2, roof),
    box(0.16, 0.16, 0.02, 0, 1.3, -0.01, '#ffffff'),
    box(0.3, 0.24, 0.02, 0, 0.12, 0.305, '#5a7f9c'),
    box(0.06, 0.3, 0.06, -0.22, 0.15, 0.4, trim),
    box(0.06, 0.3, 0.06, 0.22, 0.15, 0.4, trim),
    box(0.6, 0.05, 0.22, 0, 0.32, 0.38, roof),
    box(0.03, 0.7, 0.03, 0.78, 0.35, 0.62, '#cccccc'),
    box(0.22, 0.13, 0.01, 0.9, 0.62, 0.62, '#d9443b'),
  ];
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      if (row === 0 && Math.abs(col) < 1) continue;
      parts.push(box(0.16, 0.12, 0.02, col * 0.28, 0.2 + row * 0.24, 0.305, GLASS));
    }
  }
  return merge(parts);
}

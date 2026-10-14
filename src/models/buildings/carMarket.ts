import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function carMarketGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#8d8f93'),
    box(1.5, 0.55, 0.8, 0, 0.28, -0.6, '#f2f4f6'),
    box(1.56, 0.06, 0.86, 0, 0.58, -0.6, '#3a6fd1'),
    box(1.2, 0.3, 0.02, 0, 0.2, -0.19, '#a8d0e6'),
    box(0.04, 0.5, 0.04, 0.8, 0.25, 0.6, '#cccccc'),
    box(0.36, 0.2, 0.02, 0.8, 0.62, 0.6, '#d9443b'),
  ];
  const cols = ['#d9443b', '#3a6fd1', '#f1c232', '#4c9a52', '#f2f2ee', '#e07b2e'];
  cols.forEach((c, i) => {
    const x = -0.65 + (i % 3) * 0.6, z = 0.25 + Math.floor(i / 3) * 0.55;
    parts.push(box(0.4, 0.1, 0.22, x, 0.07, z, c));
    parts.push(box(0.22, 0.09, 0.18, x, 0.16, z, '#a8d0e6'));
  });
  return merge(parts);
}

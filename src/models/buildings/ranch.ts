import * as THREE from 'three';
import { box, merge } from '../quality';

export function ranchGeometry(): THREE.BufferGeometry {
  const fence = '#9c7a52';
  const parts = [box(2.9, 0.02, 2.9, 0, 0.01, 0, '#9bc066')];
  for (const [x, z, w, d] of [[0, -1.42, 2.84, 0.03], [0, 1.42, 2.84, 0.03], [-1.42, 0, 0.03, 2.84], [1.42, 0, 0.03, 2.84]]) {
    parts.push(box(w, 0.025, d, x, 0.09, z, fence), box(w, 0.025, d, x, 0.16, z, fence));
  }
  for (let i = -1.4; i <= 1.41; i += 0.35) {
    for (const [x, z] of [[i, -1.42], [i, 1.42], [-1.42, i], [1.42, i]]) parts.push(box(0.04, 0.2, 0.04, x, 0.1, z, '#7a5a3c'));
  }
  parts.push(
    box(0.7, 0.5, 0.5, -0.9, 0.25, -0.95, '#b0402f'),
    box(0.76, 0.14, 0.56, -0.9, 0.57, -0.95, '#6d4c3d'),
    box(0.22, 0.3, 0.02, -0.9, 0.15, -0.695, '#f2ede2'),
    box(0.4, 0.08, 0.14, 0.7, 0.04, -0.9, '#8c8f94'),
    box(0.36, 0.02, 0.1, 0.7, 0.07, -0.9, '#4a9cc0'),
    box(0.3, 0.2, 0.3, 0.9, 0.1, 0.9, '#e2c26a'),
  );
  return merge(parts);
}

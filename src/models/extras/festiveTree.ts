import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** New Year fir with baubles. */
export function festiveTreeGeometry(): THREE.BufferGeometry {
  const parts = [
    box(0.1, 0.2, 0.1, 0, 0.1, 0, '#6b4a2e'),
    box(0.8, 0.3, 0.8, 0, 0.35, 0, '#2d5a32'),
    box(0.62, 0.3, 0.62, 0, 0.62, 0, '#336b3a'),
    box(0.44, 0.28, 0.44, 0, 0.88, 0, '#3a7a42'),
    box(0.26, 0.24, 0.26, 0, 1.12, 0, '#3a7a42'),
    box(0.1, 0.1, 0.1, 0, 1.3, 0, '#f2c230'),
  ];
  const cols = ['#d9443b', '#f2c230', '#3a6fd1', '#e85a7a', '#ffffff'];
  for (let i = 0; i < 24; i++) {
    const lv = i % 4, a = i * 2.4, r = [0.41, 0.32, 0.23, 0.14][lv];
    parts.push(box(0.05, 0.05, 0.05, Math.cos(a) * r, 0.3 + lv * 0.27, Math.sin(a) * r, cols[i % cols.length]));
  }
  return merge(parts);
}

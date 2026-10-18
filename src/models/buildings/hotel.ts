import * as THREE from 'three';
import { box, merge } from '../quality';

export function hotelGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#bdb7aa'),
    box(1.4, 1.5, 0.8, 0, 0.75, -0.4, '#f1e8da'),
    box(1.46, 0.08, 0.86, 0, 1.53, -0.4, '#7d4a3a'),
    box(0.9, 0.1, 0.4, 0, 0.42, 0.2, '#7d4a3a'),
    box(0.06, 0.4, 0.06, -0.4, 0.2, 0.36, '#d4af37'),
    box(0.06, 0.4, 0.06, 0.4, 0.2, 0.36, '#d4af37'),
    box(0.5, 0.1, 0.02, 0, 1.25, 0.005, '#d4af37'),
    box(0.6, 0.04, 0.5, 0.55, 0.03, 0.55, '#4fa3d1'),
    box(0.7, 0.03, 0.6, 0.55, 0.02, 0.55, '#e8e3d6'),
  ];
  for (let f = 0; f < 4; f++) for (const x of [-0.5, -0.25, 0.25, 0.5]) parts.push(box(0.16, 0.16, 0.02, x, 0.6 + f * 0.24, 0.005, '#a8d0e6'));
  return merge(parts);
}

import * as THREE from 'three';
import { box, merge } from '../quality';

/** Navruz: a flower mound with a sumalak cauldron. */
export function navruzGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.0, 0.08, 1.0, 0, 0.04, 0, '#cfc8b6'),
    box(0.9, 0.1, 0.9, 0, 0.09, 0, '#6b4a2e'),
    box(0.6, 0.1, 0.6, 0, 0.18, 0, '#6b4a2e'),
    box(0.22, 0.14, 0.22, 0, 0.3, 0, '#3d4148'),
    box(0.18, 0.02, 0.18, 0, 0.375, 0, '#7a4a2a'),
  ];
  const cols = ['#e85a7a', '#f2c230', '#f2efe2', '#b0478f', '#e85a3a'];
  for (let i = 0; i < 40; i++) {
    const a = i * 0.7, r = i < 24 ? 0.4 : 0.26, y = i < 24 ? 0.16 : 0.25;
    parts.push(box(0.06, 0.06, 0.06, Math.cos(a) * r, y, Math.sin(a) * r, cols[i % cols.length]));
  }
  return merge(parts);
}

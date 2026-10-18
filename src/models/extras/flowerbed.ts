import * as THREE from 'three';
import { box, merge } from '../quality';
import { GRASS } from './_shared';

/** Flower bed in a stone border. */
export function flowerbedGeometry(variant = 0): THREE.BufferGeometry {
  const sets = [['#e85a7a', '#f2c230', '#f2efe2'], ['#b0478f', '#e85a3a', '#f2c230'], ['#e07ba8', '#6f9fc8', '#f2efe2']];
  const cols = sets[variant % sets.length];
  const parts = [
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.8, 0.06, 0.8, 0, 0.03, 0, '#cfc8b6'),
    box(0.72, 0.065, 0.72, 0, 0.034, 0, '#6b4a2e'),
  ];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const x = -0.3 + i * 0.1, z = -0.3 + j * 0.1;
    const r = Math.hypot(x, z);
    parts.push(box(0.05, 0.05, 0.05, x, 0.09 + (r < 0.15 ? 0.04 : 0), z, r < 0.15 ? cols[2] : cols[(i + j) % 2]));
    if ((i + j) % 2 === 0) parts.push(box(0.03, 0.04, 0.03, x, 0.06, z, '#4f8a3a'));
  }
  return merge(parts);
}

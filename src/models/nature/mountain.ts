import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** Stepped voxel mountain for the gallery. */
export function mountainGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let lvl = 0; lvl < 7; lvl++) {
    const s = 3.2 - lvl * 0.42;
    const color = lvl >= 5 ? '#f2f4f6' : lvl % 2 ? '#8f8c86' : '#9b978e';
    parts.push(box(s, 0.5, s * (0.9 + (lvl % 2) * 0.08), lvl * 0.05, 0.25 + lvl * 0.5, -lvl * 0.04, color));
  }
  return merge(parts);
}

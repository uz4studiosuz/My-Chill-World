import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** Rows of crops (white — tinted from green to gold as they ripen). */
export function cropGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (i < 2 && j > 6) continue; // barn corner
      parts.push(box(0.1, 0.16, 0.08, -1.2 + j * 0.3, 0.08, -1.2 + i * 0.3));
    }
  }
  return merge(parts);
}

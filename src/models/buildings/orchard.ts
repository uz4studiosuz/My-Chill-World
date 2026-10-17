import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export type OrchardLook = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Fruit orchard (2×2): four trees and a crate. Its look follows the seasons: pink blossom in spring, green leaves
 * and red apples in summer, orange leaves in autumn, bare branches with a little snow in winter.
 */
export function orchardGeometry(look: OrchardLook = 'summer'): THREE.BufferGeometry {
  const ground = look === 'winter' ? '#c9cfc6' : look === 'autumn' ? '#9aa451' : '#86ad4e';
  const parts = [box(1.9, 0.02, 1.9, 0, 0.01, 0, ground)];
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.45], [0.5, 0.45]]) {
    parts.push(box(0.1, 0.35, 0.1, x, 0.175, z, '#6b4a2e'));
    if (look === 'winter') {
      // bare branches reaching up and out, snow resting on them
      for (const [bx, bz, h] of [[0.14, 0, 0.3], [-0.14, 0.04, 0.26], [0.02, 0.15, 0.28], [-0.02, -0.15, 0.24]]) {
        parts.push(box(0.035, h, 0.035, x + bx * 0.6, 0.35 + h / 2, z + bz * 0.6, '#5c3f27'));
        parts.push(box(0.05, 0.02, 0.05, x + bx * 0.6, 0.36 + h, z + bz * 0.6, '#f4f6f8'));
      }
      parts.push(box(0.4, 0.015, 0.4, x, 0.025, z, '#f4f6f8'));
      continue;
    }
    const [leaf, top] = look === 'spring' ? ['#f2a7c8', '#f7c6dc'] : look === 'autumn' ? ['#d9892b', '#e8b53a'] : ['#4f8a3a', '#5f9a3e'];
    parts.push(box(0.55, 0.4, 0.55, x, 0.55, z, leaf), box(0.36, 0.2, 0.36, x, 0.82, z, top));
    if (look === 'spring') for (const [fx, fy, fz] of [[0.26, 0.6, 0.1], [-0.12, 0.7, 0.27], [-0.27, 0.5, -0.1], [0.12, 0.88, -0.1], [0.05, 0.45, -0.27]]) parts.push(box(0.05, 0.05, 0.05, x + fx, fy, z + fz, '#ffffff'));
    else for (const [fx, fz] of (look === 'autumn' ? [[0.28, 0.1], [-0.28, -0.12]] : [[0.28, 0.1], [-0.1, 0.28], [-0.28, -0.12], [0.1, -0.28]])) parts.push(box(0.06, 0.06, 0.06, x + fx, 0.5, z + fz, '#d9443b'));
    if (look === 'autumn') parts.push(box(0.5, 0.012, 0.5, x, 0.022, z, '#c9762a'));
  }
  parts.push(box(0.16, 0.1, 0.12, 0, 0.05, 0, '#b08a5a'));
  if (look === 'summer' || look === 'autumn') parts.push(box(0.12, 0.03, 0.08, 0, 0.11, 0, '#d9443b'));
  return merge(parts);
}

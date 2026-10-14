import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** Field base; the crops are a separate mesh so they can grow. */
export function farmGeometry(): THREE.BufferGeometry {
  const parts = [box(2.9, 0.03, 2.9, 0, 0.015, 0, '#7a5a3c')];
  for (let i = 0; i < 9; i++) parts.push(box(2.7, 0.02, 0.12, 0, 0.035, -1.2 + i * 0.3, '#5f4430'));
  parts.push(
    box(0.5, 0.4, 0.4, 1.1, 0.2, -1.1, '#b0402f'),
    box(0.56, 0.12, 0.46, 1.1, 0.46, -1.1, '#6d4c3d'),
    box(0.16, 0.22, 0.02, 1.1, 0.11, -0.895, '#f2ede2'),
  );
  for (const [x, z, w, d] of [[0, -1.45, 2.9, 0.03], [0, 1.45, 2.9, 0.03], [-1.45, 0, 0.03, 2.9], [1.45, 0, 0.03, 2.9]]) {
    parts.push(box(w, 0.06, d, x, 0.08, z, '#9c7a52'));
  }
  return merge(parts);
}

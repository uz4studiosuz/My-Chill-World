import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function orchardGeometry(): THREE.BufferGeometry {
  const parts = [box(1.9, 0.02, 1.9, 0, 0.01, 0, '#86ad4e')];
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.45], [0.5, 0.45]]) {
    parts.push(box(0.1, 0.35, 0.1, x, 0.175, z, '#6b4a2e'), box(0.55, 0.4, 0.55, x, 0.55, z, '#4f8a3a'), box(0.36, 0.2, 0.36, x, 0.82, z, '#5f9a3e'));
    for (const [fx, fz] of [[0.28, 0.1], [-0.1, 0.28], [-0.28, -0.12], [0.1, -0.28]]) parts.push(box(0.06, 0.06, 0.06, x + fx, 0.5, z + fz, '#d9443b'));
  }
  parts.push(box(0.16, 0.1, 0.12, 0, 0.05, 0, '#b08a5a'), box(0.12, 0.03, 0.08, 0, 0.11, 0, '#d9443b'));
  return merge(parts);
}

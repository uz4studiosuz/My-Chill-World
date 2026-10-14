import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function bankGeometry(): THREE.BufferGeometry {
  const stone = '#e8e4da', gold = '#d4af37';
  const parts = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#bdb7aa'),
    box(0.8, 0.5, 0.56, 0, 0.27, -0.1, stone),
    box(0.9, 0.08, 0.66, 0, 0.56, -0.1, '#6d6a62'),
    box(0.7, 0.08, 0.5, 0, 0.64, -0.1, '#6d6a62'),
    box(0.12, 0.12, 0.02, 0, 0.5, 0.2, gold),
    box(0.2, 0.28, 0.02, 0, 0.16, 0.19, '#5c3a21'),
  ];
  for (const x of [-0.3, -0.1, 0.1, 0.3]) parts.push(box(0.07, 0.44, 0.07, x, 0.24, 0.26, '#f4f1ea'));
  parts.push(box(0.84, 0.05, 0.12, 0, 0.5, 0.26, stone));
  return merge(parts);
}

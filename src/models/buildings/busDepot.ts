import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function busDepotGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#8d8f93'),
    box(1.6, 0.5, 0.8, 0, 0.26, -0.5, '#dfe3e8'),
    box(1.7, 0.06, 0.9, 0, 0.54, -0.5, '#3a6fd1'),
    box(1.5, 0.04, 0.6, 0, 0.5, 0.35, '#3a6fd1'),
    box(0.04, 0.48, 0.04, -0.7, 0.24, 0.6, '#cfd6dc'),
    box(0.04, 0.48, 0.04, 0.7, 0.24, 0.6, '#cfd6dc'),
  ];
  for (const x of [-0.45, 0.45]) parts.push(box(0.26, 0.2, 0.7, x, 0.12, 0.25, '#f1c232'), box(0.24, 0.07, 0.6, x, 0.18, 0.25, '#a8d0e6'));
  return merge(parts);
}

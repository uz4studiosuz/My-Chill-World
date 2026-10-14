import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function gasStationGeometry(): THREE.BufferGeometry {
  const parts = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#8d8f93'),
    box(0.9, 0.05, 0.5, 0, 0.5, 0.2, '#d9443b'),
    box(0.9, 0.03, 0.5, 0, 0.46, 0.2, '#f2f4f6'),
    box(0.05, 0.46, 0.05, -0.38, 0.23, 0.0, '#cfd6dc'),
    box(0.05, 0.46, 0.05, 0.38, 0.23, 0.0, '#cfd6dc'),
    box(0.1, 0.22, 0.08, -0.15, 0.13, 0.2, '#3a6fd1'),
    box(0.1, 0.22, 0.08, 0.15, 0.13, 0.2, '#4c9a52'),
    box(0.42, 0.28, 0.26, 0.0, 0.15, -0.34, '#f1e4c4'),
    box(0.46, 0.05, 0.3, 0.0, 0.31, -0.34, '#3a6fd1'),
  ];
  return merge(parts);
}

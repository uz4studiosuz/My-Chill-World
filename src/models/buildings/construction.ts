import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function constructionGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#b5a47f'),
    box(0.9, 0.34, 0.5, -0.45, 0.19, -0.5, '#e8a33a'),
    box(0.94, 0.04, 0.54, -0.45, 0.38, -0.5, '#6f7880'),
    box(0.5, 0.2, 0.3, 0.5, 0.1, 0.5, '#3a6fd1'),
    box(0.36, 0.14, 0.2, -0.5, 0.07, 0.55, '#c4553d'),
    box(0.3, 0.1, 0.18, -0.5, 0.19, 0.55, '#c4553d'),
    // crane
    box(0.1, 1.5, 0.1, 0.65, 0.75, -0.55, '#f2b33d'),
    box(1.3, 0.08, 0.1, 0.1, 1.5, -0.55, '#f2b33d'),
    box(0.04, 0.4, 0.04, -0.3, 1.28, -0.55, '#444444'),
    box(0.14, 0.1, 0.14, -0.3, 1.05, -0.55, '#d9443b'),
    box(0.24, 0.18, 0.2, 0.65, 1.6, -0.55, '#f2b33d'),
  ];
  return merge(parts);
}

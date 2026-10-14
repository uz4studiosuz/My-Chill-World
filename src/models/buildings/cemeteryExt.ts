import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function cemeteryExtGeometry(): THREE.BufferGeometry {
  const wall = '#7d7a75';
  return merge([
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#658a42'),
    box(1.9, 0.2, 0.06, 0, 0.1, -0.92, wall),
    box(1.9, 0.2, 0.06, 0, 0.1, 0.92, wall),
    box(0.06, 0.2, 1.9, -0.92, 0.1, 0, wall),
    box(0.06, 0.2, 1.9, 0.92, 0.1, 0, wall),
    box(0.24, 0.012, 1.7, 0, 0.016, 0, '#bdb7aa'),
    box(0.04, 0.16, 0.04, -0.74, 0.08, -0.74, '#4a3525'),
    box(0.2, 0.6, 0.2, -0.74, 0.42, -0.74, '#2d4a25'),
    box(0.04, 0.16, 0.04, 0.74, 0.08, 0.74, '#4a3525'),
    box(0.2, 0.6, 0.2, 0.74, 0.42, 0.74, '#2d4a25'),
  ]);
}

import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** Flour mill (2×2): a stone windmill (sails turn separately) and grain silos. */
export function millGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#c9b88a'),
    shape('cylinder', 0.6, 0.9, 0.6, -0.35, 0.45, -0.3, '#efe6d2', 'y', 12),
    shape('cone', 0.66, 0.35, 0.66, -0.35, 1.07, -0.3, '#8a5a35', 'y', 12),
    box(0.16, 0.24, 0.02, -0.35, 0.12, 0.005, '#6b4a2e'),
    box(0.1, 0.1, 0.02, -0.35, 0.5, 0.005, '#a8d0e6'),
    shape('cylinder', 0.32, 0.8, 0.32, 0.6, 0.4, -0.5, '#cfd6dc', 'y', 12),
    shape('dome', 0.32, 0.12, 0.32, 0.6, 0.86, -0.5, '#9aa3ab', 'y', 12),
    shape('cylinder', 0.32, 0.8, 0.32, 0.6, 0.4, 0.0, '#cfd6dc', 'y', 12),
    shape('dome', 0.32, 0.12, 0.32, 0.6, 0.86, 0.0, '#9aa3ab', 'y', 12),
    ...[0, 1, 2].map((i) => box(0.12, 0.1, 0.1, 0.2 + i * 0.14, 0.05, 0.65, '#f4f1ea')),
  ]);
}

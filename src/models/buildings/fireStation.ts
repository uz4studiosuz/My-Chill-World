import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function fireStationGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#9aa0a6'),
    box(0.8, 0.5, 0.6, 0, 0.26, -0.12, '#c4553d'),
    box(0.86, 0.07, 0.66, 0, 0.54, -0.12, '#6d3a2e'),
    box(0.3, 0.3, 0.02, -0.18, 0.16, 0.19, '#e8e3d6'),
    box(0.3, 0.3, 0.02, 0.18, 0.16, 0.19, '#e8e3d6'),
    box(0.16, 0.7, 0.16, 0.32, 0.6, -0.32, '#a6463a'),
    box(0.2, 0.06, 0.2, 0.32, 0.97, -0.32, '#6d3a2e'),
    box(0.1, 0.1, 0.02, 0, 0.44, 0.19, '#f2c230'),
    box(0.22, 0.1, 0.36, -0.18, 0.08, 0.36, '#d9443b'),
  ]);
}

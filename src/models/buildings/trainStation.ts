import * as THREE from 'three';
import { box, merge } from '../quality';

export function trainStationGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#bdb7aa'),
    box(1.6, 0.5, 0.7, 0, 0.25, -0.15, '#c98a5a'),
    box(1.7, 0.08, 0.8, 0, 0.54, -0.15, '#6d4c3d'),
    box(0.5, 0.35, 0.5, 0, 0.75, -0.15, '#c98a5a'),
    box(0.56, 0.08, 0.56, 0, 0.96, -0.15, '#6d4c3d'),
    box(0.2, 0.2, 0.02, 0, 0.78, 0.105, '#f2f4f6'),
    box(1.8, 0.06, 0.4, 0, 0.06, -0.72, '#9a968f'),
    box(1.7, 0.04, 0.3, 0, 0.42, -0.72, '#6d4c3d'),
    box(0.3, 0.3, 0.02, 0, 0.15, 0.205, '#5c3a21'),
  ]);
}

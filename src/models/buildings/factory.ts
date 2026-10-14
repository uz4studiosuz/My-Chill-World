import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function factoryGeometry(): THREE.BufferGeometry {
  const wall = '#9aa3ab', roof = '#6f7880', brick = '#a65e43';
  const parts = [
    box(2.9, 0.02, 2.9, 0, 0.01, 0, '#a9a69d'),
    box(1.9, 0.8, 1.3, -0.3, 0.4, -0.55, wall),
    box(2.0, 0.08, 1.4, -0.3, 0.84, -0.55, roof),
    box(1.0, 0.55, 0.9, 0.9, 0.28, 0.45, '#b7bdc3'),
    box(1.06, 0.06, 0.96, 0.9, 0.58, 0.45, roof),
    box(0.24, 1.6, 0.24, 1.05, 0.8, -0.8, brick),
    box(0.3, 0.08, 0.3, 1.05, 1.62, -0.8, '#3a3532'),
    box(0.2, 1.3, 0.2, 0.7, 0.65, -0.8, brick),
    box(0.26, 0.08, 0.26, 0.7, 1.32, -0.8, '#3a3532'),
    box(0.7, 0.45, 0.04, -0.3, 0.23, 0.12, '#4a525a'),
    box(0.5, 0.3, 0.5, -1.0, 0.15, 0.6, '#c98a3a'),
    box(0.5, 0.3, 0.5, -0.5, 0.15, 0.9, '#3a6fd1'),
  ];
  for (const x of [-0.9, -0.5, -0.1, 0.3]) parts.push(box(0.2, 0.14, 0.02, x, 0.5, -0.19, '#a8d0e6'));
  return merge(parts);
}

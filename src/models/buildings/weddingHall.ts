import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { GLASS } from './_shared';

export function weddingHallGeometry(): THREE.BufferGeometry {
  const wall = '#f6efe6', roof = '#d97a9a', gold = '#e8c25a';
  return merge([
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#e6dccb'),
    box(0.16, 0.012, 0.42, 0, 0.022, 0.25, '#c84a5a'),
    box(0.6, 0.38, 0.5, 0, 0.19, -0.12, wall),
    box(0.68, 0.06, 0.58, 0, 0.41, -0.12, roof),
    box(0.4, 0.14, 0.34, 0, 0.5, -0.12, roof),
    box(0.16, 0.22, 0.16, 0, 0.66, -0.12, wall),
    box(0.2, 0.05, 0.2, 0, 0.79, -0.12, gold),
    box(0.03, 0.12, 0.03, 0, 0.88, -0.12, gold),
    box(0.16, 0.24, 0.02, 0, 0.12, 0.135, '#8a5a3c'),
    box(0.04, 0.3, 0.04, -0.14, 0.15, 0.17, wall),
    box(0.04, 0.3, 0.04, 0.14, 0.15, 0.17, wall),
    box(0.36, 0.04, 0.12, 0, 0.31, 0.17, roof),
    box(0.1, 0.1, 0.02, -0.2, 0.25, 0.135, GLASS),
    box(0.1, 0.1, 0.02, 0.2, 0.25, 0.135, GLASS),
    box(0.12, 0.14, 0.12, -0.33, 0.07, 0.3, '#5f9a3e'),
    box(0.12, 0.14, 0.12, 0.33, 0.07, 0.3, '#5f9a3e'),
    box(0.05, 0.05, 0.05, -0.33, 0.16, 0.3, '#e07ba8'),
    box(0.05, 0.05, 0.05, 0.33, 0.16, 0.3, '#f2efe2'),
  ]);
}

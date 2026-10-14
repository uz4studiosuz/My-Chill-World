import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';
import { GLASS } from './_shared';

export function woodcutterGeometry(): THREE.BufferGeometry {
  const log = '#8a5a35', dark = '#6b4a2e';
  const parts = [
    box(0.9, 0.02, 0.9, 0, 0.01, 0, '#a08a62'),
    box(0.5, 0.32, 0.4, -0.1, 0.16, -0.15, log),
    box(0.6, 0.06, 0.5, -0.1, 0.35, -0.15, '#3d5e3a'),
    box(0.42, 0.06, 0.32, -0.1, 0.41, -0.15, '#3d5e3a'),
    box(0.12, 0.2, 0.02, -0.1, 0.1, 0.055, dark),
    box(0.08, 0.08, 0.02, 0.06, 0.2, 0.055, GLASS),
    // stump with axe
    box(0.12, 0.08, 0.12, 0.28, 0.04, 0.25, dark),
    box(0.015, 0.12, 0.015, 0.28, 0.13, 0.25, '#c9a36b'),
    box(0.05, 0.03, 0.01, 0.3, 0.18, 0.25, '#9aa3ab'),
  ];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) {
    parts.push(box(0.05, 0.05, 0.3, 0.22 + j * 0.055 + i * 0.027, 0.025 + i * 0.05, -0.15, j % 2 ? log : '#9c6a40'));
  }
  return merge(parts);
}

import * as THREE from 'three';
import { box, merge } from '../quality';
import { GLASS } from './_shared';

export function schoolGeometry(): THREE.BufferGeometry {
  const wall = '#d9714a', trim = '#f2ede2', roof = '#5b6b7a';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#c9bfa6'),
    box(1.0, 0.02, 0.7, 0.4, 0.015, 0.25, '#8cb156'),
    box(1.5, 0.6, 0.8, -0.1, 0.3, -0.45, wall),
    box(1.6, 0.08, 0.9, -0.1, 0.64, -0.45, roof),
    box(0.4, 0.5, 0.4, -0.65, 0.85, -0.45, trim),
    box(0.46, 0.08, 0.46, -0.65, 1.12, -0.45, roof),
    box(0.15, 0.15, 0.02, -0.65, 0.9, -0.24, '#f1c232'),
    box(0.34, 0.3, 0.02, -0.1, 0.15, -0.045, '#6b4a2e'),
    box(0.5, 0.05, 0.2, -0.1, 0.33, 0.0, trim),
    box(0.03, 0.75, 0.03, -0.85, 0.375, 0.2, '#cccccc'),
    box(0.2, 0.12, 0.01, -0.74, 0.68, 0.2, '#3a6fd1'),
    // playground: slide and swing
    box(0.06, 0.22, 0.06, 0.1, 0.11, 0.2, '#e8a13a'),
    box(0.08, 0.02, 0.3, 0.1, 0.14, 0.38, '#d9443b'),
    box(0.03, 0.22, 0.03, 0.45, 0.11, 0.15, '#6d4c3d'),
    box(0.03, 0.22, 0.03, 0.75, 0.11, 0.15, '#6d4c3d'),
    box(0.33, 0.03, 0.03, 0.6, 0.22, 0.15, '#6d4c3d'),
    box(0.08, 0.015, 0.05, 0.52, 0.09, 0.15, '#3a6fd1'),
    box(0.08, 0.015, 0.05, 0.68, 0.09, 0.15, '#3a6fd1'),
  ];
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    parts.push(box(0.16, 0.14, 0.02, -0.1 + i * 0.28, 0.36, -0.045, GLASS));
  }
  return merge(parts);
}

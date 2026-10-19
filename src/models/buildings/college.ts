import * as THREE from 'three';
import { box, merge } from '../quality';
import { shape } from '../../utils/voxel';
import { GLASS } from './_shared';

/**
 * College: a three-storey teaching block with bands of windows, an entrance porch with a sign, a flag, a small
 * sports court and a few trees — between the school and the university.
 */
export function collegeGeometry(): THREE.BufferGeometry {
  const wall = '#e6d9b8', band = '#3a6fd1', trim = '#f4efe3', roof = '#4f5b66';
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#c9bfa6'),
    // the teaching block
    box(1.4, 0.95, 0.7, -0.2, 0.475, -0.5, wall),
    box(1.48, 0.06, 0.78, -0.2, 0.98, -0.5, roof),
    box(0.3, 0.12, 0.3, -0.6, 1.07, -0.5, '#8a929b'),
    // a coloured band between the floors
    box(1.42, 0.04, 0.72, -0.2, 0.33, -0.5, band),
    box(1.42, 0.04, 0.72, -0.2, 0.64, -0.5, band),
    // the porch and the sign over the door
    box(0.5, 0.04, 0.3, -0.2, 0.36, -0.05, trim),
    box(0.04, 0.34, 0.04, -0.42, 0.17, 0.08, trim), box(0.04, 0.34, 0.04, 0.02, 0.17, 0.08, trim),
    box(0.28, 0.26, 0.02, -0.2, 0.13, -0.145, '#6b4a2e'),
    box(0.46, 0.1, 0.02, -0.2, 0.44, -0.13, band),
    box(0.3, 0.04, 0.01, -0.2, 0.44, -0.118, '#f2f2f2'),
    // steps
    box(0.56, 0.02, 0.12, -0.2, 0.01, 0.16, trim),
    // the flag
    box(0.03, 0.9, 0.03, 0.65, 0.45, -0.1, '#cccccc'),
    box(0.22, 0.13, 0.01, 0.765, 0.82, -0.1, '#1e9e5a'),
    box(0.22, 0.04, 0.012, 0.765, 0.79, -0.1, '#ffffff'),
    // a small sports court with a hoop
    box(0.8, 0.015, 0.62, 0.45, 0.02, 0.55, '#c8634a'),
    box(0.78, 0.004, 0.02, 0.45, 0.03, 0.55, '#f4efe3'),
    box(0.03, 0.4, 0.03, 0.82, 0.2, 0.55, '#555b63'),
    box(0.02, 0.12, 0.16, 0.8, 0.38, 0.55, '#f4efe3'),
    // trees and a bench
    shape('sphere', 0.26, 0.26, 0.26, -0.75, 0.38, 0.55, '#4f8a3a'), box(0.05, 0.25, 0.05, -0.75, 0.125, 0.55, '#6b4a2e'),
    shape('sphere', 0.22, 0.22, 0.22, -0.45, 0.33, 0.75, '#5f9a3e'), box(0.05, 0.22, 0.05, -0.45, 0.11, 0.75, '#6b4a2e'),
    box(0.26, 0.03, 0.08, -0.1, 0.07, 0.6, '#8a6a46'), box(0.26, 0.08, 0.02, -0.1, 0.11, 0.565, '#8a6a46'),
  ];
  // windows on three floors (front and sides)
  for (const y of [0.2, 0.5, 0.8]) {
    for (let i = -2; i <= 2; i++) {
      if (y < 0.3 && i === 0) continue;
      parts.push(box(0.17, 0.15, 0.02, -0.2 + i * 0.27, y, -0.145, GLASS));
    }
    for (const x of [-0.905, 0.505]) parts.push(box(0.02, 0.15, 0.4, x, y, -0.5, GLASS));
  }
  return merge(parts);
}

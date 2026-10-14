import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

export function officeGeometry(): THREE.BufferGeometry {
  const glass = '#6f9fc8', frame = '#e9edf0', dark = '#2f3d4a';
  const parts = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#bcb8ae'),
    box(1.2, 1.5, 1.0, -0.15, 0.75, -0.3, glass),
    box(0.8, 0.6, 0.7, -0.15, 1.8, -0.3, glass),
    box(1.26, 0.06, 1.06, -0.15, 1.52, -0.3, frame),
    box(0.86, 0.06, 0.76, -0.15, 2.12, -0.3, frame),
    box(0.03, 0.4, 0.03, 0.05, 2.35, -0.35, '#cccccc'),
    box(0.22, 0.12, 0.16, 0.25, 1.61, -0.05, '#9aa3ab'),
    box(0.5, 0.04, 0.26, -0.15, 0.36, 0.32, dark),
    box(0.32, 0.3, 0.02, -0.15, 0.15, 0.205, dark),
    box(0.5, 0.45, 0.6, 0.7, 0.225, -0.4, frame),
    box(0.54, 0.05, 0.64, 0.7, 0.47, -0.4, '#8f979f'),
    box(0.08, 0.25, 0.08, 0.7, 0.125, 0.55, '#6b4a2e'),
    box(0.3, 0.3, 0.3, 0.7, 0.4, 0.55, '#5f9a3e'),
    box(0.08, 0.25, 0.08, -0.75, 0.125, 0.6, '#6b4a2e'),
    box(0.3, 0.3, 0.3, -0.75, 0.4, 0.6, '#6faa45'),
  ];
  for (let i = 0; i < 6; i++) parts.push(box(1.24, 0.035, 1.04, -0.15, 0.22 + i * 0.25, -0.3, frame));
  for (let i = 0; i < 2; i++) parts.push(box(0.84, 0.035, 0.74, -0.15, 1.72 + i * 0.2, -0.3, frame));
  for (const x of [-0.7, 0.4]) parts.push(box(0.04, 1.5, 1.04, x, 0.75, -0.3, frame));
  return merge(parts);
}


import * as THREE from 'three';
import { box, merge, shape } from '../quality';

/**
 * Migration company: a bright two-storey office with a glass front, a globe on the roof, a flag and a queue rail
 * with benches where newcomers wait to register.
 */
export function migrationOfficeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#c9c2b4'),
    box(1.5, 0.52, 0.95, 0, 0.26, -0.35, '#e9e2d2'),
    box(1.56, 0.05, 1.01, 0, 0.545, -0.35, '#3f6fb5'),
    // glass front, two floors
    box(1.2, 0.18, 0.02, 0, 0.14, 0.135, '#8fc1e3'),
    box(1.2, 0.16, 0.02, 0, 0.39, 0.135, '#8fc1e3'),
    box(1.5, 0.03, 0.04, 0, 0.27, 0.14, '#3f6fb5'),
    // entrance and canopy
    box(0.3, 0.2, 0.025, 0, 0.1, 0.15, '#2a3b55'),
    box(0.55, 0.025, 0.24, 0, 0.23, 0.25, '#f2b33d'),
    // globe on the roof
    box(0.05, 0.14, 0.05, 0.45, 0.64, -0.35, '#5d6670'),
    shape('sphere', 0.3, 0.3, 0.3, 0.45, 0.85, -0.35, '#3f86c4', 'y', 14),
    shape('torus', 0.36, 0.36, 0.03, 0.45, 0.85, -0.35, '#f2b33d', 'y', 18),
    // flag
    box(0.02, 0.5, 0.02, -0.6, 0.82, -0.35, '#9aa3ab'),
    box(0.2, 0.12, 0.01, -0.5, 1.0, -0.35, '#4f9a3e'),
  ];
  // queue rail with benches in front
  for (const x of [-0.65, -0.25, 0.25, 0.65]) parts.push(box(0.02, 0.1, 0.02, x, 0.05, 0.62, '#8e969e'));
  parts.push(box(1.32, 0.015, 0.015, 0, 0.1, 0.62, '#8e969e'));
  for (const x of [-0.5, 0.5]) parts.push(box(0.36, 0.03, 0.1, x, 0.06, 0.8, '#8a5a35'), box(0.36, 0.08, 0.02, x, 0.1, 0.85, '#8a5a35'));
  return merge(parts);
}

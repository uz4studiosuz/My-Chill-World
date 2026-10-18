import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { GOLD, tree } from './_shared';

/** Mosque: courtyard, prayer hall with a blue dome, arched portal and a minaret. */
export function mosqueGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#d8cfbd'),
    box(1.2, 0.5, 1.0, -0.1, 0.25, -0.4, '#efe6d2'),
    box(1.26, 0.05, 1.06, -0.1, 0.52, -0.4, '#c9b48a'),
    shape('cylinder', 0.6, 0.14, 0.6, -0.1, 0.61, -0.4, '#efe6d2', 'y', 18),
    shape('dome', 0.62, 0.42, 0.62, -0.1, 0.68, -0.4, '#2f7fc1', 'y', 20),
    shape('cone', 0.06, 0.16, 0.06, -0.1, 1.17, -0.4, GOLD, 'y', 8),
    // portal (pishtaq) with a pointed arch
    box(0.62, 0.72, 0.16, -0.1, 0.36, 0.14, '#e6dcc4'),
    box(0.34, 0.42, 0.02, -0.1, 0.21, 0.225, '#2f7fc1'),
    box(0.22, 0.32, 0.025, -0.1, 0.17, 0.23, '#6b4a2e'),
    box(0.66, 0.05, 0.2, -0.1, 0.745, 0.14, '#2f7fc1'),
    ...[-0.36, 0.16].map((x) => box(0.05, 0.6, 0.18, x, 0.3, 0.14, '#3f9ad6')),
    // minaret
    shape('cylinder', 0.18, 1.5, 0.18, 0.72, 0.75, -0.62, '#e6dcc4', 'y', 12),
    shape('cylinder', 0.26, 0.06, 0.26, 0.72, 1.32, -0.62, '#2f7fc1', 'y', 12),
    shape('cylinder', 0.15, 0.22, 0.15, 0.72, 1.46, -0.62, '#efe6d2', 'y', 12),
    shape('cone', 0.2, 0.26, 0.2, 0.72, 1.7, -0.62, '#2f7fc1', 'y', 12),
    ...[0.3, 0.6, 0.9].map((y) => shape('cylinder', 0.19, 0.03, 0.19, 0.72, y, -0.62, '#3f9ad6', 'y', 12)),
    // courtyard: a fountain for ablutions and two trees
    shape('cylinder', 0.3, 0.06, 0.3, 0.55, 0.05, 0.45, '#cfc6b1', 'y', 14),
    shape('cylinder', 0.24, 0.02, 0.24, 0.55, 0.08, 0.45, '#5fb2e0', 'y', 14),
    ...tree(-0.75, 0.6, 0.45), ...tree(-0.55, 0.78, 0.38),
    // windows along the hall
    ...[-0.5, -0.3, 0.1, 0.3].map((x) => box(0.08, 0.16, 0.02, x, 0.3, 0.105, '#2f7fc1')),
  ];
  return merge(parts);
}

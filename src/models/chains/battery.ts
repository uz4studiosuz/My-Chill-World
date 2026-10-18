import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { PAVE } from './_shared';

/** Battery storage (1×1): two ribbed battery containers with cooling fans, a transformer, cables and a fence. */
export function batteryGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE), box(0.9, 0.01, 0.9, 0, 0.022, 0, '#9d9d9a')];
  for (const z of [-0.2, 0.18]) {
    parts.push(
      box(0.74, 0.04, 0.3, -0.04, 0.04, z, '#7d828a'),
      box(0.72, 0.28, 0.28, -0.04, 0.2, z, '#e9edf0'),
      box(0.74, 0.03, 0.3, -0.04, 0.355, z, '#3a6fd1'),
      // ribs, doors with handles and the status lights
      ...[-0.3, -0.12, 0.06, 0.24].map((x) => box(0.012, 0.26, 0.29, x, 0.2, z, '#cfd6dc')),
      ...[-0.21, 0.15].flatMap((x) => [box(0.16, 0.22, 0.012, x, 0.18, z + 0.145, '#dfe5ea'), box(0.012, 0.05, 0.016, x + 0.06, 0.18, z + 0.15, '#5d6670')]),
      box(0.04, 0.03, 0.012, -0.36, 0.3, z + 0.146, '#7be08f'), box(0.04, 0.03, 0.012, -0.31, 0.3, z + 0.146, '#7be08f'),
      ...[-0.25, 0.03].map((x) => shape('cylinder', 0.12, 0.03, 0.12, x, 0.385, z, '#5d6670', 'y', 12)),
      ...[-0.25, 0.03].map((x) => box(0.1, 0.006, 0.012, x, 0.402, z, '#2a3038')),
    );
  }
  parts.push(
    // the transformer with its cooling fins and insulators, and the cable trench
    box(0.14, 0.2, 0.18, 0.4, 0.12, -0.02, '#8a8f98'),
    ...[-0.08, -0.02, 0.04].map((z) => box(0.02, 0.16, 0.012, 0.48, 0.12, z, '#6d737b')),
    ...[-0.06, 0.02].map((z) => shape('cylinder', 0.025, 0.08, 0.025, 0.4, 0.26, z, '#c9a26b', 'y', 8)),
    box(0.06, 0.012, 0.5, 0.33, 0.03, -0.02, '#5d6670'),
    // a fence around the yard and a warning sign
    ...[-0.47, 0.47].map((x) => box(0.012, 0.12, 0.94, x, 0.07, 0, '#9aa3ab')),
    box(0.94, 0.12, 0.012, 0, 0.07, -0.47, '#9aa3ab'), box(0.6, 0.12, 0.012, -0.17, 0.07, 0.47, '#9aa3ab'),
    box(0.06, 0.06, 0.012, 0.0, 0.11, 0.48, '#f2c230'),
  );
  return merge(parts);
}

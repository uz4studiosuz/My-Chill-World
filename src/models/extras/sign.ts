import * as THREE from 'three';
import { box, merge } from '../quality';
import { GRASS, WOOD, METAL } from './_shared';

/** Road signs with a flower box. */
export function signGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.03, 0.42, 0.03, 0.3, 0.21, 0.35, METAL),
    box(0.18, 0.18, 0.02, 0.3, 0.46, 0.36, '#3a6fd1'),
    box(0.1, 0.03, 0.022, 0.3, 0.46, 0.362, '#ffffff'),
    box(0.03, 0.42, 0.03, -0.3, 0.21, 0.35, METAL),
    box(0.16, 0.16, 0.02, -0.3, 0.46, 0.36, '#d9443b'),
    box(0.1, 0.03, 0.022, -0.3, 0.46, 0.362, '#ffffff'),
    box(0.5, 0.08, 0.16, 0, 0.04, -0.25, WOOD),
    ...[-0.18, -0.06, 0.06, 0.18].map((x, i) => box(0.06, 0.06, 0.06, x, 0.1, -0.25, ['#e85a7a', '#f2c230', '#f2efe2', '#b0478f'][i])),
  ]);
}

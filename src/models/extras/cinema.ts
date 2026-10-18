import * as THREE from 'three';
import { box, merge } from '../quality';
import { PAVING, METAL } from './_shared';

/** Open-air cinema (2×2): a big screen, rows of benches and a ticket booth. */
export function cinemaGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#6d6a62'),
    box(1.94, 0.022, 0.4, 0, 0.012, 0.78, PAVING),
    // screen frame (the glowing picture is a separate mesh)
    box(1.5, 0.06, 0.06, 0, 1.0, -0.82, '#26292e'),
    box(1.5, 0.06, 0.06, 0, 0.18, -0.82, '#26292e'),
    box(0.06, 0.88, 0.06, -0.74, 0.59, -0.82, '#26292e'), box(0.06, 0.88, 0.06, 0.74, 0.59, -0.82, '#26292e'),
    box(1.44, 0.78, 0.02, 0, 0.59, -0.84, '#3d4148'),
    // benches
    ...[-0.25, 0.05, 0.35].flatMap((z) => [-0.45, 0.45].flatMap((x) => [
      box(0.6, 0.04, 0.12, x, 0.08, z, '#b0478f'),
      box(0.6, 0.1, 0.03, x, 0.13, z + 0.06, '#8a2f6a'),
      box(0.03, 0.08, 0.1, x - 0.28, 0.04, z, METAL), box(0.03, 0.08, 0.1, x + 0.28, 0.04, z, METAL),
    ])),
    // ticket booth
    box(0.26, 0.28, 0.22, 0.75, 0.14, 0.75, '#f2c230'),
    box(0.3, 0.04, 0.26, 0.75, 0.3, 0.75, '#d9443b'),
    box(0.1, 0.08, 0.02, 0.75, 0.18, 0.865, '#a8d0e6'),
    // projector
    box(0.12, 0.2, 0.12, 0, 0.1, 0.62, '#3d4148'),
    box(0.1, 0.07, 0.14, 0, 0.24, 0.6, '#26292e'),
    box(0.025, 0.5, 0.025, -0.92, 0.25, 0.6, METAL), box(0.025, 0.5, 0.025, 0.92, 0.25, 0.6, METAL),
  ];
  return merge(parts);
}

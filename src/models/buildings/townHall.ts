import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { GLASS } from './_shared';

/**
 * Town hall: a stone podium with steps, a columned portico, two wings, a blue dome with a clock tower,
 * flags on the roof and a flag pole on the square. The front row (z ≈ 0.68) stays free for parked cars.
 */
export function townHallGeometry(): THREE.BufferGeometry {
  const wall = '#eee6d4', roof = '#3567c4', trim = '#d8cdb5', stone = '#c9c1ae';
  const parts: THREE.BufferGeometry[] = [
    // square and podium with steps
    box(1.94, 0.02, 0.6, 0, 0.01, 0.66, '#9d9d9a'),
    box(1.7, 0.06, 1.2, 0, 0.03, -0.18, stone),
    ...[0, 1, 2].map((i) => box(0.7 - i * 0.04, 0.03, 0.08, 0, 0.015 + i * 0.03, 0.47 - i * 0.07, stone)),
    // main hall and wings
    box(0.9, 0.78, 0.86, 0, 0.45, -0.22, wall),
    ...[-0.62, 0.62].flatMap((x) => [box(0.38, 0.58, 0.8, x, 0.35, -0.22, wall), box(0.42, 0.05, 0.84, x, 0.665, -0.22, roof), box(0.38, 0.04, 0.8, x, 0.06, -0.22, trim)]),
    box(0.96, 0.06, 0.92, 0, 0.87, -0.22, roof),
    // portico: columns, beam and a triangular pediment
    ...[-0.36, -0.18, 0, 0.18, 0.36].map((x) => shape('cylinder', 0.06, 0.62, 0.06, x, 0.37, 0.27, '#f6f1e6', 'y', 10)),
    box(0.9, 0.06, 0.16, 0, 0.71, 0.26, trim),
    shape('pyramid', 0.94, 0.16, 0.2, 0, 0.82, 0.26, trim),
    box(0.22, 0.32, 0.02, 0, 0.22, 0.205, '#5a7f9c'),
    // dome on a drum, clock tower and spire
    shape('cylinder', 0.5, 0.16, 0.5, 0, 0.98, -0.22, wall, 'y', 20),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2; return box(0.05, 0.1, 0.02, Math.cos(a) * 0.25, 0.98, -0.22 + Math.sin(a) * 0.25, GLASS); }),
    shape('dome', 0.52, 0.3, 0.52, 0, 1.06, -0.22, roof, 'y', 20),
    box(0.22, 0.26, 0.22, 0, 1.44, -0.22, wall),
    ...[[0, 0.115], [0, -0.115]].map(([dx, dz]) => shape('cylinder', 0.14, 0.14, 0.012, dx, 1.46, -0.22 + dz, '#ffffff', 'z', 18)),
    ...[[0, 0.123], [0, -0.123]].map(([dx, dz]) => box(0.012, 0.06, 0.006, dx, 1.48, -0.22 + dz, '#26292e')),
    box(0.26, 0.04, 0.26, 0, 1.59, -0.22, roof),
    shape('cone', 0.16, 0.24, 0.16, 0, 1.73, -0.22, roof, 'y', 8),
    shape('sphere', 0.05, 0.05, 0.05, 0, 1.87, -0.22, '#e3bf4f', 'y', 8),
    // flags on the wings and a pole on the square
    ...[-0.62, 0.62].flatMap((x) => [box(0.015, 0.22, 0.015, x, 0.8, -0.22, '#cccccc'), box(0.12, 0.07, 0.008, x + 0.065, 0.87, -0.22, x < 0 ? '#2f7fc1' : '#4f8a3a')]),
    box(0.03, 0.7, 0.03, 0.78, 0.35, 0.56, '#cccccc'),
    box(0.22, 0.13, 0.01, 0.9, 0.62, 0.56, '#2f7fc1'), box(0.22, 0.04, 0.012, 0.9, 0.62, 0.56, '#f4f4f2'),
    // flowers and shrubs by the steps
    ...[-0.62, 0.62].flatMap((x) => [box(0.32, 0.05, 0.16, x, 0.085, 0.3, '#6b4a2e'), shape('sphere', 0.28, 0.1, 0.12, x, 0.13, 0.3, '#5f9a3e', 'y', 8), box(0.04, 0.04, 0.04, x - 0.06, 0.18, 0.32, '#e85a7a'), box(0.04, 0.04, 0.04, x + 0.07, 0.18, 0.31, '#f2c230')]),
  ];
  // rows of windows on the main hall and the wings
  for (let row = 0; row < 2; row++) {
    for (const x of [-0.3, 0.3]) parts.push(box(0.12, 0.16, 0.02, x, 0.32 + row * 0.26, 0.195, GLASS));
    for (const x of [-0.72, -0.52, 0.52, 0.72]) parts.push(box(0.1, 0.14, 0.02, x, 0.24 + row * 0.22, 0.185, GLASS));
  }
  return merge(parts);
}

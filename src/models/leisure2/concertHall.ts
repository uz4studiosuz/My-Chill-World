import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';

/** Concert hall: a curved hall with a glass foyer, a stage roof, posters and lamps on the square in front. */
export function concertHallGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#cfc6b1'),
    // the hall: a wide body with a curved roof
    box(1.5, 0.55, 1.0, 0, 0.275, -0.38, '#e9e2d0'),
    shape('arch', 1.56, 0.28, 1.06, 0, 0.73, -0.38, '#8a3a4a'),
    box(1.56, 0.04, 1.06, 0, 0.57, -0.38, '#6b2a38'),
    // glass foyer and doors
    box(1.1, 0.34, 0.24, 0, 0.17, 0.24, '#8fc1e3'),
    box(1.16, 0.04, 0.3, 0, 0.36, 0.24, '#6b2a38'),
    ...[-0.4, -0.13, 0.13, 0.4].map((x) => box(0.025, 0.34, 0.25, x, 0.17, 0.24, '#f4f1ea')),
    box(0.3, 0.2, 0.02, 0, 0.1, 0.365, '#3d2a1e'),
    // name board with lights
    box(0.8, 0.12, 0.03, 0, 0.48, 0.13, '#26292e'),
    ...[-0.3, -0.15, 0, 0.15, 0.3].map((x) => box(0.08, 0.05, 0.035, x, 0.48, 0.135, '#ffd166')),
    // columns at the corners
    ...[-0.72, 0.72].map((x) => shape('cylinder', 0.08, 0.55, 0.08, x, 0.275, 0.12, '#f4f1ea', 'y', 10)),
    // poster stands and lamps on the square
    ...[-0.7, 0.7].flatMap((x) => [box(0.04, 0.3, 0.2, x, 0.15, 0.7, '#3d4148'), box(0.045, 0.22, 0.16, x, 0.19, 0.7, x < 0 ? '#e85a7a' : '#6fb6ff')]),
    ...[-0.35, 0.35].flatMap((x) => [shape('cylinder', 0.025, 0.4, 0.025, x, 0.2, 0.75, '#3d4148', 'y', 6), shape('sphere', 0.07, 0.07, 0.07, x, 0.42, 0.75, '#fff3b0', 'y', 8)]),
  ]);
}

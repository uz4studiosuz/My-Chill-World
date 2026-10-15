import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { door, parapet, windows } from '../details';

/** A hyperbolic cooling tower: a waisted shell with a rim, stairs up the side and the dark opening at its foot. */
function coolingTower(x: number, z: number, r: number, h: number): THREE.BufferGeometry[] {
  return [
    shape('cone', r * 2, h, r * 2, x, h / 2, z, '#cfd6dc', 'y', 20),
    shape('cylinder', r * 1.28, h * 0.25, r * 1.28, x, h * 0.9, z, '#cfd6dc', 'y', 20),
    shape('cylinder', r * 1.34, 0.03, r * 1.34, x, h * 1.02, z, '#b8c0c8', 'y', 20),
    shape('cylinder', r * 2.04, 0.06, r * 2.04, x, 0.03, z, '#8a8f98', 'y', 20),
    ...[0.2, 0.45, 0.7].map((k) => shape('cylinder', r * (2 - k * 1.1) + 0.01, 0.012, r * (2 - k * 1.1) + 0.01, x, h * k, z, '#b8c0c8', 'y', 20)),
  ];
}

/** Coal power plant: the boiler hall with a chimney, two cooling towers, a coal yard with a conveyor, a switchyard. */
export function coalplantGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#8c8f94'),
    // boiler and turbine hall
    box(0.9, 0.5, 0.7, -0.45, 0.25, 0.3, '#9aa3ab'), box(0.92, 0.04, 0.72, -0.45, 0.02, 0.3, '#6d737b'),
    box(0.96, 0.05, 0.76, -0.45, 0.525, 0.3, '#5d6670'), box(0.9, 0.012, 0.7, -0.45, 0.556, 0.3, '#7d828a'),
    ...parapet(-0.45, 0.3, 0.96, 0.76, 0.55, '#5d6670'),
    box(0.4, 0.2, 0.4, -0.55, 0.65, 0.35, '#8a9098'),
    ...windows('front', -0.45, 0.3, 0.45, 0.35, 0.36, 5, { w: 0.12, h: 0.1, frame: '#cfd6dc' }),
    ...windows('left', -0.45, 0.3, 0.45, 0.35, 0.36, 3, { w: 0.12, h: 0.1, frame: '#cfd6dc' }),
    ...door(-0.2, 0.655, 0.12, 0.22, '#3a3f46'),
    // the chimney with red and white bands
    shape('cylinder', 0.12, 1.1, 0.12, -0.75, 0.55, 0.0, '#c4553d', 'y', 10),
    ...[0.75, 0.95].map((y) => shape('cylinder', 0.125, 0.06, 0.125, -0.75, y, 0.0, '#f2f4f6', 'y', 10)),
    shape('cylinder', 0.15, 0.04, 0.15, -0.75, 1.1, 0.0, '#3a3532', 'y', 10),
    // cooling towers
    ...coolingTower(0.45, -0.45, 0.375, 1.0), ...coolingTower(0.55, 0.45, 0.3, 0.8),
    // a pipe bridge from the hall to the towers
    cylX(0.04, 0.6, 0.0, 0.3, 0.0, '#8a8f98', 8),
    // the coal yard: a heap and a conveyor up to the hall
    shape('cone', 0.4, 0.15, 0.4, -0.2, 0.08, -0.6, '#26292e', 'y', 8), shape('cone', 0.3, 0.12, 0.3, -0.45, 0.06, -0.72, '#2e3136', 'y', 8),
    box(0.06, 0.03, 0.62, -0.3, 0.3, -0.25, '#5d6670'), box(0.02, 0.28, 0.02, -0.3, 0.14, -0.5, '#5d6670'),
    // the switchyard: pylons and wires
    ...[-0.85, -0.65].flatMap((x) => [box(0.025, 0.4, 0.025, x, 0.2, -0.85, '#9aa3ab'), box(0.16, 0.012, 0.012, x, 0.38, -0.85, '#9aa3ab')]),
    box(0.2, 0.006, 0.006, -0.75, 0.37, -0.85, '#3a3f46'),
  ]);
}

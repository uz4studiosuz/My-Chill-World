import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { door, lamp, parapet, roofKit, shopFront, sign } from '../details';

/** A small car (along x): body, cabin with windows, lights and wheels. */
function car(x: number, z: number, color: string): THREE.BufferGeometry[] {
  return [
    box(0.38, 0.08, 0.2, x, 0.07, z, color),
    box(0.22, 0.07, 0.18, x - 0.02, 0.145, z, color),
    box(0.225, 0.05, 0.185, x - 0.02, 0.15, z, '#6f9fc8'),
    box(0.012, 0.025, 0.05, x + 0.19, 0.075, z - 0.06, '#fff6d6'), box(0.012, 0.025, 0.05, x + 0.19, 0.075, z + 0.06, '#fff6d6'),
    ...[-0.12, 0.12].flatMap((dx) => [-0.1, 0.1].map((dz) => shape('cylinder', 0.07, 0.03, 0.07, x + dx, 0.035, z + dz, '#1d2127', 'z', 12))),
  ];
}

/** Car market: a glass showroom with a car inside, a sign pylon with flags and rows of cars for sale with price tags. */
export function carMarketGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#8d8f93'),
    box(1.5, 0.55, 0.8, 0, 0.28, -0.6, '#f2f4f6'),
    box(1.52, 0.04, 0.82, 0, 0.02, -0.6, '#7d828a'),
    box(1.56, 0.06, 0.86, 0, 0.58, -0.6, '#3a6fd1'),
    box(1.5, 0.012, 0.8, 0, 0.616, -0.6, '#8a8f98'),
    ...parapet(0, -0.6, 1.56, 0.86, 0.61, '#2d5aa8'),
    ...roofKit(0.2, -0.65, 0.9, 0.5, 0.61, 21),
    // the showroom: a tall glass front with a car on show
    ...shopFront(-0.15, 0.05, -0.195, 1.0, 0.42),
    ...door(0.55, -0.195, 0.16, 0.3, '#26292e', { glass: true }),
    ...sign(-0.15, 0.53, -0.18, 0.8, 0.05, '#3a6fd1', '#ffffff'),
    ...car(-0.3, -0.45, '#f2f2ee'),
    // the pylon with flags at the road
    box(0.05, 0.6, 0.05, 0.8, 0.3, 0.75, '#cccccc'), box(0.36, 0.2, 0.03, 0.8, 0.62, 0.75, '#d9443b'),
    ...[0.66, 0.6].map((y) => box(0.28, 0.03, 0.01, 0.8, y, 0.767, '#ffffff')),
    ...[-0.9, -0.3, 0.3].flatMap((x) => [box(0.012, 0.36, 0.012, x, 0.18, 0.9, '#cccccc'), box(0.1, 0.06, 0.006, x + 0.05, 0.33, 0.9, ['#d9443b', '#3a6fd1', '#f2c230'][Math.round((x + 0.9) / 0.6)])]),
    // bays and the lights of the lot
    ...[-0.95, -0.35, 0.25].flatMap((x) => [0.15, 0.7].map((z) => box(0.012, 0.006, 0.32, x, 0.022, z, '#f4f4f2'))),
    ...lamp(-0.9, 0.45, 0.45), ...lamp(0.9, 0.2, 0.45),
  ];
  const cols = ['#d9443b', '#3a6fd1', '#f1c232', '#4c9a52', '#f2f2ee', '#e07b2e'];
  cols.forEach((c, i) => {
    const x = -0.65 + (i % 3) * 0.6, z = 0.15 + Math.floor(i / 3) * 0.55;
    parts.push(...car(x, z, c), box(0.06, 0.04, 0.006, x + 0.05, 0.155, z + 0.096, '#ffffff'));
  });
  return merge(parts);
}

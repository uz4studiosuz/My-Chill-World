import * as THREE from 'three';
import { box, cylX, merge } from '../../utils/voxel';
import { PAVE } from './_shared';
import { bench, bin, door, parapet, planter, roofKit, shopFront, sign, windows } from '../details';

/** Gym: a dark two-storey hall with a glass front, a coral fascia with its name, a dumbbell sign and a bike rack. */
export function gymGeometry(): THREE.BufferGeometry {
  const wall = '#3a4350', band = '#f07167';
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    // the hall: dark walls, a lighter plinth and a coral band between the floors
    box(0.8, 0.52, 0.6, 0, 0.26, -0.12, wall),
    box(0.82, 0.04, 0.62, 0, 0.02, -0.12, '#2a3038'),
    box(0.82, 0.05, 0.62, 0, 0.32, -0.12, band),
    box(0.84, 0.03, 0.64, 0, 0.535, -0.12, '#2a3038'),
    ...parapet(0, -0.12, 0.84, 0.64, 0.55, '#2a3038'),
    ...roofKit(0.05, -0.15, 0.7, 0.5, 0.55, 3),
    // ground floor all glass, upper floor framed windows
    ...shopFront(-0.08, 0.05, 0.185, 0.5, 0.22, '#1d2127'),
    ...door(0.27, 0.19, 0.13, 0.24, '#1d2127', { glass: true, canopy: band, lamp: true }),
    ...windows('front', 0, -0.12, 0.4, 0.3, 0.43, 4, { w: 0.12, h: 0.11, frame: '#c9ccd0' }),
    ...windows('left', 0, -0.12, 0.4, 0.3, 0.43, 3, { w: 0.1, h: 0.11, frame: '#c9ccd0' }),
    ...windows('right', 0, -0.12, 0.4, 0.3, 0.43, 3, { w: 0.1, h: 0.11, frame: '#c9ccd0' }),
    ...sign(-0.12, 0.32, 0.195, 0.36, 0.04, band, '#ffffff'),
    // the dumbbell on the roof edge
    cylX(0.02, 0.3, 0, 0.62, 0.12, '#cfd6dc', 6), cylX(0.06, 0.04, -0.15, 0.62, 0.12, '#26292e', 10), cylX(0.06, 0.04, 0.15, 0.62, 0.12, '#26292e', 10),
    // bike rack, bench, bin and planters along the pavement
    ...[-0.36, -0.28, -0.2].map((x) => box(0.012, 0.06, 0.07, x, 0.05, 0.36, '#9aa3ab')), box(0.2, 0.012, 0.012, -0.28, 0.08, 0.36, '#9aa3ab'),
    ...bench(0.05, 0.4), ...bin(0.4, 0.4), ...planter(-0.42, 0.24), ...planter(0.42, 0.24),
  ]);
}

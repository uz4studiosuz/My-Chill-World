import * as THREE from 'three';
import { box, merge } from '../quality';
import { PAVE } from './_shared';
import { bench, door, parapet, planter, roofKit, shopFront, sign, windows } from '../details';

/** Pharmacy: a clean white shop with a green awning, a glowing green cross on a bracket and a flat above. */
export function pharmacyGeometry(): THREE.BufferGeometry {
  const green = '#2e8b57', cross = '#4fd68a';
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.7, 0.62, 0.55, 0, 0.31, -0.12, '#f4f4f2'),
    box(0.72, 0.04, 0.57, 0, 0.02, -0.12, '#8d8a83'),
    box(0.72, 0.03, 0.57, 0, 0.4, -0.12, green),
    box(0.76, 0.04, 0.6, 0, 0.64, -0.12, '#cfc8b6'),
    ...parapet(0, -0.12, 0.76, 0.6, 0.66, '#cfc8b6'),
    ...roofKit(0, -0.14, 0.6, 0.45, 0.66, 7),
    ...shopFront(-0.1, 0.05, 0.16, 0.4, 0.22),
    ...door(0.22, 0.16, 0.13, 0.24, '#26292e', { glass: true, lamp: true }),
    box(0.74, 0.025, 0.15, 0, 0.32, 0.23, green), box(0.74, 0.04, 0.012, 0, 0.3, 0.305, green),
    ...sign(-0.1, 0.36, 0.165, 0.36, 0.035, green, '#ffffff'),
    // the green cross on a bracket, seen from the street
    box(0.012, 0.012, 0.1, 0.36, 0.5, 0.2, '#5d6670'),
    box(0.03, 0.14, 0.14, 0.36, 0.5, 0.26, cross), box(0.03, 0.05, 0.14, 0.36, 0.5, 0.26, cross), box(0.032, 0.05, 0.05, 0.36, 0.5, 0.26, '#ffffff'),
    box(0.03, 0.14, 0.05, 0.36, 0.5, 0.26, cross),
    // upstairs flat
    ...windows('front', 0, -0.12, 0.35, 0.275, 0.52, 3, { w: 0.11, h: 0.12 }),
    ...windows('left', 0, -0.12, 0.35, 0.275, 0.52, 2, { w: 0.1, h: 0.11 }),
    ...windows('right', 0, -0.12, 0.35, 0.275, 0.52, 2, { w: 0.1, h: 0.11 }),
    ...bench(-0.3, 0.4), ...planter(0.42, 0.36),
  ]);
}

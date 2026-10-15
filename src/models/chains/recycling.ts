import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { METAL, PAVE } from './_shared';
import { door, parapet, roofKit, sign, windows } from '../details';

/** Recycling plant (2×2): a green sorting hall, a covered conveyor to the silo, bales of sorted waste and coloured bins. */
export function recyclingGeometry(): THREE.BufferGeometry {
  const green = '#4c9a52', dark = '#2d6a33';
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    box(1.2, 0.52, 0.8, -0.2, 0.26, -0.45, green),
    box(1.22, 0.04, 0.82, -0.2, 0.02, -0.45, '#3a3f46'),
    box(1.26, 0.06, 0.86, -0.2, 0.55, -0.45, dark),
    box(1.2, 0.012, 0.8, -0.2, 0.586, -0.45, '#8a8f98'),
    ...parapet(-0.2, -0.45, 1.26, 0.86, 0.58, dark),
    ...roofKit(-0.3, -0.5, 0.9, 0.6, 0.58, 23),
    // a roller door, a man door, the recycling sign and windows
    box(0.4, 0.34, 0.02, -0.5, 0.19, -0.045, '#9aa3ab'), ...[0.08, 0.15, 0.22, 0.29].map((y) => box(0.38, 0.008, 0.025, -0.5, y, -0.04, '#7d828a')),
    ...door(0.15, -0.045, 0.12, 0.22, '#3a3f46'),
    box(0.4, 0.2, 0.02, -0.05, 0.42, -0.04, '#f2f4f6'), box(0.16, 0.16, 0.022, -0.05, 0.42, -0.035, green),
    ...windows('left', -0.2, -0.45, 0.6, 0.4, 0.4, 3, { w: 0.14, h: 0.1 }),
    // the silo with a ladder and the covered conveyor rising to it
    shape('cylinder', 0.3, 0.7, 0.3, 0.7, 0.35, -0.5, '#cfd6dc', 'y', 16), shape('cone', 0.3, 0.1, 0.3, 0.7, 0.75, -0.5, '#b8c0c8', 'y', 16),
    ...[0.15, 0.3, 0.45, 0.6].map((y) => box(0.06, 0.012, 0.012, 0.7, y, -0.34, METAL)),
    box(0.9, 0.04, 0.12, 0.2, 0.2, 0.15, METAL), box(0.9, 0.06, 0.13, 0.2, 0.25, 0.15, '#b8c0c8'),
    box(0.02, 0.2, 0.02, -0.2, 0.1, 0.15, METAL), box(0.02, 0.2, 0.02, 0.6, 0.1, 0.15, METAL),
    // bales of paper, plastic and cans, and the coloured bins
    ...[[-0.75, '#c9b38a'], [-0.6, '#6fb6ff'], [-0.75, '#c9b38a'], [0.55, '#9aa3ab']].map(([x, c], i) => box(0.13, 0.11, 0.13, x as number, 0.075 + (i === 2 ? 0.11 : 0), i === 3 ? 0.4 : 0.4, c as string)),
    box(0.13, 0.11, 0.13, 0.7, 0.075, 0.4, '#e85a7a'),
  ];
  for (const [c, x] of [['#3a6fd1', -0.6], ['#f2c230', -0.35], ['#4c9a52', -0.1], ['#d9443b', 0.15]] as [string, number][]) {
    parts.push(box(0.18, 0.16, 0.18, x, 0.09, 0.7, c), box(0.19, 0.02, 0.19, x, 0.18, 0.7, '#26292e'), box(0.03, 0.03, 0.012, x, 0.1, 0.795, '#f4f4f2'));
  }
  parts.push(...sign(-0.2, 0.5, -0.025, 0.5, 0.04, dark, '#ffffff'));
  return merge(parts);
}

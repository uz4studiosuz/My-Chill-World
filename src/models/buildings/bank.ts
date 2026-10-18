import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { door, lamp, planter, windows } from '../details';

/** Bank: a classical stone building — wide steps, a portico of columns, a pediment, tall windows and a bronze door. */
export function bankGeometry(): THREE.BufferGeometry {
  const stone = '#e8e4da', trim = '#d2ccbd', gold = '#d4af37';
  const parts: THREE.BufferGeometry[] = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#bdb7aa'),
    // the hall on a stone plinth
    box(0.82, 0.06, 0.6, 0, 0.03, -0.1, trim),
    box(0.76, 0.48, 0.54, 0, 0.3, -0.1, stone),
    box(0.84, 0.05, 0.62, 0, 0.565, -0.1, trim),
    box(0.8, 0.07, 0.58, 0, 0.625, -0.1, '#6d6a62'),
    box(0.62, 0.06, 0.44, 0, 0.69, -0.1, '#6d6a62'),
    // steps up to the portico
    box(0.78, 0.025, 0.1, 0, 0.0125 + 0.01, 0.36, trim), box(0.72, 0.025, 0.08, 0, 0.0375 + 0.01, 0.33, trim), box(0.66, 0.025, 0.06, 0, 0.0625 + 0.01, 0.3, trim),
    // the portico: floor, columns with bases and capitals, architrave and a triangular pediment
    box(0.7, 0.02, 0.14, 0, 0.08, 0.26, trim),
    box(0.74, 0.05, 0.16, 0, 0.5, 0.26, stone), box(0.76, 0.015, 0.17, 0, 0.475, 0.26, trim),
    shape('pyramid', 0.74, 0.12, 0.14, 0, 0.58, 0.26, stone),
    box(0.14, 0.03, 0.01, 0, 0.5, 0.345, gold),
  ];
  for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) {
    parts.push(shape('cylinder', 0.055, 0.38, 0.055, x, 0.28, 0.27, '#f4f1ea', 'y', 10));
    parts.push(box(0.075, 0.02, 0.075, x, 0.1, 0.27, trim), box(0.08, 0.025, 0.08, x, 0.465, 0.27, trim));
  }
  parts.push(
    ...door(0, 0.19, 0.16, 0.28, '#7a4f2a'),
    box(0.17, 0.012, 0.012, 0, 0.17, 0.2, gold),
    ...windows('front', 0, -0.1, 0.38, 0.27, 0.32, 2, { w: 0.08, h: 0.2, from: -0.27, to: 0.27, frame: trim }),
    ...windows('left', 0, -0.1, 0.38, 0.27, 0.32, 3, { w: 0.08, h: 0.2, frame: trim }),
    ...windows('right', 0, -0.1, 0.38, 0.27, 0.32, 3, { w: 0.08, h: 0.2, frame: trim }),
    ...lamp(-0.42, 0.38, 0.3), ...lamp(0.42, 0.38, 0.3),
    ...planter(-0.42, 0.22), ...planter(0.42, 0.22),
  );
  return merge(parts);
}

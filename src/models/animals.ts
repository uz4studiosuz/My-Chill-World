import { box, merge } from '../utils/voxel';

function legs(x: number, z: number, h: number, color: string) {
  return [-x, x].flatMap((lx) => [-z, z].map((lz) => box(0.03, h, 0.03, lx, h / 2, lz, color)));
}

export const cowGeometry = () => merge([
  box(0.13, 0.1, 0.22, 0, 0.13, 0, '#f4f1ea'),
  box(0.132, 0.07, 0.08, 0, 0.14, -0.03, '#2b2622'),
  box(0.09, 0.08, 0.09, 0, 0.17, 0.14, '#f4f1ea'),
  box(0.06, 0.03, 0.02, 0, 0.15, 0.19, '#e7b3a8'),
  box(0.11, 0.02, 0.02, 0, 0.215, 0.12, '#d8cfa8'),
  ...legs(0.04, 0.07, 0.08, '#2b2622'),
]);

export const sheepGeometry = () => merge([
  box(0.14, 0.1, 0.18, 0, 0.12, 0, '#f2efe6'),
  box(0.12, 0.04, 0.16, 0, 0.18, 0, '#f8f6f0'),
  box(0.06, 0.07, 0.07, 0, 0.15, 0.11, '#3b3531'),
  box(0.1, 0.02, 0.02, 0, 0.17, 0.1, '#3b3531'),
  ...legs(0.04, 0.05, 0.07, '#3b3531'),
]);

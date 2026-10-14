import { box, merge } from '../../utils/voxel';
import { legs } from './_shared';

export const cowGeometry = () => merge([
  box(0.13, 0.1, 0.22, 0, 0.13, 0, '#f4f1ea'),
  box(0.132, 0.07, 0.08, 0, 0.14, -0.03, '#2b2622'),
  box(0.09, 0.08, 0.09, 0, 0.17, 0.14, '#f4f1ea'),
  box(0.06, 0.03, 0.02, 0, 0.15, 0.19, '#e7b3a8'),
  box(0.11, 0.02, 0.02, 0, 0.215, 0.12, '#d8cfa8'),
  ...legs(0.04, 0.07, 0.08, '#2b2622'),
]);

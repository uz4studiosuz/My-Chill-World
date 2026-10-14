import { box, merge } from '../../utils/voxel';
import { legs } from './_shared';

export const sheepGeometry = () => merge([
  box(0.14, 0.1, 0.18, 0, 0.12, 0, '#f2efe6'),
  box(0.12, 0.04, 0.16, 0, 0.18, 0, '#f8f6f0'),
  box(0.06, 0.07, 0.07, 0, 0.15, 0.11, '#3b3531'),
  box(0.1, 0.02, 0.02, 0, 0.17, 0.1, '#3b3531'),
  ...legs(0.04, 0.05, 0.07, '#3b3531'),
]);

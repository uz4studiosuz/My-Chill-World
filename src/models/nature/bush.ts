import { box, merge } from '../../utils/voxel';

export const bushGeometry = () => merge([
  box(0.22, 0.12, 0.2, 0, 0.06, 0),
  box(0.14, 0.08, 0.14, 0.05, 0.15, 0.02),
  box(0.12, 0.08, 0.12, -0.09, 0.08, -0.06),
]);

import { box, merge } from '../../utils/voxel';

/** Bundle carried in the mother's arms. */
export const babyGeometry = () => merge([
  box(0.034, 0.03, 0.052, 0, 0.11, 0.036, '#f6efe6'),
  box(0.026, 0.026, 0.026, 0, 0.126, 0.062, '#f1c9a5'),
]);

import { box, merge } from '../../utils/voxel';

/** Trunk with a root flare and a forked branch. */
export const trunkGeometry = () => merge([
  box(0.14, 0.42, 0.14, 0, 0.21, 0, '#6b4a2e'),
  box(0.2, 0.05, 0.2, 0, 0.025, 0, '#5a3d26'),
  box(0.06, 0.16, 0.06, 0.09, 0.4, 0.02, '#6b4a2e'),
]);

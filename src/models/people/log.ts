import { box, merge } from '../../utils/voxel';

/** Log carried on the shoulder. */
export const logGeometry = () => merge([
  box(0.13, 0.03, 0.03, 0.02, 0.15, -0.01, '#8a5a35'),
  box(0.005, 0.032, 0.032, 0.086, 0.15, -0.01, '#d8b27a'),
]);

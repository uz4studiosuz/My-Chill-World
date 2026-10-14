import { box, merge } from '../../utils/voxel';

export const locoGeometry = () => merge([
  box(0.24, 0.2, 0.6, 0, 0.16, 0, '#c4553d'),
  box(0.2, 0.1, 0.18, 0, 0.31, -0.18, '#2d3138'),
  box(0.18, 0.08, 0.02, 0, 0.2, 0.301, '#fff6c8'),
  box(0.26, 0.05, 0.62, 0, 0.04, 0, '#26292e'),
]);

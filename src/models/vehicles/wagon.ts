import { box, merge } from '../../utils/voxel';

export const wagonGeometry = () => merge([
  box(0.24, 0.18, 0.56, 0, 0.15, 0, '#3a6fd1'),
  box(0.25, 0.05, 0.5, 0, 0.12, 0, '#a8d0e6'),
  box(0.26, 0.05, 0.58, 0, 0.04, 0, '#26292e'),
]);

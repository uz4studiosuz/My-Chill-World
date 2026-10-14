import { box, merge } from '../../utils/voxel';

export const cargoGeometry = () => merge([
  box(0.16, 0.07, 0.22, 0, 0.17, -0.08, '#aaa59b'),
  box(0.09, 0.05, 0.1, 0.02, 0.22, -0.1, '#bdb8ae'),
]);

import { box, merge } from '../../utils/voxel';

export const rockGeometry = () => merge([box(0.42, 0.26, 0.36, 0, 0.13, 0), box(0.26, 0.18, 0.22, 0.16, 0.09, 0.14)]);

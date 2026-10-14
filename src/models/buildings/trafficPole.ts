import { box, merge } from '../../utils/voxel';

/** Traffic-light pole (the lamp head is a separate tinted mesh). */
export const trafficPoleGeometry = () => merge([
  box(0.025, 0.36, 0.025, 0, 0.18, 0, '#4a4f57'),
  box(0.06, 0.14, 0.05, 0, 0.36, 0, '#2d3138'),
]);

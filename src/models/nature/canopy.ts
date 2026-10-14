import { box, merge } from '../../utils/voxel';

/** White canopy — tinted per instance (green / autumn): a full crown of overlapping clumps. */
export const canopyGeometry = () => merge([
  box(0.62, 0.42, 0.62, 0, 0.64, 0),
  box(0.44, 0.3, 0.44, 0.05, 0.95, -0.04),
  box(0.32, 0.28, 0.32, -0.24, 0.52, 0.2),
  box(0.3, 0.26, 0.3, 0.26, 0.56, -0.18),
  box(0.28, 0.24, 0.28, 0.2, 0.74, 0.24),
  box(0.22, 0.18, 0.22, -0.18, 0.86, -0.2),
]);

import { box, merge } from '../../utils/voxel';
import { rbox } from './_shared';

/** Fir: a trunk and alternating, turned layers of branches with lighter tips. */
export const pineGeometry = () => merge([
  box(0.12, 0.3, 0.12, 0, 0.15, 0, '#6b4a2e'),
  box(0.18, 0.04, 0.18, 0, 0.02, 0, '#5a3d26'),
  rbox(0.66, 0.2, 0.66, 0, 0.38, 0, '#2a6236', 0),
  rbox(0.58, 0.16, 0.58, 0, 0.5, 0, '#2f6b3c', Math.PI / 4),
  rbox(0.48, 0.18, 0.48, 0, 0.64, 0, '#357543', 0),
  rbox(0.38, 0.14, 0.38, 0, 0.77, 0, '#3a7a46', Math.PI / 4),
  rbox(0.28, 0.16, 0.28, 0, 0.9, 0, '#3b7d48', 0),
  rbox(0.16, 0.14, 0.16, 0, 1.03, 0, '#428650', Math.PI / 4),
  box(0.06, 0.08, 0.06, 0, 1.13, 0, '#4a9058'),
]);

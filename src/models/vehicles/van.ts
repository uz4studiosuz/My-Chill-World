import { box, merge, roundBox } from '../quality';
import { wheel } from './_shared';

/**
 * The construction company's van: a tall yellow panel van (+Z forward) with a sloped bonnet, a dark stripe,
 * a roof rack with a ladder, an orange beacon and sliding side doors — it carries the building crew.
 */
export const vanGeometry = () => merge([
  // body: the tall load box and the cab with its bonnet
  roundBox(0.166, 0.13, 0.27, 0, 0.115, -0.045, '#f2b33d', 0.012),
  roundBox(0.166, 0.085, 0.1, 0, 0.093, 0.135, '#f2b33d', 0.01),
  roundBox(0.158, 0.06, 0.05, 0, 0.16, 0.098, '#f2b33d', 0.01),
  // windscreen and side windows of the cab
  box(0.146, 0.05, 0.004, 0, 0.158, 0.124, '#2f3d4a'),
  box(0.004, 0.045, 0.05, -0.084, 0.155, 0.09, '#2f3d4a'), box(0.004, 0.045, 0.05, 0.084, 0.155, 0.09, '#2f3d4a'),
  // a dark stripe down the sides, and the sliding door seams
  box(0.17, 0.014, 0.27, 0, 0.1, -0.045, '#3a3f46'),
  box(0.171, 0.09, 0.003, 0, 0.12, 0.02, '#c98a2b'),
  box(0.171, 0.09, 0.003, 0, 0.12, -0.1, '#c98a2b'),
  // bumpers, lights, grille
  box(0.17, 0.02, 0.016, 0, 0.045, 0.188, '#3a3f46'),
  box(0.17, 0.02, 0.014, 0, 0.045, -0.183, '#3a3f46'),
  box(0.09, 0.022, 0.004, 0, 0.078, 0.186, '#26292e'),
  box(0.028, 0.016, 0.004, -0.058, 0.082, 0.186, '#fff6c8'), box(0.028, 0.016, 0.004, 0.058, 0.082, 0.186, '#fff6c8'),
  box(0.02, 0.03, 0.004, -0.07, 0.1, -0.182, '#ff3b30'), box(0.02, 0.03, 0.004, 0.07, 0.1, -0.182, '#ff3b30'),
  // rear doors
  box(0.004, 0.11, 0.003, 0, 0.115, -0.181, '#c98a2b'),
  // roof rack with a ladder, and the orange beacon
  box(0.15, 0.006, 0.22, 0, 0.186, -0.05, '#7d858e'),
  box(0.035, 0.008, 0.2, -0.04, 0.193, -0.05, '#c9ced4'),
  ...[-0.13, -0.08, -0.03, 0.02].map((z) => box(0.035, 0.004, 0.006, -0.04, 0.198, z, '#c9ced4')),
  roundBox(0.03, 0.022, 0.03, 0.045, 0.2, 0.06, '#ff8a1e', 0.006),
  // wheels
  ...[-1, 1].flatMap((s) => [0.115, -0.115].flatMap((z) => wheel(s * 0.078, z, 0.03, 0.028))),
]);

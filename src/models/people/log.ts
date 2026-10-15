import { box, merge } from '../../utils/voxel';

const BARK = '#7a4f2c', BARK_DARK = '#5c3a21', WOOD = '#e2bf86', RING = '#b98a52';

/**
 * A log carried on the right shoulder, running front to back: rough bark with ridges, light cut ends with a ring
 * and a dark heart, a broken-off branch, and the hand that steadies it at the front.
 */
export const logGeometry = () => merge([
  // the trunk, a little thicker at the back
  box(0.03, 0.03, 0.17, 0.043, 0.148, -0.005, BARK),
  box(0.034, 0.034, 0.07, 0.043, 0.148, -0.055, BARK),
  // bark ridges along it
  ...[[0.016, 0.004], [-0.016, -0.004], [0.004, 0.016]].map(([dx, dy]) => box(0.004, 0.004, 0.15, 0.043 + dx, 0.148 + dy, -0.005, BARK_DARK)),
  // cut ends: light wood, a growth ring and the heart
  box(0.026, 0.026, 0.004, 0.043, 0.148, 0.081, WOOD), box(0.016, 0.016, 0.002, 0.043, 0.148, 0.084, RING), box(0.006, 0.006, 0.002, 0.043, 0.148, 0.0855, '#8a5a35'),
  box(0.03, 0.03, 0.004, 0.043, 0.148, -0.092, WOOD), box(0.018, 0.018, 0.002, 0.043, 0.148, -0.095, RING), box(0.007, 0.007, 0.002, 0.043, 0.148, -0.0965, '#8a5a35'),
  // a branch stub
  box(0.008, 0.016, 0.008, 0.055, 0.168, -0.03, BARK_DARK),
  // the right forearm raised to the log and the hand holding its front
  box(0.012, 0.035, 0.012, 0.045, 0.12, 0.035, '#c98f62'),
  box(0.014, 0.012, 0.016, 0.045, 0.135, 0.06, '#d9a77a'),
]);

import { box, merge } from '../quality';

/**
 * A wooden crate of broken stone carried in front with both hands (quarrymen and miners bringing the rock
 * back to their yard): planks with dark gaps, grey and light chips piled above the rim, two hands at the sides.
 */
export const stoneCrateGeometry = () => merge([
  box(0.07, 0.035, 0.05, 0, 0.11, 0.045, '#a8783f'),
  box(0.072, 0.004, 0.052, 0, 0.12, 0.045, '#7a5530'),
  box(0.072, 0.004, 0.052, 0, 0.1, 0.045, '#7a5530'),
  // the stones heaped in it
  box(0.026, 0.02, 0.022, -0.016, 0.135, 0.04, '#9a968f'),
  box(0.022, 0.018, 0.02, 0.014, 0.137, 0.05, '#bdb7aa'),
  box(0.018, 0.016, 0.018, 0.002, 0.148, 0.042, '#8d8a83'),
  box(0.016, 0.014, 0.016, 0.022, 0.132, 0.034, '#d8d2c4'),
  // forearms and hands holding it
  ...[-1, 1].flatMap((s) => [box(0.012, 0.012, 0.04, s * 0.038, 0.115, 0.03, '#c98f62'), box(0.012, 0.016, 0.014, s * 0.038, 0.115, 0.052, '#d9a77a')]),
]);

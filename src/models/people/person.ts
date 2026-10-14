import { SKIN, SHIRTS, DRESSES, maleShape, femaleShape } from './_shared';

export const personGeometry = (variant: number) =>
  variant < 4 ? maleShape(SHIRTS[variant], SKIN[variant % 4]) : femaleShape(DRESSES[variant - 4], SKIN[(variant - 3) % 4]);

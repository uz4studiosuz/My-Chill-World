import { SKIN, SHIRTS, DRESSES, HAIR, maleShape, femaleShape } from './_shared';

const PANTS = ['#3b4a63', '#2e3440', '#5a4a3a', '#3f4b3a'];

/** Variants 0–3 are men (each with its own shirt, trousers and hair), 4–7 women (two with a bun). */
export const personGeometry = (variant: number) =>
  variant < 4
    ? maleShape(SHIRTS[variant], SKIN[variant % 4], HAIR[variant % 4], PANTS[variant % 4])
    : femaleShape(DRESSES[variant - 4], SKIN[(variant - 3) % 4], HAIR[(variant + 1) % 4], variant % 2 === 1);

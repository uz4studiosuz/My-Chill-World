import { GRAVE_OFFSETS, GRAVES_L2, GRAVES_L3 } from './_shared';

/** Headstone position for the i-th grave: the first 16 fill the base plot, upgrades add denser rows. */
export function graveOffset(i: number): [number, number] {
  if (i < GRAVE_OFFSETS.length) return GRAVE_OFFSETS[i];
  if (i < GRAVE_OFFSETS.length + GRAVES_L2.length) return GRAVES_L2[i - GRAVE_OFFSETS.length];
  return GRAVES_L3[Math.min(GRAVES_L3.length - 1, i - GRAVE_OFFSETS.length - GRAVES_L2.length)];
}

import { BUILDINGS, type BuildingKind } from './BuildingTypes';
import type { Building } from './Buildings';

/** Buildings that can be raised to a higher level, and what a level adds (English, translated in the UI). */
export const UPGRADABLE: Partial<Record<BuildingKind, { max: number; gives: string }>> = {
  school: { max: 3, gives: 'More pupils' },
  kindergarten: { max: 3, gives: 'More children' },
  university: { max: 3, gives: 'More students' },
  hospital: { max: 3, gives: 'Heals more people' },
  watertower: { max: 3, gives: 'Water for more people' },
  sewage: { max: 3, gives: 'Cleans the water of more people' },
};

/** How much more a building does at its level: ×1, ×1.75, ×2.5. */
export const levelMult = (b: Building) => (UPGRADABLE[b.kind] ? 1 + 0.75 * ((b.level || 1) - 1) : 1);

/** Places at a school, kindergarten or university at its level. */
export const seatsOf = (b: Building) => Math.round(BUILDINGS[b.kind].students * levelMult(b));

/** People a water tower serves at its level. */
export const waterOf = (b: Building) => Math.round(BUILDINGS[b.kind].water * levelMult(b));

/** What the next level costs: a good part of the building's own price, more for each level. */
export function upgradeCost(b: Building) {
  const d = BUILDINGS[b.kind];
  const k = 0.6 * (b.level || 1);
  return { money: Math.round((d.money * k) / 10) * 10, stone: Math.round(d.stone * k * 0.6), wood: Math.round(d.wood * k * 0.6), iron: Math.round(d.iron * k * 0.6) };
}

export const canUpgrade = (b: Building) => !!UPGRADABLE[b.kind] && b.built >= 1 && (b.level || 1) < UPGRADABLE[b.kind]!.max;

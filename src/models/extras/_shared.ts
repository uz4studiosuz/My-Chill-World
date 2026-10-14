// Shared colours and helpers of the extras models.
import { box } from '../../utils/voxel';

// Leisure buildings and town decorations. Models face +z; size 1 → ±0.5, size 2 → ±1, size 3 → ±1.5.
export const GRASS = '#76b04f';
export const PAVING = '#d9cfae';
export const WOOD = '#8a5a35';
export const METAL = '#5d6670';
export const shrub = (x: number, z: number, s = 1, c = '#4f8a3a') => [
  box(0.05 * s, 0.12 * s, 0.05 * s, x, 0.06 * s, z, '#6b4a2e'),
  box(0.22 * s, 0.2 * s, 0.22 * s, x, 0.2 * s, z, c),
  box(0.14 * s, 0.1 * s, 0.14 * s, x, 0.33 * s, z, c),
];

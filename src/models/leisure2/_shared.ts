// Shared colours and helpers of the leisure2 models.
import { shape } from '../../utils/voxel';

// Leisure, faith and services: casino, mosque, amusement park, central park, gym, teahouse, barber. Models face +z.
export const PAVE = '#bdb7aa';
export const GRASS = '#7fb85a';
export const GOLD = '#e3bf4f';
export function tree(x: number, z: number, h = 0.5, leaf = '#4f8f3a') {
  return [
    shape('cylinder', 0.06, h * 0.5, 0.06, x, h * 0.25, z, '#6b4a2e', 'y', 6),
    shape('sphere', h * 0.6, h * 0.6, h * 0.6, x, h * 0.62, z, leaf, 'y', 8),
  ];
}

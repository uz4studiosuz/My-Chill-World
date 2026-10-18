// Shared colours and helpers of the leisure2 models.
import { organic, rod } from '../quality';

// Leisure, faith and services: casino, mosque, amusement park, central park, gym, teahouse, barber. Models face +z.
export const PAVE = '#bdb7aa';
export const GRASS = '#7fb85a';
export const GOLD = '#e3bf4f';
export function tree(x: number, z: number, h = 0.5, leaf = '#4f8f3a') {
  return [
    rod([x,0,z],[x,h*.55,z],.03,'#6b4a2e',.014,7),
    organic(h*.64,h*.57,h*.64,x,h*.60,z,leaf,4),
    organic(h*.43,h*.38,h*.43,x+h*.08,h*.84,z-h*.04,leaf,9),
  ];
}

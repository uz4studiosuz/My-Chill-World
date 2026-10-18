// Shared colours and helpers of the extras models.
import { organic, rod } from '../quality';

// Leisure buildings and town decorations. Models face +z; size 1 → ±0.5, size 2 → ±1, size 3 → ±1.5.
export const GRASS = '#76b04f';
export const PAVING = '#d9cfae';
export const WOOD = '#8a5a35';
export const METAL = '#5d6670';
export const shrub=(x:number,z:number,s=1,c='#4f8a3a')=>[
  rod([x,0,z],[x,.18*s,z],.023*s,'#6b4a2e',.013*s,6),
  organic(.24*s,.24*s,.24*s,x,.22*s,z,c,2),
  organic(.16*s,.14*s,.16*s,x+.02*s,.33*s,z-.01*s,c,7),
];

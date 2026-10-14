// Shared colours and helpers of the animals models.
import { box } from '../../utils/voxel';

export function legs(x: number, z: number, h: number, color: string) {
  return [-x, x].flatMap((lx) => [-z, z].map((lz) => box(0.03, h, 0.03, lx, h / 2, lz, color)));
}

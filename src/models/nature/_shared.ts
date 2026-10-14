// Shared colours and helpers of the nature models.
import { box } from '../../utils/voxel';

/** Box turned around the vertical axis (for layered fir branches). */
export const rbox = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rot: number) => {
  const g = box(w, h, d, 0, 0, 0, color);
  g.rotateY(rot);
  g.translate(x, y, z);
  return g;
};

import * as THREE from 'three';
import { box, merge } from '../utils/voxel';

/** Box turned around the vertical axis (for layered fir branches). */
const rbox = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rot: number) => {
  const g = box(w, h, d, 0, 0, 0, color);
  g.rotateY(rot);
  g.translate(x, y, z);
  return g;
};

/** Fir: a trunk and alternating, turned layers of branches with lighter tips. */
export const pineGeometry = () => merge([
  box(0.12, 0.3, 0.12, 0, 0.15, 0, '#6b4a2e'),
  box(0.18, 0.04, 0.18, 0, 0.02, 0, '#5a3d26'),
  rbox(0.66, 0.2, 0.66, 0, 0.38, 0, '#2a6236', 0),
  rbox(0.58, 0.16, 0.58, 0, 0.5, 0, '#2f6b3c', Math.PI / 4),
  rbox(0.48, 0.18, 0.48, 0, 0.64, 0, '#357543', 0),
  rbox(0.38, 0.14, 0.38, 0, 0.77, 0, '#3a7a46', Math.PI / 4),
  rbox(0.28, 0.16, 0.28, 0, 0.9, 0, '#3b7d48', 0),
  rbox(0.16, 0.14, 0.16, 0, 1.03, 0, '#428650', Math.PI / 4),
  box(0.06, 0.08, 0.06, 0, 1.13, 0, '#4a9058'),
]);

/** Trunk with a root flare and a forked branch. */
export const trunkGeometry = () => merge([
  box(0.14, 0.42, 0.14, 0, 0.21, 0, '#6b4a2e'),
  box(0.2, 0.05, 0.2, 0, 0.025, 0, '#5a3d26'),
  box(0.06, 0.16, 0.06, 0.09, 0.4, 0.02, '#6b4a2e'),
]);

/** White canopy — tinted per instance (green / autumn): a full crown of overlapping clumps. */
export const canopyGeometry = () => merge([
  box(0.62, 0.42, 0.62, 0, 0.64, 0),
  box(0.44, 0.3, 0.44, 0.05, 0.95, -0.04),
  box(0.32, 0.28, 0.32, -0.24, 0.52, 0.2),
  box(0.3, 0.26, 0.3, 0.26, 0.56, -0.18),
  box(0.28, 0.24, 0.28, 0.2, 0.74, 0.24),
  box(0.22, 0.18, 0.22, -0.18, 0.86, -0.2),
]);

export const rockGeometry = () => merge([box(0.42, 0.26, 0.36, 0, 0.13, 0), box(0.26, 0.18, 0.22, 0.16, 0.09, 0.14)]);

export const cactusGeometry = () => merge([
  box(0.09, 0.42, 0.09, 0, 0.21, 0, '#4f8a3a'),
  box(0.07, 0.07, 0.07, 0.08, 0.2, 0, '#4f8a3a'),
  box(0.06, 0.14, 0.06, 0.13, 0.27, 0, '#5d9a45'),
  box(0.07, 0.07, 0.07, -0.08, 0.28, 0, '#4f8a3a'),
  box(0.06, 0.12, 0.06, -0.13, 0.34, 0, '#5d9a45'),
  box(0.04, 0.04, 0.04, 0, 0.44, 0, '#e85a7a'),
]);

export const bushGeometry = () => merge([
  box(0.22, 0.12, 0.2, 0, 0.06, 0),
  box(0.14, 0.08, 0.14, 0.05, 0.15, 0.02),
  box(0.12, 0.08, 0.12, -0.09, 0.08, -0.06),
]);

export const tuftGeometry = () => new THREE.BoxGeometry(0.05, 0.12, 0.05).translate(0, 0.06, 0);

/** Stepped voxel mountain for the gallery. */
export function mountainGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let lvl = 0; lvl < 7; lvl++) {
    const s = 3.2 - lvl * 0.42;
    const color = lvl >= 5 ? '#f2f4f6' : lvl % 2 ? '#8f8c86' : '#9b978e';
    parts.push(box(s, 0.5, s * (0.9 + (lvl % 2) * 0.08), lvl * 0.05, 0.25 + lvl * 0.5, -lvl * 0.04, color));
  }
  return merge(parts);
}

import * as THREE from 'three';
import { box, merge } from '../utils/voxel';

export const pineGeometry = () => merge([
  box(0.12, 0.3, 0.12, 0, 0.15, 0, '#6b4a2e'),
  box(0.62, 0.26, 0.62, 0, 0.42, 0, '#2f6b3c'),
  box(0.46, 0.24, 0.46, 0, 0.66, 0, '#357543'),
  box(0.3, 0.22, 0.3, 0, 0.88, 0, '#3b7d48'),
  box(0.14, 0.16, 0.14, 0, 1.05, 0, '#428650'),
]);

export const trunkGeometry = () => box(0.14, 0.4, 0.14, 0, 0.2, 0, '#6b4a2e');

/** White canopy — tinted per instance (green / autumn). */
export const canopyGeometry = () => merge([
  box(0.62, 0.46, 0.62, 0, 0.62, 0),
  box(0.4, 0.3, 0.4, 0.06, 0.95, -0.04),
  box(0.3, 0.26, 0.3, -0.2, 0.5, 0.18),
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

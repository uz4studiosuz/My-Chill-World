import * as THREE from 'three';
import { box, merge } from '../quality';
import { GRASS, shrub } from './_shared';

/** Decorative street lamp (its light is a separate glowing head). */
export function lamppostGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.14, 0.05, 0.14, 0, 0.025, 0, '#3d4148'),
    box(0.04, 0.6, 0.04, 0, 0.32, 0, '#2d3138'),
    box(0.3, 0.025, 0.025, 0, 0.6, 0, '#2d3138'),
    box(0.1, 0.02, 0.1, -0.15, 0.6, 0, '#2d3138'), box(0.1, 0.02, 0.1, 0.15, 0.6, 0, '#2d3138'),
    ...shrub(0.3, 0.3, 0.5, '#5f9a3e'),
  ]);
}

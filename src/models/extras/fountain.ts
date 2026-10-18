import * as THREE from 'three';
import { box, merge } from '../quality';
import { PAVING, shrub } from './_shared';

/** Fountain: basin and pedestal (the water jet is animated separately). */
export function fountainGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVING),
    box(0.7, 0.1, 0.7, 0, 0.05, 0, '#cfc8b6'),
    box(0.6, 0.11, 0.6, 0, 0.056, 0, '#4fa3d1'),
    box(0.12, 0.22, 0.12, 0, 0.11, 0, '#cfc8b6'),
    box(0.26, 0.04, 0.26, 0, 0.23, 0, '#cfc8b6'),
    box(0.2, 0.03, 0.2, 0, 0.245, 0, '#5fb4e0'),
    ...shrub(-0.4, -0.4, 0.6, '#5f9a3e'), ...shrub(0.4, -0.4, 0.6, '#5f9a3e'),
    ...shrub(-0.4, 0.4, 0.6, '#5f9a3e'), ...shrub(0.4, 0.4, 0.6, '#5f9a3e'),
  ]);
}

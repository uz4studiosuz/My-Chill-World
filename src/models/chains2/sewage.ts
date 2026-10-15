import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { PAVE, METAL } from './_shared';
import { door, lamp, parapet, windows } from '../details';

/** A round settling tank: a concrete ring, the water, a rotating bridge across it and a central drum. */
function tank(x: number, z: number, water: string, bridgeAngle: number): THREE.BufferGeometry[] {
  const bridge = box(0.74, 0.02, 0.05, 0, 0, 0, '#9aa3ab');
  bridge.rotateY(bridgeAngle);
  bridge.translate(x, 0.17, z);
  return [
    shape('cylinder', 0.8, 0.16, 0.8, x, 0.08, z, '#cfc8b6', 'y', 24),
    shape('cylinder', 0.7, 0.161, 0.7, x, 0.085, z, water, 'y', 24),
    shape('cylinder', 0.68, 0.006, 0.68, x, 0.168, z, '#7ea6b5', 'y', 24),
    bridge,
    shape('cylinder', 0.1, 0.06, 0.1, x, 0.2, z, '#8a8f98', 'y', 12),
  ];
}

/** Sewage treatment: two settling tanks, an aeration basin, a pump house, pipes and a fence. */
export function sewageGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, PAVE),
    ...tank(-0.45, -0.45, '#6b8a5a', 0.4), ...tank(0.45, -0.45, '#5f8fa0', 1.2),
    // a rectangular aeration basin with bubbling patches
    box(0.8, 0.12, 0.42, -0.45, 0.06, 0.45, '#cfc8b6'), box(0.72, 0.121, 0.34, -0.45, 0.065, 0.45, '#6f9aa8'),
    ...[-0.7, -0.55, -0.4, -0.25].map((x) => box(0.08, 0.006, 0.08, x, 0.128, 0.45, '#cfe0ec')),
    // the pump house
    box(0.5, 0.32, 0.4, 0.45, 0.16, 0.5, '#e9edf0'), box(0.54, 0.04, 0.44, 0.45, 0.34, 0.5, '#3a6fd1'),
    ...parapet(0.45, 0.5, 0.54, 0.44, 0.36, '#2d5aa8', 0.02, 0.03),
    ...door(0.45, 0.705, 0.12, 0.22, '#5d6670'),
    ...windows('left', 0.45, 0.5, 0.25, 0.2, 0.22, 2, { w: 0.09, h: 0.08 }),
    // pipes between the basins and the pump house, with valves
    cylX(0.04, 1.2, -0.1, 0.06, 0.1, METAL, 8), cylX(0.03, 0.5, 0.2, 0.08, -0.02, METAL, 8),
    shape('cylinder', 0.06, 0.03, 0.06, 0.12, 0.09, 0.1, '#d9443b', 'y', 10),
    box(0.04, 0.3, 0.04, 0.15, 0.15, -0.05, METAL),
    // fence and lights
    ...[-0.95, 0.95].map((x) => box(0.012, 0.1, 1.9, x, 0.06, 0, '#9aa3ab')),
    box(1.9, 0.1, 0.012, 0, 0.06, -0.95, '#9aa3ab'),
    ...lamp(0.0, 0.85, 0.36),
  ]);
}

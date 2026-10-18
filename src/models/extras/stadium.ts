import * as THREE from 'three';
import { box, merge } from '../quality';
import { PAVING, METAL } from './_shared';

/** Football stadium (3×3): pitch, goals, stands, floodlights and a scoreboard. */
export function stadiumGeometry(): THREE.BufferGeometry {
  const stand = ['#d9443b', '#e8e3d6', '#3a6fd1'];
  const parts = [
    box(2.94, 0.02, 2.94, 0, 0.01, 0, '#9d9d9a'),
    box(2.1, 0.025, 1.6, 0, 0.02, -0.15, '#4f9a3e'),
    ...[-0.8, -0.4, 0, 0.4, 0.8].map((x) => box(0.2, 0.027, 1.6, x, 0.021, -0.15, '#5aa848')),
    box(0.02, 0.03, 1.5, 0, 0.024, -0.15, '#ffffff'),
    box(2.0, 0.03, 0.02, 0, 0.024, -0.9, '#ffffff'), box(2.0, 0.03, 0.02, 0, 0.024, 0.6, '#ffffff'),
    box(0.02, 0.03, 1.5, -1.0, 0.024, -0.15, '#ffffff'), box(0.02, 0.03, 1.5, 1.0, 0.024, -0.15, '#ffffff'),
    box(0.16, 0.031, 0.16, 0, 0.024, -0.15, '#ffffff'),
    // goals
    box(0.02, 0.12, 0.36, -1.02, 0.08, -0.15, '#ffffff'), box(0.06, 0.02, 0.36, -1.04, 0.14, -0.15, '#ffffff'),
    box(0.02, 0.12, 0.36, 1.02, 0.08, -0.15, '#ffffff'), box(0.06, 0.02, 0.36, 1.04, 0.14, -0.15, '#ffffff'),
    // stepped stands on three sides
    ...[0, 1, 2].flatMap((i) => [
      box(2.6, 0.1, 0.16, 0, 0.05 + i * 0.1, -1.1 - i * 0.12, stand[i]),
      box(0.16, 0.1, 1.9, -1.25 - i * 0.08, 0.05 + i * 0.1, -0.2, stand[2 - i]),
      box(0.16, 0.1, 1.9, 1.25 + i * 0.08, 0.05 + i * 0.1, -0.2, stand[2 - i]),
    ]),
    box(2.7, 0.04, 0.5, 0, 0.5, -1.25, '#e9edf0'),
    // floodlights
    ...[[-1.4, -1.4], [1.4, -1.4], [-1.4, 0.9], [1.4, 0.9]].flatMap(([x, z]) => [
      box(0.04, 0.9, 0.04, x, 0.45, z, METAL),
      box(0.2, 0.1, 0.06, x, 0.92, z, '#cfe0ec'),
    ]),
    // scoreboard and the main gate
    box(0.5, 0.22, 0.04, 0, 0.75, -1.45, '#26292e'),
    box(0.04, 0.4, 0.04, -0.2, 0.4, -1.45, METAL), box(0.04, 0.4, 0.04, 0.2, 0.4, -1.45, METAL),
    box(0.8, 0.02, 0.6, 0, 0.022, 1.15, PAVING),
    box(0.06, 0.3, 0.06, -0.35, 0.15, 1.0, '#e8e3d6'), box(0.06, 0.3, 0.06, 0.35, 0.15, 1.0, '#e8e3d6'),
    box(0.76, 0.08, 0.06, 0, 0.32, 1.0, '#3a6fd1'),
  ];
  return merge(parts);
}

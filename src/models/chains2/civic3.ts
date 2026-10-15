import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { PAVE } from './_shared';
import { sign } from '../details';

const CONCRETE = '#b9b5ac', DECK = '#8d8a83', DARK = '#26292e';
const CAR_COLORS = ['#d9443b', '#3b78c2', '#f4f4f2', '#2a2d31', '#9aa3ab', '#f2b33d', '#4c9a52'];

/** A little parked car seen from afar (for the car park decks). */
const miniCar = (x: number, y: number, z: number, c: string, along = false) => along
  ? [box(0.26, 0.06, 0.13, x, y + 0.04, z, c), box(0.14, 0.05, 0.11, x - 0.02, y + 0.09, z, '#2f3d4a')]
  : [box(0.13, 0.06, 0.26, x, y + 0.04, z, c), box(0.11, 0.05, 0.14, x, y + 0.09, z - 0.02, '#2f3d4a')];

/**
 * Multi-storey car park (2×2): open concrete decks on columns with cars inside, a ramp up the side, a stair tower,
 * a barrier at the entrance and a blue "P" sign.
 */
export function garageGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [box(1.96, 0.02, 1.96, 0, 0.01, 0, PAVE)];
  const floors = 3, h = 0.3;
  for (let f = 0; f <= floors; f++) {
    const y = f * h;
    parts.push(box(1.7, 0.05, 1.5, -0.1, y + 0.03, -0.15, f === floors ? DECK : CONCRETE));
    if (f > 0) {
      // parapets with a dark gap above them (open sides)
      parts.push(box(1.7, 0.07, 0.03, -0.1, y + 0.09, 0.6, CONCRETE), box(1.7, 0.07, 0.03, -0.1, y + 0.09, -0.9, CONCRETE), box(0.03, 0.07, 1.5, -0.95, y + 0.09, -0.15, CONCRETE));
    }
    if (f < floors) {
      for (const x of [-0.9, -0.3, 0.3, 0.7]) for (const z of [-0.85, 0.55]) parts.push(box(0.06, h - 0.05, 0.06, x, y + h / 2 + 0.03, z, '#a7a196'));
      // a row of cars on this deck
      for (let i = 0; i < 5; i++) if ((i + f) % 3 !== 2) parts.push(...miniCar(-0.78 + i * 0.32, y + 0.05, 0.25, CAR_COLORS[(i * 3 + f) % CAR_COLORS.length]));
      for (let i = 0; i < 5; i++) if ((i + f) % 4 !== 1) parts.push(...miniCar(-0.78 + i * 0.32, y + 0.05, -0.55, CAR_COLORS[(i * 5 + f + 2) % CAR_COLORS.length]));
    }
  }
  // the ramp up the right side
  for (let f = 0; f < floors; f++) {
    const g = shape('wedge', 0.26, h, 0.9, 0, 0, 0, '#9a968f');
    g.translate(0.88, f * h + h / 2 + 0.03, -0.15 + (f % 2 ? 0.25 : -0.25));
    if (f % 2) g.rotateY(0);
    parts.push(g);
  }
  // stair tower with a glass strip, the roof lamps
  parts.push(box(0.26, floors * h + 0.25, 0.26, -0.82, (floors * h + 0.25) / 2, -0.82, '#d8d2c4'), box(0.03, floors * h, 0.12, -0.68, floors * h / 2 + 0.05, -0.82, '#a8d0e6'));
  for (const [x, z] of [[-0.5, -0.5], [0.4, 0.2]]) parts.push(box(0.03, 0.3, 0.03, x, floors * h + 0.2, z, '#5d6670'), box(0.1, 0.03, 0.06, x + 0.03, floors * h + 0.36, z, '#3a3f46'), box(0.07, 0.01, 0.04, x + 0.03, floors * h + 0.343, z, '#fff6c8'));
  // the entrance barrier and the sign
  parts.push(box(0.06, 0.1, 0.06, 0.55, 0.05, 0.8, '#f2c230'), box(0.36, 0.025, 0.025, 0.36, 0.11, 0.8, '#d9443b'), box(0.1, 0.025, 0.026, 0.3, 0.11, 0.8, '#f4f4f2'));
  parts.push(box(0.04, 0.5, 0.04, 0.85, 0.25, 0.85, '#5d6670'), box(0.24, 0.24, 0.03, 0.85, 0.58, 0.86, '#2f6fd6'), box(0.06, 0.15, 0.032, 0.82, 0.58, 0.87, '#ffffff'), box(0.06, 0.06, 0.032, 0.87, 0.62, 0.87, '#ffffff'));
  return merge(parts);
}

/**
 * Metro station entrance: a glass pavilion with a red "M" pylon, stairs going down under a canopy, railings,
 * a vent grille and benches.
 */
export function metroGeometry(): THREE.BufferGeometry {
  const red = '#d9443b';
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    // the stairwell going down (a dark pit with steps)
    box(0.34, 0.012, 0.5, 0.14, 0.024, 0.12, '#15171a'),
    ...[0, 1, 2, 3, 4].map((i) => box(0.3, 0.01, 0.06, 0.14, 0.03 - i * 0.004, 0.32 - i * 0.09, '#5d6670')),
    // railings and the canopy over the stairs
    box(0.012, 0.12, 0.5, -0.04, 0.08, 0.12, '#9aa3ab'), box(0.012, 0.12, 0.5, 0.32, 0.08, 0.12, '#9aa3ab'),
    box(0.44, 0.02, 0.6, 0.14, 0.34, 0.1, '#a8d0e6'), box(0.46, 0.025, 0.025, 0.14, 0.33, 0.4, '#5d6670'),
    ...[[-0.06, 0.38], [0.34, 0.38], [-0.06, -0.18], [0.34, -0.18]].map(([x, z]) => box(0.02, 0.32, 0.02, x, 0.17, z, '#5d6670')),
    // the ticket pavilion
    box(0.32, 0.36, 0.3, -0.28, 0.18, -0.24, '#e9eef2'), box(0.33, 0.24, 0.005, -0.28, 0.2, -0.088, '#a8d0e6'), box(0.36, 0.03, 0.34, -0.28, 0.375, -0.24, '#3a3f46'),
    // the red "M" pylon
    box(0.05, 0.62, 0.05, -0.38, 0.31, 0.32, '#5d6670'),
    box(0.2, 0.2, 0.06, -0.38, 0.68, 0.32, red),
    box(0.03, 0.12, 0.062, -0.43, 0.68, 0.32, '#ffffff'), box(0.03, 0.12, 0.062, -0.33, 0.68, 0.32, '#ffffff'),
    box(0.03, 0.06, 0.062, -0.405, 0.71, 0.32, '#ffffff'), box(0.03, 0.06, 0.062, -0.355, 0.71, 0.32, '#ffffff'),
    // a vent grille and a bench
    box(0.22, 0.03, 0.14, 0.3, 0.025, -0.32, '#4a4f57'), ...[0, 1, 2, 3].map((i) => box(0.2, 0.032, 0.008, 0.3, 0.026, -0.37 + i * 0.033, '#2a2d31')),
    box(0.22, 0.02, 0.06, -0.28, 0.07, 0.04, '#8a5a35'), box(0.02, 0.06, 0.05, -0.37, 0.035, 0.04, DARK), box(0.02, 0.06, 0.05, -0.19, 0.035, 0.04, DARK),
    ...sign(-0.28, 0.3, -0.087, 0.26, 0.04, red, '#ffffff'),
  ]);
}

/** A security camera on a pole with a small solar panel and a blinking red light. */
export function cctvGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.16, 0.03, 0.16, 0, 0.015, 0, '#7d7a73'),
    shape('cylinder', 0.04, 0.9, 0.04, 0, 0.47, 0, '#5d6670', 'y', 8),
    box(0.16, 0.02, 0.02, 0.06, 0.88, 0, '#5d6670'),
    box(0.1, 0.07, 0.07, 0.12, 0.86, 0.02, '#f4f4f2'), box(0.05, 0.05, 0.02, 0.12, 0.86, 0.065, '#26292e'), box(0.02, 0.02, 0.01, 0.12, 0.86, 0.077, '#4fa3d1'),
    box(0.12, 0.012, 0.09, -0.04, 0.95, 0, '#2f3d4a'), box(0.012, 0.012, 0.012, 0.16, 0.9, 0.03, '#ff3b30'),
    box(0.08, 0.1, 0.05, 0, 0.3, 0.03, '#9aa3ab'),
  ]);
}

/** A flood wall: a stone levee with a concrete cap, sandbags along its foot and a gauge post. */
export function leveeGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#8cb156'),
    box(0.98, 0.26, 0.36, 0, 0.13, -0.05, '#a7a196'), box(0.98, 0.04, 0.4, 0, 0.28, -0.05, '#c9c4b8'),
    ...[-0.36, -0.12, 0.12, 0.36].map((x) => box(0.2, 0.06, 0.12, x, 0.05, 0.22, '#c9b27a')),
    ...[-0.24, 0, 0.24].map((x) => box(0.2, 0.06, 0.12, x, 0.11, 0.22, '#bfa76f')),
    box(0.03, 0.42, 0.03, 0.42, 0.29, -0.28, '#f4f4f2'), ...[0, 1, 2, 3].map((i) => box(0.032, 0.02, 0.032, 0.42, 0.16 + i * 0.08, -0.28, i % 2 ? '#d9443b' : '#26292e')),
  ]);
}

/**
 * Embassy (2×2): a white classical building with columns and a pediment, flags of the towns on poles in front,
 * a fence with a gate, a fountain and a guard box.
 */
export function embassyGeometry(): THREE.BufferGeometry {
  const W = '#f1ece0', TRIM = '#d8cfb8', ROOF = '#6b6f75';
  const flags = ['#d9443b', '#3b78c2', '#4c9a52', '#f2b33d'];
  return merge([
    box(1.96, 0.02, 1.96, 0, 0.01, 0, PAVE),
    box(1.5, 0.08, 1.0, 0, 0.04, -0.3, TRIM),
    box(1.4, 0.62, 0.9, 0, 0.39, -0.35, W),
    box(1.46, 0.05, 0.96, 0, 0.72, -0.35, TRIM),
    shape('wedge', 0.9, 0.22, 0.25, 0, 0.855, 0.0, ROOF), (() => { const g = shape('wedge', 0.9, 0.22, 0.25, 0, 0, 0, ROOF); g.rotateY(Math.PI); g.translate(0, 0.855, -0.7); return g; })(),
    box(1.46, 0.22, 0.45, 0, 0.855, -0.35, ROOF),
    // the portico: six columns, a pediment and the steps
    box(0.9, 0.05, 0.3, 0, 0.66, 0.24, TRIM),
    shape('wedge', 0.9, 0.2, 0.06, 0, 0.785, 0.36, W),
    ...[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((x) => shape('cylinder', 0.06, 0.56, 0.06, x, 0.36, 0.3, '#faf7ef', 'y', 10)),
    ...[0, 1, 2].map((i) => box(0.96, 0.03, 0.08, 0, 0.015 + i * 0.03, 0.46 - i * 0.07, TRIM)),
    box(0.16, 0.3, 0.012, 0, 0.23, 0.101, '#5c3a21'),
    // windows in rows
    ...[-0.6, -0.42, 0.42, 0.6].flatMap((x) => [box(0.1, 0.16, 0.012, x, 0.3, 0.101, '#a8d0e6'), box(0.1, 0.14, 0.012, x, 0.55, 0.101, '#a8d0e6')]),
    // flags of the towns
    ...flags.flatMap((c, i) => [box(0.02, 0.62, 0.02, -0.7 + i * 0.16, 0.31, 0.78, '#9aa3ab'), box(0.12, 0.08, 0.008, -0.64 + i * 0.16, 0.56, 0.78, c)]),
    // a fountain and a fence with a gate
    shape('cylinder', 0.3, 0.06, 0.3, 0.55, 0.05, 0.68, '#c9c4b8', 'y', 14), shape('cylinder', 0.24, 0.02, 0.24, 0.55, 0.08, 0.68, '#4fa3d1', 'y', 14), shape('cylinder', 0.04, 0.16, 0.04, 0.55, 0.14, 0.68, '#c9c4b8', 'y', 8),
    box(1.9, 0.08, 0.02, 0, 0.06, 0.97, '#2a2d31'), ...[-0.9, -0.6, -0.3, 0.3, 0.6, 0.9].map((x) => box(0.03, 0.14, 0.03, x, 0.07, 0.97, '#2a2d31')),
    box(0.16, 0.24, 0.16, 0.86, 0.12, 0.82, '#e9eef2'), box(0.18, 0.03, 0.18, 0.86, 0.255, 0.82, ROOF),
  ]);
}

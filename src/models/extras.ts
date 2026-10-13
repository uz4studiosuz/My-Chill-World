import * as THREE from 'three';
import { box, merge } from '../utils/voxel';

// Leisure buildings and town decorations. Models face +z; size 1 → ±0.5, size 2 → ±1, size 3 → ±1.5.

const GRASS = '#76b04f';
const PAVING = '#d9cfae';
const WOOD = '#8a5a35';
const METAL = '#5d6670';

const shrub = (x: number, z: number, s = 1, c = '#4f8a3a') => [
  box(0.05 * s, 0.12 * s, 0.05 * s, x, 0.06 * s, z, '#6b4a2e'),
  box(0.22 * s, 0.2 * s, 0.22 * s, x, 0.2 * s, z, c),
  box(0.14 * s, 0.1 * s, 0.14 * s, x, 0.33 * s, z, c),
];

/** Children's playground: swings, slide, sandbox and a see-saw. */
export function playgroundGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, '#c9a46a'),
    // swings
    box(0.03, 0.34, 0.03, -0.4, 0.17, -0.3, '#d9443b'), box(0.03, 0.34, 0.03, -0.06, 0.17, -0.3, '#d9443b'),
    box(0.38, 0.03, 0.03, -0.23, 0.34, -0.3, '#d9443b'),
    box(0.008, 0.2, 0.008, -0.3, 0.23, -0.3, '#cccccc'), box(0.008, 0.2, 0.008, -0.16, 0.23, -0.3, '#cccccc'),
    box(0.1, 0.015, 0.06, -0.3, 0.13, -0.3, '#f2c230'), box(0.1, 0.015, 0.06, -0.16, 0.13, -0.3, '#3a6fd1'),
    // slide
    box(0.16, 0.24, 0.16, 0.28, 0.12, -0.28, '#3a6fd1'),
    box(0.16, 0.03, 0.16, 0.28, 0.255, -0.28, '#f2c230'),
    box(0.1, 0.03, 0.36, 0.28, 0.14, -0.04, '#e85a3a'),
    box(0.03, 0.26, 0.03, 0.22, 0.13, -0.38, '#cccccc'), box(0.03, 0.26, 0.03, 0.34, 0.13, -0.38, '#cccccc'),
    // sandbox
    box(0.36, 0.04, 0.3, -0.24, 0.03, 0.22, WOOD),
    box(0.3, 0.045, 0.24, -0.24, 0.035, 0.22, '#ecd9a0'),
    box(0.06, 0.05, 0.06, -0.3, 0.07, 0.2, '#e85a7a'),
    // see-saw
    box(0.04, 0.06, 0.04, 0.28, 0.03, 0.26, METAL),
    box(0.4, 0.025, 0.06, 0.28, 0.07, 0.26, '#4c9a52'),
    // low fence
    box(0.025, 0.1, 0.92, -0.46, 0.05, 0, '#e8e3d6'),
    box(0.025, 0.1, 0.92, 0.46, 0.05, 0, '#e8e3d6'),
    box(0.92, 0.1, 0.025, 0, 0.05, -0.46, '#e8e3d6'),
  ]);
}

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

/** Open-air cinema (2×2): a big screen, rows of benches and a ticket booth. */
export function cinemaGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#6d6a62'),
    box(1.94, 0.022, 0.4, 0, 0.012, 0.78, PAVING),
    // screen frame (the glowing picture is a separate mesh)
    box(1.5, 0.06, 0.06, 0, 1.0, -0.82, '#26292e'),
    box(1.5, 0.06, 0.06, 0, 0.18, -0.82, '#26292e'),
    box(0.06, 0.88, 0.06, -0.74, 0.59, -0.82, '#26292e'), box(0.06, 0.88, 0.06, 0.74, 0.59, -0.82, '#26292e'),
    box(1.44, 0.78, 0.02, 0, 0.59, -0.84, '#3d4148'),
    // benches
    ...[-0.25, 0.05, 0.35].flatMap((z) => [-0.45, 0.45].flatMap((x) => [
      box(0.6, 0.04, 0.12, x, 0.08, z, '#b0478f'),
      box(0.6, 0.1, 0.03, x, 0.13, z + 0.06, '#8a2f6a'),
      box(0.03, 0.08, 0.1, x - 0.28, 0.04, z, METAL), box(0.03, 0.08, 0.1, x + 0.28, 0.04, z, METAL),
    ])),
    // ticket booth
    box(0.26, 0.28, 0.22, 0.75, 0.14, 0.75, '#f2c230'),
    box(0.3, 0.04, 0.26, 0.75, 0.3, 0.75, '#d9443b'),
    box(0.1, 0.08, 0.02, 0.75, 0.18, 0.865, '#a8d0e6'),
    // projector
    box(0.12, 0.2, 0.12, 0, 0.1, 0.62, '#3d4148'),
    box(0.1, 0.07, 0.14, 0, 0.24, 0.6, '#26292e'),
    box(0.025, 0.5, 0.025, -0.92, 0.25, 0.6, METAL), box(0.025, 0.5, 0.025, 0.92, 0.25, 0.6, METAL),
  ];
  return merge(parts);
}

export function cinemaScreenGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(1.4, 0.74).translate(0, 0.59, -0.828);
}

/** Academy (2×2): columns, a dome and a small sports ground. */
export function academyGeometry(): THREE.BufferGeometry {
  const wall = '#efe6d2', trim = '#d8cdb5', roof = '#2d4f8a';
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#bdb7aa'),
    box(1.5, 0.7, 0.8, 0, 0.35, -0.5, wall),
    box(1.58, 0.06, 0.88, 0, 0.73, -0.5, trim),
    box(1.6, 0.1, 0.25, 0, 0.62, 0.0, trim),
    box(0.5, 0.25, 0.5, 0, 0.88, -0.5, roof),
    box(0.3, 0.15, 0.3, 0, 1.06, -0.5, roof),
    box(0.03, 0.18, 0.03, 0, 1.2, -0.5, '#d4af37'),
    ...[-0.6, -0.3, 0, 0.3, 0.6].map((x) => box(0.07, 0.56, 0.07, x, 0.3, 0.0, '#f4f1ea')),
    box(1.5, 0.04, 0.3, 0, 0.02, 0.05, trim),
    box(0.22, 0.32, 0.02, 0, 0.16, -0.095, '#6b4a2e'),
    ...[-0.5, -0.25, 0.25, 0.5].flatMap((x) => [box(0.14, 0.14, 0.02, x, 0.3, -0.095, '#a8d0e6'), box(0.14, 0.12, 0.02, x, 0.55, -0.095, '#a8d0e6')]),
    box(1.6, 0.022, 0.5, 0, 0.012, 0.62, '#c4553d'),
    box(1.3, 0.024, 0.3, 0, 0.014, 0.62, '#4f9a3e'),
    box(0.02, 0.1, 0.2, -0.6, 0.06, 0.62, '#ffffff'), box(0.02, 0.1, 0.2, 0.6, 0.06, 0.62, '#ffffff'),
  ]);
}

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

export function fountainJetGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.04, 0.3, 0.04, 0, 0.4, 0, '#bfe3ff'),
    box(0.12, 0.05, 0.12, 0, 0.55, 0, '#d8efff'),
    box(0.3, 0.03, 0.03, 0, 0.36, 0, '#bfe3ff'),
    box(0.03, 0.03, 0.3, 0, 0.36, 0, '#bfe3ff'),
  ]);
}

/** Flower bed in a stone border. */
export function flowerbedGeometry(variant = 0): THREE.BufferGeometry {
  const sets = [['#e85a7a', '#f2c230', '#f2efe2'], ['#b0478f', '#e85a3a', '#f2c230'], ['#e07ba8', '#6f9fc8', '#f2efe2']];
  const cols = sets[variant % sets.length];
  const parts = [
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.8, 0.06, 0.8, 0, 0.03, 0, '#cfc8b6'),
    box(0.72, 0.065, 0.72, 0, 0.034, 0, '#6b4a2e'),
  ];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const x = -0.3 + i * 0.1, z = -0.3 + j * 0.1;
    const r = Math.hypot(x, z);
    parts.push(box(0.05, 0.05, 0.05, x, 0.09 + (r < 0.15 ? 0.04 : 0), z, r < 0.15 ? cols[2] : cols[(i + j) % 2]));
    if ((i + j) % 2 === 0) parts.push(box(0.03, 0.04, 0.03, x, 0.06, z, '#4f8a3a'));
  }
  return merge(parts);
}

/** Statue on a pedestal: a figure with a raised arm. */
export function statueGeometry(): THREE.BufferGeometry {
  const bronze = '#9a7b4f', stone = '#cfc8b6';
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVING),
    box(0.46, 0.08, 0.46, 0, 0.04, 0, stone),
    box(0.3, 0.3, 0.3, 0, 0.23, 0, '#e2dccd'),
    box(0.34, 0.04, 0.34, 0, 0.4, 0, stone),
    box(0.06, 0.16, 0.06, -0.04, 0.5, 0, bronze), box(0.06, 0.16, 0.06, 0.04, 0.5, 0, bronze),
    box(0.16, 0.2, 0.1, 0, 0.68, 0, bronze),
    box(0.1, 0.1, 0.1, 0, 0.83, 0, bronze),
    box(0.04, 0.2, 0.04, 0.1, 0.86, 0, bronze),
    box(0.04, 0.12, 0.04, -0.1, 0.62, 0.02, bronze),
    box(0.16, 0.06, 0.02, 0, 0.24, 0.155, '#d4af37'),
    ...shrub(-0.36, 0.36, 0.5), ...shrub(0.36, 0.36, 0.5),
  ]);
}

/** Two park benches and a litter bin. */
export function benchGeometry(): THREE.BufferGeometry {
  const bench = (x: number, z: number) => [
    box(0.4, 0.03, 0.12, x, 0.1, z, WOOD), box(0.4, 0.12, 0.03, x, 0.17, z - 0.06, WOOD),
    box(0.03, 0.09, 0.1, x - 0.17, 0.045, z, METAL), box(0.03, 0.09, 0.1, x + 0.17, 0.045, z, METAL),
  ];
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.9, 0.022, 0.3, 0, 0.012, 0.1, PAVING),
    ...bench(-0.2, -0.05), ...bench(0.25, -0.05),
    box(0.08, 0.14, 0.08, 0.44, 0.07, 0.1, '#4c9a52'),
    ...shrub(-0.3, -0.35, 0.6), ...shrub(0.3, -0.35, 0.6, '#5f9a3e'),
  ]);
}

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

export function lampHeadGeometry(): THREE.BufferGeometry {
  return merge([box(0.08, 0.09, 0.08, -0.15, 0.55, 0), box(0.08, 0.09, 0.08, 0.15, 0.55, 0)]);
}

/** A young tree: plane tree (chinor) or fir (archa). */
export function saplingGeometry(kind = 0): THREE.BufferGeometry {
  if (kind % 2 === 0) {
    return merge([
      box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
      box(0.3, 0.025, 0.3, 0, 0.015, 0, '#6b4a2e'),
      box(0.08, 0.5, 0.08, 0, 0.25, 0, '#7a5a3e'),
      box(0.6, 0.3, 0.6, 0, 0.6, 0, '#4f8a3a'),
      box(0.44, 0.2, 0.44, 0, 0.82, 0, '#5f9a3e'),
      box(0.3, 0.16, 0.7, 0, 0.55, 0, '#4f8a3a'),
    ]);
  }
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.3, 0.025, 0.3, 0, 0.015, 0, '#6b4a2e'),
    box(0.07, 0.2, 0.07, 0, 0.1, 0, '#6b4a2e'),
    box(0.5, 0.2, 0.5, 0, 0.3, 0, '#2d5a32'),
    box(0.38, 0.2, 0.38, 0, 0.5, 0, '#336b3a'),
    box(0.24, 0.2, 0.24, 0, 0.7, 0, '#3a7a42'),
    box(0.1, 0.12, 0.1, 0, 0.86, 0, '#3a7a42'),
  ]);
}

/** Road signs with a flower box. */
export function signGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, GRASS),
    box(0.03, 0.42, 0.03, 0.3, 0.21, 0.35, METAL),
    box(0.18, 0.18, 0.02, 0.3, 0.46, 0.36, '#3a6fd1'),
    box(0.1, 0.03, 0.022, 0.3, 0.46, 0.362, '#ffffff'),
    box(0.03, 0.42, 0.03, -0.3, 0.21, 0.35, METAL),
    box(0.16, 0.16, 0.02, -0.3, 0.46, 0.36, '#d9443b'),
    box(0.1, 0.03, 0.022, -0.3, 0.46, 0.362, '#ffffff'),
    box(0.5, 0.08, 0.16, 0, 0.04, -0.25, WOOD),
    ...[-0.18, -0.06, 0.06, 0.18].map((x, i) => box(0.06, 0.06, 0.06, x, 0.1, -0.25, ['#e85a7a', '#f2c230', '#f2efe2', '#b0478f'][i])),
  ]);
}

/** New Year fir with baubles. */
export function festiveTreeGeometry(): THREE.BufferGeometry {
  const parts = [
    box(0.1, 0.2, 0.1, 0, 0.1, 0, '#6b4a2e'),
    box(0.8, 0.3, 0.8, 0, 0.35, 0, '#2d5a32'),
    box(0.62, 0.3, 0.62, 0, 0.62, 0, '#336b3a'),
    box(0.44, 0.28, 0.44, 0, 0.88, 0, '#3a7a42'),
    box(0.26, 0.24, 0.26, 0, 1.12, 0, '#3a7a42'),
    box(0.1, 0.1, 0.1, 0, 1.3, 0, '#f2c230'),
  ];
  const cols = ['#d9443b', '#f2c230', '#3a6fd1', '#e85a7a', '#ffffff'];
  for (let i = 0; i < 24; i++) {
    const lv = i % 4, a = i * 2.4, r = [0.41, 0.32, 0.23, 0.14][lv];
    parts.push(box(0.05, 0.05, 0.05, Math.cos(a) * r, 0.3 + lv * 0.27, Math.sin(a) * r, cols[i % cols.length]));
  }
  return merge(parts);
}

/** Navruz: a flower mound with a sumalak cauldron. */
export function navruzGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.0, 0.08, 1.0, 0, 0.04, 0, '#cfc8b6'),
    box(0.9, 0.1, 0.9, 0, 0.09, 0, '#6b4a2e'),
    box(0.6, 0.1, 0.6, 0, 0.18, 0, '#6b4a2e'),
    box(0.22, 0.14, 0.22, 0, 0.3, 0, '#3d4148'),
    box(0.18, 0.02, 0.18, 0, 0.375, 0, '#7a4a2a'),
  ];
  const cols = ['#e85a7a', '#f2c230', '#f2efe2', '#b0478f', '#e85a3a'];
  for (let i = 0; i < 40; i++) {
    const a = i * 0.7, r = i < 24 ? 0.4 : 0.26, y = i < 24 ? 0.16 : 0.25;
    parts.push(box(0.06, 0.06, 0.06, Math.cos(a) * r, y, Math.sin(a) * r, cols[i % cols.length]));
  }
  return merge(parts);
}

/** Stretcher with a patient (carried by a paramedic). */
export function stretcherGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.08, 0.015, 0.26, 0, 0.1, 0.12, '#f2f4f6'),
    box(0.07, 0.03, 0.2, 0, 0.12, 0.13, '#6f9fc8'),
    box(0.05, 0.04, 0.05, 0, 0.125, 0.23, '#f1d2b0'),
    box(0.01, 0.01, 0.3, -0.045, 0.095, 0.12, METAL), box(0.01, 0.01, 0.3, 0.045, 0.095, 0.12, METAL),
  ]);
}

/** Flowers and ribbons on a wedding car. */
export function weddingDecorGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.1, 0.03, 0.06, 0, 0.18, -0.02, '#f2efe2'),
    box(0.04, 0.035, 0.04, -0.03, 0.2, -0.02, '#e85a7a'),
    box(0.04, 0.035, 0.04, 0.03, 0.2, -0.02, '#e07ba8'),
    box(0.012, 0.008, 0.3, -0.05, 0.1, 0.0, '#e85a7a'),
    box(0.012, 0.008, 0.3, 0.05, 0.1, 0.0, '#e85a7a'),
    box(0.06, 0.04, 0.02, 0, 0.08, 0.16, '#f2efe2'),
  ]);
}

/** Two-colour beacon on an emergency vehicle's roof (tinted per frame). */
export function beaconGeometry(): THREE.BufferGeometry {
  return merge([box(0.05, 0.035, 0.035, -0.03, 0.19, 0.0, '#ff3b30'), box(0.05, 0.035, 0.035, 0.03, 0.19, 0.0, '#3a7bff')]);
}

/** Soft light cone in front of a car (headlights at night). */
export function headlightGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.26, 0.5).rotateX(-Math.PI / 2).translate(0, 0.036, 0.4);
  return g;
}

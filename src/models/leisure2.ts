import * as THREE from 'three';
import { box, cylX, merge, shape } from '../utils/voxel';

// Leisure, faith and services: casino, mosque, amusement park, central park, gym, teahouse, barber. Models face +z.

const PAVE = '#bdb7aa';
const GRASS = '#7fb85a';
const GOLD = '#e3bf4f';

function tree(x: number, z: number, h = 0.5, leaf = '#4f8f3a') {
  return [
    shape('cylinder', 0.06, h * 0.5, 0.06, x, h * 0.25, z, '#6b4a2e', 'y', 6),
    shape('sphere', h * 0.6, h * 0.6, h * 0.6, x, h * 0.62, z, leaf, 'y', 8),
  ];
}

/** Casino: dark hall with golden trim, a lit sign and a canopy. */
export function casinoGeometry(): THREE.BufferGeometry {
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#3a3540'),
    box(1.6, 0.7, 1.0, 0, 0.35, -0.4, '#3b2a55'),
    box(1.66, 0.06, 1.06, 0, 0.73, -0.4, GOLD),
    box(1.0, 0.25, 0.7, 0, 0.88, -0.45, '#2c1f42'),
    shape('dome', 0.6, 0.25, 0.6, 0, 1.0, -0.45, GOLD, 'y', 16),
    box(1.2, 0.18, 0.04, 0, 0.58, 0.11, '#d9443b'),
    ...[-0.45, -0.15, 0.15, 0.45].map((x) => box(0.14, 0.08, 0.05, x, 0.58, 0.13, '#ffe066')),
    box(0.5, 0.36, 0.02, 0, 0.18, 0.105, '#f2b33d'),
    box(1.0, 0.04, 0.5, 0, 0.42, 0.36, '#2c1f42'),
    ...[-0.45, 0.45].map((x) => shape('cylinder', 0.05, 0.42, 0.05, x, 0.21, 0.58, GOLD, 'y', 8)),
    box(0.3, 0.012, 0.9, 0, 0.026, 0.5, '#b0303a'),
    ...[-0.8, 0.8].flatMap((x) => [shape('cylinder', 0.04, 0.5, 0.04, x, 0.25, 0.75, '#26292e', 'y', 6), shape('sphere', 0.12, 0.12, 0.12, x, 0.55, 0.75, '#ffe066', 'y', 8)]),
  ]);
}

/** Mosque: courtyard, prayer hall with a blue dome, arched portal and a minaret. */
export function mosqueGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#d8cfbd'),
    box(1.2, 0.5, 1.0, -0.1, 0.25, -0.4, '#efe6d2'),
    box(1.26, 0.05, 1.06, -0.1, 0.52, -0.4, '#c9b48a'),
    shape('cylinder', 0.6, 0.14, 0.6, -0.1, 0.61, -0.4, '#efe6d2', 'y', 18),
    shape('dome', 0.62, 0.42, 0.62, -0.1, 0.68, -0.4, '#2f7fc1', 'y', 20),
    shape('cone', 0.06, 0.16, 0.06, -0.1, 1.17, -0.4, GOLD, 'y', 8),
    // portal (pishtaq) with a pointed arch
    box(0.62, 0.72, 0.16, -0.1, 0.36, 0.14, '#e6dcc4'),
    box(0.34, 0.42, 0.02, -0.1, 0.21, 0.225, '#2f7fc1'),
    box(0.22, 0.32, 0.025, -0.1, 0.17, 0.23, '#6b4a2e'),
    box(0.66, 0.05, 0.2, -0.1, 0.745, 0.14, '#2f7fc1'),
    ...[-0.36, 0.16].map((x) => box(0.05, 0.6, 0.18, x, 0.3, 0.14, '#3f9ad6')),
    // minaret
    shape('cylinder', 0.18, 1.5, 0.18, 0.72, 0.75, -0.62, '#e6dcc4', 'y', 12),
    shape('cylinder', 0.26, 0.06, 0.26, 0.72, 1.32, -0.62, '#2f7fc1', 'y', 12),
    shape('cylinder', 0.15, 0.22, 0.15, 0.72, 1.46, -0.62, '#efe6d2', 'y', 12),
    shape('cone', 0.2, 0.26, 0.2, 0.72, 1.7, -0.62, '#2f7fc1', 'y', 12),
    ...[0.3, 0.6, 0.9].map((y) => shape('cylinder', 0.19, 0.03, 0.19, 0.72, y, -0.62, '#3f9ad6', 'y', 12)),
    // courtyard: a fountain for ablutions and two trees
    shape('cylinder', 0.3, 0.06, 0.3, 0.55, 0.05, 0.45, '#cfc6b1', 'y', 14),
    shape('cylinder', 0.24, 0.02, 0.24, 0.55, 0.08, 0.45, '#5fb2e0', 'y', 14),
    ...tree(-0.75, 0.6, 0.45), ...tree(-0.55, 0.78, 0.38),
    // windows along the hall
    ...[-0.5, -0.3, 0.1, 0.3].map((x) => box(0.08, 0.16, 0.02, x, 0.3, 0.105, '#2f7fc1')),
  ];
  return merge(parts);
}

/** Amusement park (4×4): entrance gate, roller coaster, stalls, trees. The ferris wheel and carousel are separate meshes. */
export function themeparkGeometry(): THREE.BufferGeometry {
  const parts = [
    box(3.94, 0.02, 3.94, 0, 0.01, 0, GRASS),
    box(0.5, 0.015, 3.6, 0, 0.025, 0.1, PAVE),
    box(3.4, 0.015, 0.45, 0, 0.025, 0.2, PAVE),
    // gate
    ...[-0.4, 0.4].map((x) => box(0.1, 0.6, 0.1, x, 0.3, 1.85, '#d9443b')),
    box(0.95, 0.16, 0.08, 0, 0.62, 1.85, '#f2b33d'),
    box(0.7, 0.06, 0.09, 0, 0.62, 1.86, '#d9443b'),
    // ferris wheel stand
    ...[-0.12, 0.12].map((x) => box(0.05, 1.1, 0.05, -1.1 + x, 0.55, -1.15, '#9aa3ab')),
    box(0.6, 0.06, 0.4, -1.1, 0.03, -1.15, '#8e96a1'),
    // carousel base
    shape('cylinder', 0.9, 0.08, 0.9, 1.05, 0.04, 1.0, '#e9e2d0', 'y', 20),
    // roller coaster: a looping track on posts
    ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => {
      const x = 0.4 + i * 0.2, h = 0.35 + Math.sin(i * 0.9) * 0.25 + 0.25;
      return [box(0.03, h, 0.03, x, h / 2, -1.45, '#5d6670'), box(0.22, 0.04, 0.12, x, h, -1.45, '#d9443b')];
    }),
    ...[0, 1, 2, 3, 4, 5].flatMap((i) => {
      const z = -1.3 + i * 0.2, h = 0.3 + Math.cos(i) * 0.15 + 0.2;
      return [box(0.03, h, 0.03, 1.8, h / 2, z, '#5d6670'), box(0.12, 0.04, 0.22, 1.8, h, z, '#d9443b')];
    }),
    // stalls: candy floss, ice cream, tickets
    ...[[-1.35, 0.75, '#f28cb8'], [-0.85, 0.75, '#6fb6ff'], [-1.35, 1.45, '#7be08f']].flatMap(([x, z, c]) => [
      box(0.32, 0.22, 0.26, x as number, 0.11, z as number, '#f4f1ea'),
      shape('wedge', 0.38, 0.1, 0.32, x as number, 0.27, z as number, c as string),
    ]),
    // swing ride
    shape('cylinder', 0.06, 0.8, 0.06, 1.05, 0.4, -0.35, '#9aa3ab', 'y', 8),
    shape('cone', 0.7, 0.18, 0.7, 1.05, 0.86, -0.35, '#f2b33d', 'y', 12),
    ...tree(-1.75, -0.2, 0.45), ...tree(-1.7, 0.3, 0.4), ...tree(1.75, 1.75, 0.45), ...tree(-1.75, -1.75, 0.5), ...tree(0.45, 1.65, 0.38),
    ...[-0.35, 0.35].map((x) => box(0.24, 0.07, 0.1, x, 0.06, -0.4, '#8a5a35')),
  ];
  return merge(parts);
}

/** The ferris wheel (turns around its axle, local z). */
export function ferrisWheelGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [cylX(0.04, 0.3, 0, 0, 0, '#5d6670', 8)];
  const R = 0.75, colors = ['#d9443b', '#6fb6ff', '#f2b33d', '#7be08f', '#f28cb8', '#b9a3e0'];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    parts.push(box(0.2, 0.025, 0.025, 0, 0, 0, '#f4f4f2').rotateZ(a + Math.PI / 2).translate(Math.cos(a) * R, Math.sin(a) * R, 0.06));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    parts.push(box(R, 0.015, 0.015, R / 2, 0, 0.06, '#cfd6dc').rotateZ(a));
    parts.push(box(0.12, 0.1, 0.1, Math.cos(a) * R, Math.sin(a) * R - 0.07, 0.06, colors[i % colors.length]));
  }
  return merge(parts);
}

/** The carousel top (turns around y). */
export function carouselGeometry(): THREE.BufferGeometry {
  const parts = [
    shape('cylinder', 0.1, 0.55, 0.1, 0, 0.36, 0, '#f2b33d', 'y', 10),
    shape('cone', 1.0, 0.3, 1.0, 0, 0.78, 0, '#d9443b', 'y', 16),
    shape('cylinder', 1.0, 0.06, 1.0, 0, 0.62, 0, '#f4f1ea', 'y', 16),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62;
    parts.push(shape('cylinder', 0.02, 0.5, 0.02, x, 0.36, z, GOLD, 'y', 6));
    parts.push(box(0.1, 0.1, 0.22, x, 0.24, z, i % 2 ? '#f4f4f2' : '#8a5a35').rotateY(0));
  }
  return merge(parts);
}

/** Central park (3×3): lawns, a pond with a bridge, a pavilion, benches and lots of trees. */
export function bigparkGeometry(): THREE.BufferGeometry {
  const parts = [
    box(2.94, 0.02, 2.94, 0, 0.01, 0, '#86c062'),
    box(0.3, 0.012, 2.9, 0.15, 0.024, 0, '#d8cfb2'),
    box(2.9, 0.012, 0.3, 0, 0.024, 0.55, '#d8cfb2'),
    shape('cylinder', 1.0, 0.02, 0.7, -0.75, 0.024, -0.6, '#5fb2e0', 'y', 20),
    box(0.5, 0.05, 0.12, -0.75, 0.06, -0.6, '#8a5a35'),
    // pavilion (shiyponcha)
    shape('cylinder', 0.6, 0.06, 0.6, 0.85, 0.04, -0.75, '#e9e2d0', 'y', 12),
    ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return shape('cylinder', 0.04, 0.4, 0.04, 0.85 + Math.cos(a) * 0.25, 0.27, -0.75 + Math.sin(a) * 0.25, '#f4f4f2', 'y', 6); }),
    shape('cone', 0.75, 0.25, 0.75, 0.85, 0.58, -0.75, '#2f7fc1', 'y', 6),
    ...[-0.9, -0.45, 0.6, 1.05].map((x) => box(0.24, 0.07, 0.08, x, 0.06, 0.82, '#8a5a35')),
    ...tree(-1.2, 0.3, 0.55), ...tree(-0.6, 0.25, 0.45), ...tree(1.2, 0.2, 0.5), ...tree(0.7, 1.15, 0.45), ...tree(-1.1, 1.15, 0.5),
    ...tree(-0.2, 1.2, 0.4, '#3f7a30'), ...tree(1.25, -1.25, 0.5, '#3f7a30'), ...tree(-1.25, -1.25, 0.45), ...tree(0.45, -1.2, 0.4),
    ...[[-0.4, 1.3, '#f28cb8'], [1.2, 0.85, '#f2b33d'], [-1.3, -0.1, '#d9443b']].map(([x, z, c]) => box(0.3, 0.05, 0.2, x as number, 0.04, z as number, c as string)),
  ];
  return merge(parts);
}

/** Gym: glass-front hall with a dumbbell sign. */
export function gymGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.8, 0.5, 0.6, 0, 0.25, -0.12, '#3a4350'),
    box(0.84, 0.05, 0.64, 0, 0.525, -0.12, '#f07167'),
    box(0.66, 0.3, 0.02, 0, 0.2, 0.185, '#8fc1e3'),
    box(0.16, 0.26, 0.025, 0.24, 0.13, 0.19, '#26292e'),
    cylX(0.02, 0.3, 0, 0.44, 0.2, '#cfd6dc', 6), cylX(0.06, 0.04, -0.15, 0.44, 0.2, '#26292e', 10), cylX(0.06, 0.04, 0.15, 0.44, 0.2, '#26292e', 10),
    ...[-0.2, 0.0].map((x) => box(0.12, 0.05, 0.05, x, 0.08, 0.17, '#5d6670')),
  ]);
}

/** Teahouse (choyxona): blue-tiled hall, a terrace with carved columns and raised tapchans with red carpets. */
export function teahouseGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#d8cfbd'),
    box(1.5, 0.48, 0.7, 0, 0.24, -0.58, '#efe6d2'),
    box(1.56, 0.05, 0.76, 0, 0.505, -0.58, '#2f7fc1'),
    ...[-0.5, -0.17, 0.17, 0.5].map((x) => box(0.2, 0.26, 0.02, x, 0.24, -0.225, '#2f7fc1')),
    // aivan: terrace roof on carved wooden columns
    box(1.6, 0.05, 0.75, 0, 0.5, 0.15, '#8a5a35'),
    box(1.64, 0.04, 0.79, 0, 0.535, 0.15, '#6b4a2e'),
    ...[-0.75, -0.25, 0.25, 0.75].map((x) => shape('cylinder', 0.05, 0.48, 0.05, x, 0.25, 0.48, '#a8794d', 'y', 8)),
    // tapchans
    ...[-0.45, 0.45].flatMap((x) => [
      box(0.5, 0.1, 0.42, x, 0.07, 0.15, '#8a5a35'),
      box(0.46, 0.015, 0.38, x, 0.125, 0.15, '#b0303a'),
      box(0.18, 0.04, 0.18, x, 0.15, 0.15, '#6b4a2e'),
      shape('cylinder', 0.05, 0.04, 0.05, x, 0.19, 0.15, '#f4f4f2', 'y', 8),
    ]),
    // samovar and a plov kazan by the side
    shape('cylinder', 0.1, 0.16, 0.1, 0.82, 0.1, 0.72, GOLD, 'y', 10),
    shape('cone', 0.06, 0.06, 0.06, 0.82, 0.21, 0.72, GOLD, 'y', 8),
    shape('cylinder', 0.22, 0.08, 0.22, -0.8, 0.07, 0.75, '#5d6670', 'y', 12),
    shape('dome', 0.24, 0.06, 0.24, -0.8, 0.11, 0.75, '#26292e', 'y', 12),
    ...tree(0.85, -0.15, 0.4), ...tree(-0.85, -0.12, 0.38),
  ];
  return merge(parts);
}

/** Barber shop: small shop with a striped pole. */
export function barberGeometry(): THREE.BufferGeometry {
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, PAVE),
    box(0.66, 0.42, 0.5, 0, 0.21, -0.12, '#f4f1ea'),
    box(0.72, 0.05, 0.56, 0, 0.445, -0.12, '#26292e'),
    box(0.46, 0.22, 0.02, -0.04, 0.16, 0.135, '#a8d0e6'),
    box(0.7, 0.04, 0.16, 0, 0.32, 0.2, '#d9443b'),
    box(0.68, 0.035, 0.165, 0, 0.29, 0.2, '#f4f4f2'),
    shape('cylinder', 0.05, 0.32, 0.05, 0.27, 0.18, 0.17, '#f4f4f2', 'y', 8),
    ...[0.08, 0.16, 0.24].map((y) => shape('cylinder', 0.055, 0.03, 0.055, 0.27, y, 0.17, y === 0.16 ? '#2f7fc1' : '#d9443b', 'y', 8)),
    shape('sphere', 0.07, 0.07, 0.07, 0.27, 0.36, 0.17, '#f4f4f2', 'y', 8),
    box(0.16, 0.07, 0.07, -0.25, 0.06, 0.25, '#8a5a35'),
  ]);
}

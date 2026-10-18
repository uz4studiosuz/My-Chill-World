import * as THREE from 'three';
import { box, cylX, merge, shape, turn } from '../quality';
import { PAVE } from './_shared';

/** A pitched roof: two wedges sloping to the front and to the back from a ridge along x. */
function gable(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  return [shape('wedge', w, h, d / 2, x, y, z + d / 4, color), turn(shape('wedge', w, h, d / 2, x, y, z - d / 4, color), x, y, z - d / 4, 0, 180, 0)];
}

/**
 * Greenhouse (2×2): two long glass tunnels on white ribs, tomato and cucumber rows showing through,
 * a little potting shed, a water tank on legs and crates of vegetables by the door. Works all year.
 */
export function greenhouseGeometry(): THREE.BufferGeometry {
  const glass = '#cfeef2', rib = '#f4f6f6', leaf = '#4e9a3c';
  const tunnel = (z: number) => [
    // the tunnel is half a lying cylinder: its lower half stays under the ground
    cylX(0.34, 1.5, -0.12, 0.02, z, glass, 16),
    ...[-0.8, -0.5, -0.2, 0.1, 0.4, 0.62].map((x) => cylX(0.35, 0.025, x, 0.02, z, rib, 16)),
    box(1.52, 0.02, 0.02, -0.12, 0.37, z, rib),
    // plants showing through the glass ends, red tomatoes among them
    ...[-0.12, 0.12].map((dz) => box(1.3, 0.12, 0.08, -0.12, 0.07, z + dz, leaf)),
    ...[-0.6, -0.3, 0, 0.3].flatMap((x) => [box(0.03, 0.03, 0.03, x, 0.14, z - 0.12, '#e0412f'), box(0.03, 0.03, 0.03, x + 0.12, 0.14, z + 0.12, '#e0412f')]),
    // the glass door at the end
    box(0.02, 0.24, 0.14, 0.64, 0.12, z, '#8fc7cf'),
  ];
  return merge([
    box(1.96, 0.02, 1.96, 0, 0.01, 0, '#9c8f74'),
    box(1.96, 0.025, 0.16, 0, 0.013, 0, PAVE),
    ...tunnel(-0.5), ...tunnel(0.5),
    // potting shed with a sloping roof
    box(0.34, 0.3, 0.3, 0.8, 0.15, -0.72, '#b78a55'),
    box(0.4, 0.04, 0.36, 0.8, 0.32, -0.72, '#6b4b2f'),
    box(0.1, 0.18, 0.02, 0.8, 0.09, -0.565, '#5c3a21'),
    // water tank on legs
    ...[[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]].map(([dx, dz]) => box(0.02, 0.3, 0.02, 0.8 + dx, 0.15, 0.78 + dz, '#5d6670')),
    shape('cylinder', 0.2, 0.18, 0.2, 0.8, 0.39, 0.78, '#3b78c2', 'y', 12),
    // crates of vegetables
    ...[[0.72, 0.1], [0.86, 0.1], [0.79, -0.12]].flatMap(([x, z], i) => [
      box(0.12, 0.07, 0.1, x, 0.05, z, '#a8783f'),
      box(0.1, 0.03, 0.08, x, 0.1, z, ['#e0412f', '#5aa83c', '#f0a030'][i]),
    ]),
  ]);
}

/**
 * Apiary (1×1): a meadow with wildflowers, four painted beehives on stands, a little honey hut
 * with jars in the window and a sign with a bee.
 */
export function apiaryGeometry(): THREE.BufferGeometry {
  const hive = (x: number, z: number, col: string) => [
    box(0.02, 0.08, 0.02, x - 0.05, 0.04, z - 0.04, '#6b4b2f'), box(0.02, 0.08, 0.02, x + 0.05, 0.04, z + 0.04, '#6b4b2f'),
    box(0.14, 0.1, 0.12, x, 0.13, z, col), box(0.14, 0.08, 0.12, x, 0.22, z, col),
    box(0.16, 0.02, 0.14, x, 0.27, z, '#e9e2cf'), box(0.05, 0.01, 0.015, x, 0.1, z + 0.062, '#2b2622'),
  ];
  const flowers = [];
  for (let i = 0; i < 26; i++) {
    const x = ((i * 37) % 90) / 100 - 0.45, z = ((i * 53) % 90) / 100 - 0.45;
    if (Math.abs(x) < 0.25 && z < 0.1 && z > -0.42) continue;
    flowers.push(box(0.03, 0.03, 0.03, x, 0.04, z, ['#f2c84b', '#e8738f', '#ffffff', '#b07ad9'][i % 4]));
  }
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, '#7fb24f'),
    ...flowers,
    ...hive(-0.3, 0.22, '#f2c84b'), ...hive(-0.08, 0.3, '#ffffff'), ...hive(0.14, 0.22, '#7fbfe8'), ...hive(0.34, 0.32, '#f2a65a'),
    // honey hut
    box(0.4, 0.26, 0.28, 0, 0.13, -0.27, '#d8b27a'),
    ...gable(0.46, 0.14, 0.34, 0, 0.33, -0.27, '#a3482f'),
    box(0.1, 0.16, 0.02, -0.1, 0.08, -0.125, '#5c3a21'),
    box(0.12, 0.08, 0.02, 0.1, 0.15, -0.125, '#f2b33d'),
    ...[0.06, 0.1, 0.14].map((x) => box(0.025, 0.035, 0.02, x, 0.13, -0.115, '#e09a1e')),
    // sign with a bee
    box(0.02, 0.26, 0.02, 0.4, 0.13, -0.08, '#6b4b2f'),
    box(0.16, 0.1, 0.02, 0.4, 0.27, -0.08, '#f2c84b'),
    box(0.05, 0.03, 0.022, 0.4, 0.27, -0.08, '#2b2622'),
  ]);
}

/**
 * Poultry farm (2×2): a long red barn with white trim and a vented roof, a fenced yard with hens,
 * a feed silo and egg crates by the gate.
 */
export function poultryGeometry(): THREE.BufferGeometry {
  const hen = (x: number, z: number, white: boolean) => [
    box(0.07, 0.06, 0.09, x, 0.06, z, white ? '#f7f5ef' : '#a8662f'),
    box(0.04, 0.04, 0.04, x, 0.1, z + 0.05, white ? '#f7f5ef' : '#a8662f'),
    box(0.02, 0.02, 0.02, x, 0.13, z + 0.05, '#d9443b'),
    box(0.015, 0.012, 0.02, x, 0.1, z + 0.08, '#f2b33d'),
  ];
  const fence = [];
  for (let i = 0; i <= 8; i++) {
    const x = -0.9 + i * 0.225;
    fence.push(box(0.025, 0.14, 0.025, x, 0.07, 0.92, '#e9e2cf'));
  }
  fence.push(box(1.82, 0.02, 0.02, 0, 0.11, 0.92, '#e9e2cf'), box(1.82, 0.02, 0.02, 0, 0.05, 0.92, '#e9e2cf'));
  for (const x of [-0.9, 0.9]) fence.push(box(0.02, 0.02, 0.9, x, 0.11, 0.47, '#e9e2cf'), box(0.025, 0.14, 0.025, x, 0.07, 0.47, '#e9e2cf'));
  return merge([
    box(1.96, 0.02, 1.96, 0, 0.01, 0, '#a99b78'),
    // barn
    box(1.5, 0.36, 0.7, -0.15, 0.18, -0.48, '#b8452f'),
    box(1.52, 0.03, 0.72, -0.15, 0.02, -0.48, '#8d8a83'),
    ...gable(1.56, 0.2, 0.78, -0.15, 0.46, -0.48, '#6b6f75'),
    box(1.3, 0.05, 0.1, -0.15, 0.565, -0.48, '#8d9196'),
    ...[-0.7, -0.35, 0, 0.35].map((x) => box(0.16, 0.08, 0.012, x, 0.24, -0.125, '#f4f1ea')),
    box(0.22, 0.26, 0.015, 0.45, 0.13, -0.125, '#f4f1ea'), box(0.18, 0.22, 0.016, 0.45, 0.12, -0.12, '#7a3324'),
    // feed silo
    shape('cylinder', 0.26, 0.7, 0.26, 0.8, 0.35, -0.6, '#c9ccd0', 'y', 14),
    shape('cone', 0.28, 0.14, 0.28, 0.8, 0.77, -0.6, '#9aa0a6', 'y', 14),
    // the yard and its hens
    ...fence,
    ...[[-0.6, 0.2, true], [-0.35, 0.45, false], [-0.1, 0.25, true], [0.15, 0.55, true], [0.4, 0.3, false], [0.6, 0.6, true], [-0.5, 0.7, true]].flatMap(([x, z, w]) => hen(x as number, z as number, w as boolean)),
    box(0.3, 0.04, 0.08, -0.2, 0.04, 0.05, '#8a6a3f'),
    // egg crates by the gate
    ...[0.75, 0.88].map((x) => box(0.12, 0.05, 0.1, x, 0.045, 0.2, '#d8c49a')),
    ...[0.73, 0.77, 0.86, 0.9].map((x) => shape('sphere', 0.03, 0.04, 0.03, x, 0.08, 0.2, '#fbf6ea', 'y', 8)),
  ]);
}

/**
 * Out of season: the field or orchard is wrapped in canvas on its sides, held by wooden posts, with a
 * board at the front — it rests until its season comes back.
 */
export function restingCoverGeometry(size: number): THREE.BufferGeometry {
  const e = size / 2 - 0.05, len = size - 0.1, H = 0.42, post = '#6b4f35';
  const parts: THREE.BufferGeometry[] = [];
  // canvas panels between the posts, light and dark in turn, with a rope along the top
  const n = Math.max(2, Math.round(size * 2));
  const seg = len / n;
  for (let i = 0; i < n; i++) {
    const p = -e + seg * (i + 0.5), col = i % 2 ? '#cdbb8c' : '#e6d9b3';
    parts.push(box(seg, H, 0.03, p, H / 2 + 0.02, e, col), box(seg, H, 0.03, p, H / 2 + 0.02, -e, col),
      box(0.03, H, seg, e, H / 2 + 0.02, p, col), box(0.03, H, seg, -e, H / 2 + 0.02, p, col));
  }
  for (const s2 of [e, -e]) parts.push(box(len, 0.025, 0.045, 0, H + 0.03, s2, '#8a6a3f'), box(0.045, 0.025, len, s2, H + 0.03, 0, '#8a6a3f'));
  for (let i = 0; i <= n; i++) {
    const p = -e + seg * i;
    parts.push(box(0.05, H + 0.12, 0.05, p, (H + 0.12) / 2, e, post), box(0.05, H + 0.12, 0.05, p, (H + 0.12) / 2, -e, post),
      box(0.05, H + 0.12, 0.05, e, (H + 0.12) / 2, p, post), box(0.05, H + 0.12, 0.05, -e, (H + 0.12) / 2, p, post));
  }
  // the board at the front: closed for the season
  parts.push(box(0.04, H + 0.3, 0.04, -0.16, (H + 0.3) / 2, e + 0.06, post), box(0.04, H + 0.3, 0.04, 0.16, (H + 0.3) / 2, e + 0.06, post),
    box(0.42, 0.16, 0.03, 0, H + 0.2, e + 0.07, '#7a5a3a'), box(0.34, 0.05, 0.032, 0, H + 0.2, e + 0.07, '#d9443b'));
  return merge(parts);
}

import * as THREE from 'three';
import { box, cylX, merge, shape, turn } from '../quality';
import { PAVE } from './_shared';

/** A pitched roof: two wedges sloping to the front and to the back from a ridge along x. */
function gable(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  return [shape('wedge', w, h, d / 2, x, y, z + d / 4, color), turn(shape('wedge', w, h, d / 2, x, y, z - d / 4, color), x, y, z - d / 4, 0, 180, 0)];
}

/** A row of windows on the front (+z) face. */
function frontWindows(x0: number, x1: number, n: number, y: number, z: number, w = 0.1, h = 0.11, glass = '#9fc4d9') {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    out.push(box(w + 0.03, h + 0.03, 0.012, x, y, z, '#f4f1ea'), box(w, h, 0.016, x, y, z + 0.002, glass));
  }
  return out;
}

/** A small round tree. */
function tree(x: number, z: number, s = 1) {
  return [box(0.04 * s, 0.16 * s, 0.04 * s, x, 0.08 * s, z, '#6b4a2f'), shape('sphere', 0.22 * s, 0.22 * s, 0.22 * s, x, 0.24 * s, z, '#5f9a3e', 'y', 8)];
}

/**
 * Elder care home (2×2): a warm two-storey house with a long veranda, a ramp to the door, rocking benches,
 * a little garden with flower beds and a tree where the old people sit in the sun.
 */
export function eldercareGeometry(): THREE.BufferGeometry {
  const wall = '#ecd9b8', trim = '#8a5a3b', roof = '#9a4a3a';
  return merge([
    box(1.96, 0.02, 1.96, 0, 0.01, 0, '#86b25a'),
    box(1.96, 0.025, 0.5, 0, 0.013, 0.72, PAVE),
    // the house
    box(1.5, 0.62, 0.8, 0, 0.31, -0.4, wall),
    box(1.52, 0.04, 0.82, 0, 0.32, -0.4, trim),
    ...gable(1.6, 0.3, 0.92, 0, 0.77, -0.4, roof),
    ...frontWindows(-0.6, 0.6, 5, 0.47, 0.006),
    ...frontWindows(-0.6, -0.22, 2, 0.17, 0.006), ...frontWindows(0.22, 0.6, 2, 0.17, 0.006),
    // the veranda with its posts and roof, a ramp to the door
    box(1.5, 0.04, 0.3, 0, 0.04, 0.15, '#b98a5a'),
    ...[-0.7, -0.35, 0, 0.35, 0.7].map((x) => box(0.035, 0.26, 0.035, x, 0.18, 0.28, '#f4f1ea')),
    box(1.56, 0.03, 0.36, 0, 0.32, 0.14, roof),
    box(0.18, 0.24, 0.02, 0, 0.16, 0.01, '#5c3a21'), box(0.04, 0.04, 0.02, 0, 0.3, 0.012, '#f2c84b'),
    turn(box(0.2, 0.02, 0.34, 0, 0.03, 0.48, '#c9c3b6'), 0, 0.03, 0.48, 6, 0, 0),
    box(0.02, 0.08, 0.34, -0.11, 0.08, 0.48, '#8d8a83'), box(0.02, 0.08, 0.34, 0.11, 0.08, 0.48, '#8d8a83'),
    // a sign with a heart
    box(0.32, 0.08, 0.02, 0, 0.42, 0.33, '#f4f1ea'), box(0.05, 0.04, 0.022, -0.1, 0.42, 0.33, '#e05a6a'),
    // benches and the garden
    ...[-0.55, 0.55].flatMap((x) => [box(0.24, 0.03, 0.08, x, 0.08, 0.6, '#a8783f'), box(0.24, 0.07, 0.02, x, 0.12, 0.56, '#a8783f')]),
    ...[[-0.75, 0.85], [-0.35, 0.88], [0.35, 0.88], [0.75, 0.85]].map(([x, z]) => box(0.22, 0.05, 0.12, x, 0.035, z, '#7a5530')),
    ...[[-0.8, 0.85], [-0.7, 0.86], [-0.4, 0.88], [-0.3, 0.88], [0.3, 0.88], [0.4, 0.88], [0.7, 0.86], [0.8, 0.85]].map(([x, z], i) => box(0.04, 0.04, 0.04, x, 0.08, z, ['#e8738f', '#f2c84b', '#ffffff', '#b07ad9'][i % 4])),
    ...tree(0.85, 0.35, 1.1),
  ]);
}

/**
 * Restaurant (2×2): a smart dining hall with tall windows and a striped awning, tables with umbrellas on the
 * terrace, a chimney from the kitchen and a menu board by the door.
 */
export function restaurantGeometry(): THREE.BufferGeometry {
  const wall = '#7a3b2e', cream = '#f4ead8';
  const table = (x: number, z: number, col: string) => [
    shape('cylinder', 0.14, 0.02, 0.14, x, 0.1, z, '#f4f1ea', 'y', 10), box(0.015, 0.1, 0.015, x, 0.05, z, '#5d6670'),
    box(0.012, 0.3, 0.012, x, 0.2, z, '#5d6670'), shape('cone', 0.32, 0.1, 0.32, x, 0.37, z, col, 'y', 8),
    box(0.05, 0.05, 0.05, x - 0.12, 0.05, z, '#a8783f'), box(0.05, 0.05, 0.05, x + 0.12, 0.05, z, '#a8783f'),
  ];
  return merge([
    box(1.96, 0.02, 1.96, 0, 0.01, 0, PAVE),
    box(1.96, 0.026, 0.8, 0, 0.014, 0.55, '#d8c9a8'),
    box(1.6, 0.6, 0.95, 0, 0.3, -0.45, wall),
    box(1.64, 0.05, 0.99, 0, 0.62, -0.45, cream),
    box(1.5, 0.08, 0.86, 0, 0.66, -0.47, '#5a2a22'),
    ...frontWindows(-0.62, -0.18, 3, 0.26, 0.03, 0.11, 0.3, '#ffd89a'),
    ...frontWindows(0.18, 0.62, 3, 0.26, 0.03, 0.11, 0.3, '#ffd89a'),
    box(0.2, 0.34, 0.02, 0, 0.17, 0.03, '#2b1b16'), box(0.24, 0.04, 0.03, 0, 0.36, 0.035, '#d9a441'),
    // striped awning over the windows
    ...[-0.75, -0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6, 0.75].map((x, i) => turn(box(0.15, 0.02, 0.22, x, 0.5, 0.12, i % 2 ? cream : '#c0392b'), x, 0.5, 0.12, 20, 0, 0)),
    // sign and kitchen chimney
    box(0.6, 0.12, 0.03, 0, 0.56, 0.035, '#1f1a17'), box(0.5, 0.05, 0.032, 0, 0.56, 0.04, '#f2c84b'),
    box(0.14, 0.32, 0.14, 0.6, 0.82, -0.7, '#8d8a83'), box(0.18, 0.04, 0.18, 0.6, 0.99, -0.7, '#5d6670'),
    // menu board and planters
    box(0.02, 0.2, 0.12, 0.42, 0.1, 0.2, '#2b2622'), box(0.022, 0.12, 0.08, 0.425, 0.13, 0.2, '#f4f1ea'),
    ...table(-0.6, 0.6, '#c0392b'), ...table(-0.1, 0.72, '#f4ead8'), ...table(0.45, 0.62, '#c0392b'),
    ...[-0.85, 0.85].flatMap((x) => [box(0.14, 0.12, 0.14, x, 0.06, 0.3, '#8a6a4a'), shape('sphere', 0.18, 0.18, 0.18, x, 0.19, 0.3, '#4e8a3a', 'y', 8)]),
  ]);
}

/**
 * Zoo (3×3): a gate with a sign, paths between enclosures — giraffes by a tree, an elephant by its pool,
 * a lion on a rock, penguins on ice — fences, a kiosk and trees.
 */
export function zooGeometry(): THREE.BufferGeometry {
  const fence = (x0: number, z0: number, x1: number, z1: number) => {
    const out = [];
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.2));
    for (let i = 0; i <= n; i++) out.push(box(0.025, 0.12, 0.025, x0 + ((x1 - x0) * i) / n, 0.06, z0 + ((z1 - z0) * i) / n, '#7a5530'));
    out.push(box(Math.abs(x1 - x0) + 0.025, 0.02, Math.abs(z1 - z0) + 0.025, (x0 + x1) / 2, 0.1, (z0 + z1) / 2, '#7a5530'));
    return out;
  };
  const pen = (cx: number, cz: number, w: number, d: number, ground: string) => [
    box(w, 0.012, d, cx, 0.026, cz, ground),
    ...fence(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2), ...fence(cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2),
    ...fence(cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2), ...fence(cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2),
  ];
  const giraffe = (x: number, z: number) => [
    box(0.16, 0.1, 0.07, x, 0.22, z, '#e0b04a'), ...[[-0.06, -0.025], [0.06, -0.025], [-0.06, 0.025], [0.06, 0.025]].map(([dx, dz]) => box(0.022, 0.17, 0.022, x + dx, 0.085, z + dz, '#c89a3a')),
    turn(box(0.04, 0.26, 0.04, x + 0.09, 0.38, z, '#e0b04a'), x + 0.09, 0.38, z, 0, 0, -15), box(0.08, 0.04, 0.045, x + 0.15, 0.52, z, '#e0b04a'),
    ...[[-0.03, 0.02], [0.04, -0.02], [0.0, 0.03]].map(([dx, dy]) => box(0.03, 0.03, 0.072, x + dx, 0.23 + dy, z, '#8a5a2a')),
  ];
  const elephant = (x: number, z: number) => [
    box(0.26, 0.17, 0.16, x, 0.2, z, '#8d939a'), ...[[-0.09, -0.05], [0.09, -0.05], [-0.09, 0.05], [0.09, 0.05]].map(([dx, dz]) => box(0.05, 0.12, 0.05, x + dx, 0.06, z + dz, '#7d838a')),
    box(0.12, 0.12, 0.13, x + 0.17, 0.25, z, '#8d939a'), box(0.03, 0.14, 0.03, x + 0.24, 0.16, z, '#7d838a'),
    box(0.02, 0.1, 0.09, x + 0.13, 0.26, z - 0.08, '#9aa0a6'), box(0.02, 0.1, 0.09, x + 0.13, 0.26, z + 0.08, '#9aa0a6'),
  ];
  const lion = (x: number, z: number) => [
    box(0.32, 0.12, 0.26, x, 0.08, z, '#9a948a'),
    box(0.16, 0.07, 0.07, x, 0.18, z, '#d9a441'), box(0.08, 0.08, 0.08, x + 0.1, 0.22, z, '#a8662f'), box(0.05, 0.05, 0.05, x + 0.12, 0.22, z, '#d9a441'),
  ];
  const penguin = (x: number, z: number) => [box(0.04, 0.07, 0.035, x, 0.065, z, '#1f2328'), box(0.025, 0.05, 0.01, x, 0.06, z + 0.018, '#ffffff'), box(0.012, 0.008, 0.012, x, 0.1, z + 0.02, '#f2b33d')];
  return merge([
    box(2.96, 0.02, 2.96, 0, 0.01, 0, '#86b25a'),
    // paths
    box(0.34, 0.022, 2.96, 0, 0.012, 0, '#d8c9a8'), box(2.96, 0.022, 0.34, 0, 0.012, 0, '#d8c9a8'),
    // gate with sign
    box(0.06, 0.5, 0.06, -0.24, 0.25, 1.42, '#6b4a2f'), box(0.06, 0.5, 0.06, 0.24, 0.25, 1.42, '#6b4a2f'),
    box(0.6, 0.14, 0.05, 0, 0.5, 1.42, '#2f7a3a'), box(0.46, 0.05, 0.052, 0, 0.5, 1.425, '#f2c84b'),
    // enclosures
    ...pen(-0.8, -0.8, 1.1, 1.1, '#c9b27a'), ...giraffe(-0.95, -0.85), ...giraffe(-0.6, -0.6), ...tree(-1.1, -1.15, 1.4),
    ...pen(0.8, -0.8, 1.1, 1.1, '#9fb06a'), box(0.4, 0.015, 0.3, 0.95, 0.035, -1.05, '#5fa3c9'), ...elephant(0.65, -0.65),
    ...pen(-0.8, 0.8, 1.1, 1.1, '#cfae6a'), ...lion(-0.8, 0.75), ...tree(-1.15, 1.15, 1.1),
    ...pen(0.8, 0.8, 1.1, 1.1, '#dfeef2'), box(0.6, 0.02, 0.45, 0.8, 0.04, 0.85, '#7cc4e0'), box(0.3, 0.06, 0.25, 0.65, 0.05, 0.6, '#f4fbff'),
    ...penguin(0.6, 0.6), ...penguin(0.7, 0.55), ...penguin(0.66, 0.68), ...penguin(0.95, 1.05),
    // kiosk by the crossing
    box(0.18, 0.16, 0.16, 0.28, 0.08, 0.28, '#f2b33d'), box(0.24, 0.03, 0.22, 0.28, 0.18, 0.28, '#c0392b'),
  ]);
}

/**
 * Fishing pier (1×1): wooden planks out over the water on posts, a bench, rod holders, a bucket and a
 * little lantern at the end.
 */
export function pierGeometry(): THREE.BufferGeometry {
  return merge([
    ...[-0.36, -0.12, 0.12, 0.36].map((z) => box(0.34, 0.03, 0.2, 0, 0.08, z, '#a8783f')),
    ...[-0.4, -0.12, 0.16, 0.42].flatMap((z) => [box(0.04, 0.14, 0.04, -0.15, 0.02, z, '#6b4a2f'), box(0.04, 0.14, 0.04, 0.15, 0.02, z, '#6b4a2f')]),
    box(0.02, 0.08, 0.86, -0.17, 0.13, 0, '#7a5530'), box(0.02, 0.08, 0.86, 0.17, 0.13, 0, '#7a5530'),
    box(0.22, 0.03, 0.07, 0, 0.13, -0.3, '#7a5530'), box(0.22, 0.06, 0.02, 0, 0.16, -0.33, '#7a5530'),
    // rods leaning out over the water
    turn(box(0.008, 0.5, 0.008, 0.17, 0.3, 0.3, '#2b2622'), 0.17, 0.3, 0.3, 40, 0, 0),
    turn(box(0.008, 0.5, 0.008, -0.17, 0.3, 0.1, '#2b2622'), -0.17, 0.3, 0.1, 40, 0, 0),
    shape('cylinder', 0.06, 0.06, 0.06, 0.08, 0.13, -0.1, '#5d8fb5', 'y', 8),
    box(0.02, 0.24, 0.02, 0, 0.2, 0.44, '#2b2622'), box(0.05, 0.06, 0.05, 0, 0.34, 0.44, '#ffd166'),
  ]);
}

/**
 * Forestry (1×1): a forester's log cabin with a green roof, a nursery of saplings in rows, a wheelbarrow,
 * a watering can and a stack of young trees ready for planting.
 */
export function forestryGeometry(): THREE.BufferGeometry {
  const sap = (x: number, z: number, s: number) => [box(0.012, 0.06 * s, 0.012, x, 0.04 + 0.03 * s, z, '#6b4a2f'), shape('cone', 0.06 * s, 0.1 * s, 0.06 * s, x, 0.1 + 0.07 * s, z, '#3f8a3a', 'y', 6)];
  const rows = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) rows.push(...sap(0.08 + i * 0.1, 0.06 + j * 0.1, 0.7 + ((i + j) % 3) * 0.25));
  return merge([
    box(0.96, 0.02, 0.96, 0, 0.01, 0, '#7fa04a'),
    box(0.42, 0.016, 0.42, 0.23, 0.024, 0.21, '#6b4a2f'),
    ...rows,
    // log cabin
    ...[0.04, 0.1, 0.16, 0.22].map((y) => cylX(0.03, 0.4, -0.22, y, -0.26, '#9a6a3a', 8)),
    box(0.38, 0.24, 0.3, -0.22, 0.13, -0.2, '#8a5a2f'),
    ...gable(0.46, 0.14, 0.38, -0.22, 0.32, -0.2, '#3f7a3a'),
    box(0.08, 0.14, 0.02, -0.22, 0.07, -0.045, '#4a2f1a'),
    // wheelbarrow with saplings and a watering can
    box(0.12, 0.05, 0.08, -0.25, 0.08, 0.25, '#5d8fb5'), shape('cylinder', 0.04, 0.012, 0.04, -0.32, 0.04, 0.25, '#2b2622', 'x', 8),
    ...sap(-0.23, 0.25, 0.6), ...sap(-0.2, 0.27, 0.5),
    shape('cylinder', 0.05, 0.06, 0.05, 0.38, 0.06, -0.3, '#3f8a5a', 'y', 8),
    box(0.02, 0.3, 0.02, 0.4, 0.15, -0.05, '#6b4a2f'), box(0.16, 0.08, 0.02, 0.4, 0.27, -0.05, '#3f7a3a'),
  ]);
}

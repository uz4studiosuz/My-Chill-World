import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { bench, lamp, planter } from '../details';

/** One market stall: a counter with goods, crates, a striped canopy on four poles and a little price board. */
function stall(x: number, z: number, color: string, goods: string[], facing: 1 | -1): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [
    box(0.5, 0.18, 0.3, x, 0.11, z, '#8a5a35'), box(0.52, 0.02, 0.32, x, 0.21, z, '#6b4a2e'),
    ...[-0.24, 0.24].flatMap((dx) => [-0.17, 0.17].map((dz) => box(0.03, 0.48, 0.03, x + dx, 0.25, z + dz, '#cfc8b6'))),
    box(0.06, 0.05, 0.012, x + 0.18, 0.28, z + facing * 0.16, '#f4f1ea'),
  ];
  for (let i = 0; i < 5; i++) parts.push(box(0.11, 0.025, 0.42, x - 0.22 + i * 0.11, 0.5, z, i % 2 ? '#f4f1ea' : color));
  parts.push(box(0.56, 0.04, 0.012, x, 0.47, z + facing * 0.21, color));
  goods.forEach((g, i) => parts.push(shape('dome', 0.1, 0.05, 0.1, x - 0.16 + i * 0.11, 0.235, z, g, 'y', 8)));
  parts.push(box(0.1, 0.07, 0.1, x - 0.18, 0.04, z + facing * 0.22, '#c49a63'), box(0.1, 0.07, 0.1, x - 0.06, 0.04, z + facing * 0.22, '#a8794d'));
  return parts;
}

/** Bazaar (2×2): rows of stalls around a fountain square, a paved floor, lamps, benches and shoppers' baskets. */
export function marketGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [box(1.9, 0.02, 1.9, 0, 0.01, 0, '#c9bf9d')];
  // paving: a light grid of slabs
  for (let i = -3; i <= 3; i++) parts.push(box(1.86, 0.004, 0.01, 0, 0.022, i * 0.27, '#b6ab88'), box(0.01, 0.004, 1.86, i * 0.27, 0.022, 0, '#b6ab88'));
  const fruit = [['#e85a3a', '#f1c232', '#7cc24a', '#e07b2e'], ['#c4553d', '#9cc95a', '#f2c230', '#8f5bd6'], ['#f4e3c4', '#d9b13a', '#e85a3a', '#4f8a3a']];
  const colors = ['#d9443b', '#3a6fd1', '#f1c232', '#4c9a52'];
  [-0.6, 0.0, 0.6].forEach((x, i) => parts.push(...stall(x, -0.45, colors[i], fruit[i % 3], 1)));
  [-0.45, 0.45].forEach((x, i) => parts.push(...stall(x, 0.5, colors[(i + 2) % 4], fruit[(i + 1) % 3], -1)));
  parts.push(
    // the fountain in the middle
    shape('cylinder', 0.36, 0.08, 0.36, 0, 0.06, 0.03, '#d6d0c2', 'y', 16), shape('cylinder', 0.3, 0.081, 0.3, 0, 0.065, 0.03, '#6fb6d8', 'y', 16),
    shape('cylinder', 0.06, 0.18, 0.06, 0, 0.14, 0.03, '#d6d0c2', 'y', 10), shape('cylinder', 0.14, 0.03, 0.14, 0, 0.23, 0.03, '#d6d0c2', 'y', 12),
    ...lamp(-0.85, 0.05, 0.42), ...lamp(0.85, 0.05, 0.42),
    ...bench(-0.4, 0.05, true), ...bench(0.4, 0.05, true),
    ...planter(-0.85, 0.8), ...planter(0.85, 0.8), ...planter(-0.85, -0.8), ...planter(0.85, -0.8),
  );
  return merge(parts);
}

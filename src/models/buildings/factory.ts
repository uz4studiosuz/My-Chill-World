import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { door, lamp, parapet, roofKit, sign, windows } from '../details';

/**
 * Factory (3×3): a big hall with a saw-tooth roof of skylights, an office wing, two brick chimneys with
 * rings, a loading bay with roller doors, silos, a fork-lift, pallets and a yard.
 */
export function factoryGeometry(): THREE.BufferGeometry {
  const wall = '#9aa3ab', roof = '#6f7880', brick = '#a65e43', ring = '#3a3532';
  const parts: THREE.BufferGeometry[] = [
    box(2.9, 0.02, 2.9, 0, 0.01, 0, '#a9a69d'),
    // the main hall with a plinth and a saw-tooth roof (each tooth glazed on its steep side)
    box(1.9, 0.72, 1.3, -0.3, 0.36, -0.55, wall),
    box(1.92, 0.05, 1.32, -0.3, 0.025, -0.55, '#7d828a'),
    box(1.94, 0.04, 1.34, -0.3, 0.74, -0.55, roof),
  ];
  for (let i = 0; i < 4; i++) {
    const z = -1.05 + i * 0.33;
    parts.push(shape('wedge', 1.88, 0.16, 0.3, -0.3, 0.84, z, roof), box(1.88, 0.15, 0.012, -0.3, 0.835, z - 0.15, '#a8d0e6'));
  }
  parts.push(
    // hall windows high up on the long sides and a roller door to the yard
    ...windows('front', -0.3, -0.55, 0.95, 0.65, 0.55, 6, { w: 0.16, h: 0.12, frame: '#cfd6dc' }),
    ...windows('left', -0.3, -0.55, 0.95, 0.65, 0.55, 4, { w: 0.16, h: 0.12, frame: '#cfd6dc' }),
    box(0.5, 0.38, 0.02, -0.55, 0.2, 0.105, '#5d6670'), ...[0.08, 0.15, 0.22, 0.29].map((y) => box(0.48, 0.008, 0.025, -0.55, y, 0.11, '#46505a')),
    box(0.5, 0.06, 0.2, -0.55, 0.42, 0.2, '#7d828a'),
    // the office wing: two floors of windows, an entrance and a sign
    box(1.0, 0.5, 0.9, 0.9, 0.25, 0.45, '#c8ced4'),
    box(1.02, 0.04, 0.92, 0.9, 0.02, 0.45, '#7d828a'),
    box(1.04, 0.04, 0.94, 0.9, 0.52, 0.45, roof),
    ...parapet(0.9, 0.45, 1.04, 0.94, 0.54, roof),
    ...roofKit(0.9, 0.4, 0.8, 0.7, 0.54, 13),
    ...windows('front', 0.9, 0.45, 0.5, 0.45, 0.17, 3, { from: -0.38, to: 0.38, w: 0.14, h: 0.11 }),
    ...windows('front', 0.9, 0.45, 0.5, 0.45, 0.39, 4, { w: 0.14, h: 0.11 }),
    ...windows('right', 0.9, 0.45, 0.5, 0.45, 0.17, 3, { w: 0.14, h: 0.11 }), ...windows('right', 0.9, 0.45, 0.5, 0.45, 0.39, 3, { w: 0.14, h: 0.11 }),
    ...door(0.9, 0.9, 0.16, 0.22, '#3a3f46', { glass: true, canopy: '#3a6fd1' }),
    ...sign(0.9, 0.3, 0.915, 0.4, 0.05, '#3a6fd1', '#ffffff'),
  );
  // two brick chimneys with dark rings and caps
  for (const [x, h, r] of [[1.05, 1.6, 0.24], [0.7, 1.3, 0.2]] as const) {
    parts.push(shape('cylinder', r, h, r, x, h / 2, -0.8, brick, 'y', 12));
    for (const y of [h * 0.35, h * 0.7]) parts.push(shape('cylinder', r + 0.02, 0.04, r + 0.02, x, y, -0.8, ring, 'y', 12));
    parts.push(shape('cylinder', r + 0.04, 0.06, r + 0.04, x, h + 0.02, -0.8, ring, 'y', 12));
  }
  parts.push(
    // silos with a pipe bridge to the hall
    ...[-1.15, -0.85].flatMap((x) => [shape('cylinder', 0.24, 0.6, 0.24, x, 0.3, 0.75, '#d6dade', 'y', 14), shape('cone', 0.24, 0.1, 0.24, x, 0.65, 0.75, '#c3c8cd', 'y', 14)]),
    box(0.5, 0.03, 0.03, -1.0, 0.55, 0.45, '#8a8f98'),
    // loading yard: crates, pallets with sacks, a fork-lift and lamps
    box(0.5, 0.3, 0.5, -0.95, 0.15, 1.2, '#c98a3a'), box(0.5, 0.3, 0.5, -0.35, 0.15, 1.2, '#3a6fd1'),
    ...[0.1, 0.32].flatMap((x) => [box(0.18, 0.025, 0.18, x, 0.03, 0.4, '#a8794d'), box(0.15, 0.1, 0.15, x, 0.09, 0.4, '#e8dcc0')]),
    box(0.14, 0.09, 0.2, 0.2, 0.065, 0.75, '#f2c230'), box(0.12, 0.08, 0.1, 0.2, 0.15, 0.7, '#26292e'), box(0.012, 0.16, 0.012, 0.16, 0.12, 0.86, '#3a3f46'), box(0.012, 0.16, 0.012, 0.24, 0.12, 0.86, '#3a3f46'),
    ...lamp(-1.35, 1.35, 0.45), ...lamp(1.35, 1.35, 0.45),
  );
  return merge(parts);
}

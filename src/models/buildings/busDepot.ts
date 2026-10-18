import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { door, lamp, parapet, roofKit, sign, windows } from '../details';

/** One parked city bus (along z): body, a window band, a destination board, doors and wheels. */
function bus(x: number, z: number, color: string): THREE.BufferGeometry[] {
  return [
    box(0.24, 0.17, 0.66, x, 0.12, z, color),
    box(0.245, 0.06, 0.6, x, 0.17, z - 0.01, '#6f9fc8'),
    box(0.2, 0.03, 0.012, x, 0.19, z + 0.33, '#1d2127'), box(0.12, 0.015, 0.013, x, 0.19, z + 0.331, '#f2b33d'),
    box(0.22, 0.012, 0.64, x, 0.21, z, '#e9edf0'),
    box(0.012, 0.11, 0.1, x + 0.122, 0.1, z + 0.18, '#3a3f46'),
    ...[-0.22, 0.2].flatMap((dz) => [-0.115, 0.115].map((dx) => shape('cylinder', 0.07, 0.025, 0.07, x + dx, 0.035, z + dz, '#1d2127', 'x', 12))),
  ];
}

/** Bus depot: a garage hall with three roller doors, an office with a clock, a canopy over two parked buses. */
export function busDepotGeometry(): THREE.BufferGeometry {
  const blue = '#3a6fd1', post = '#cfd6dc';
  const parts: THREE.BufferGeometry[] = [
    box(1.9, 0.02, 1.9, 0, 0.01, 0, '#7d8085'),
    // bays painted on the yard
    ...[-0.75, -0.15, 0.15, 0.75].map((x) => box(0.02, 0.006, 0.8, x, 0.022, 0.3, '#f4f4f2')),
    // the garage hall: three roller doors and a band of high windows
    box(1.6, 0.52, 0.8, 0, 0.26, -0.5, '#dfe3e8'),
    box(1.62, 0.04, 0.82, 0, 0.02, -0.5, '#7d828a'),
    box(1.64, 0.06, 0.84, 0, 0.55, -0.5, blue),
    box(1.6, 0.012, 0.8, 0, 0.586, -0.5, '#8a8f98'),
    ...parapet(0, -0.5, 1.64, 0.84, 0.58, '#2d5aa8'),
    ...roofKit(0, -0.55, 1.2, 0.6, 0.58, 17),
    ...[-0.5, 0, 0.5].flatMap((x) => [box(0.36, 0.34, 0.02, x, 0.19, -0.095, '#9aa3ab'), ...[0.08, 0.15, 0.22, 0.29].map((y) => box(0.34, 0.008, 0.025, x, y, -0.09, '#7d828a'))]),
    ...windows('front', 0, -0.5, 0.8, 0.4, 0.45, 6, { w: 0.14, h: 0.08, frame: '#cfd6dc' }),
    ...sign(0, 0.55, -0.075, 0.6, 0.045, blue, '#ffffff'),
    // the office on the side with a clock
    box(0.3, 0.42, 0.3, 0.72, 0.21, 0.0, '#f1e4c4'), box(0.34, 0.04, 0.34, 0.72, 0.44, 0.0, blue),
    ...door(0.72, 0.155, 0.11, 0.22, '#26292e', { glass: true }),
    shape('cylinder', 0.12, 0.012, 0.12, 0.72, 0.34, 0.158, '#f4f1ea', 'z', 16), box(0.006, 0.04, 0.004, 0.72, 0.35, 0.166, '#1d2127'),
    // the canopy over the parked buses
    box(1.5, 0.03, 0.62, -0.1, 0.48, 0.35, blue), box(1.5, 0.012, 0.6, -0.1, 0.462, 0.35, '#e9edf0'),
    ...[[-0.8, 0.62], [0.6, 0.62], [-0.8, 0.08], [0.6, 0.08]].map(([x, z]) => box(0.04, 0.46, 0.04, x, 0.23, z, post)),
    ...bus(-0.45, 0.32, '#f1c232'), ...bus(0.3, 0.32, '#d9443b'),
    ...lamp(-0.88, 0.85, 0.42), ...lamp(0.88, 0.85, 0.42),
  ];
  return merge(parts);
}

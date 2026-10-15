import * as THREE from 'three';
import { box, merge, shape } from '../../utils/voxel';
import { bin, door, parapet, shopFront, sign } from '../details';

/** Gas station: a canopy with lights on four posts over two pump islands, a little shop, a price pylon and air. */
export function gasStationGeometry(): THREE.BufferGeometry {
  const red = '#d9443b', white = '#f2f4f6', post = '#cfd6dc';
  const parts: THREE.BufferGeometry[] = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#7d8085'),
    // forecourt markings
    box(0.86, 0.006, 0.02, 0, 0.022, 0.46, '#f4f4f2'), box(0.02, 0.006, 0.4, 0, 0.022, 0.2, '#f2c230'),
    // the canopy: a red fascia, a white underside with lights, four posts
    box(0.92, 0.06, 0.52, 0, 0.5, 0.2, red), box(0.9, 0.012, 0.5, 0, 0.466, 0.2, white),
    box(0.94, 0.012, 0.54, 0, 0.535, 0.2, '#b5362f'),
    ...[-0.25, 0, 0.25].flatMap((x) => [box(0.12, 0.008, 0.06, x, 0.458, 0.1, '#fff6d6'), box(0.12, 0.008, 0.06, x, 0.458, 0.3, '#fff6d6')]),
    ...[[-0.38, 0.0], [0.38, 0.0], [-0.38, 0.4], [0.38, 0.4]].map(([x, z]) => box(0.04, 0.45, 0.04, x, 0.245, z, post)),
    ...sign(0, 0.5, 0.465, 0.5, 0.035, red, '#ffffff'),
  ];
  // two islands with two pumps each (hoses and a screen)
  for (const x of [-0.17, 0.17]) {
    parts.push(box(0.12, 0.03, 0.34, x, 0.035, 0.2, '#bdb7aa'));
    for (const z of [0.1, 0.3]) {
      parts.push(box(0.08, 0.18, 0.07, x, 0.14, z, x < 0 ? '#3a6fd1' : '#4c9a52'), box(0.06, 0.04, 0.072, x, 0.18, z, '#1d2127'),
        box(0.084, 0.02, 0.074, x, 0.235, z, white), box(0.012, 0.08, 0.012, x + 0.045, 0.12, z, '#26292e'));
    }
  }
  parts.push(
    // the shop behind: glass front, door, roof with a parapet
    box(0.52, 0.3, 0.28, 0, 0.17, -0.33, '#f1e4c4'), box(0.54, 0.03, 0.3, 0, 0.335, -0.33, '#3a6fd1'),
    ...parapet(0, -0.33, 0.54, 0.3, 0.35, '#3a6fd1', 0.02, 0.03),
    ...shopFront(-0.08, 0.04, -0.185, 0.28, 0.18), ...door(0.17, -0.185, 0.1, 0.22, '#26292e', { glass: true }),
    // the price pylon at the road
    box(0.03, 0.42, 0.03, 0.42, 0.22, 0.44, post), box(0.14, 0.22, 0.03, 0.42, 0.36, 0.44, red),
    ...[0.42, 0.36, 0.3].map((y) => box(0.1, 0.035, 0.01, 0.42, y, 0.457, '#1d2127')),
    // air and water, a bin and a tyre stack
    box(0.06, 0.14, 0.05, -0.42, 0.08, -0.08, '#f2c230'), ...bin(-0.42, 0.06),
    shape('torus', 0.1, 0.03, 0.1, -0.4, 0.035, -0.4, '#26292e', 'y', 12), shape('torus', 0.1, 0.03, 0.1, -0.4, 0.065, -0.4, '#26292e', 'y', 12),
  );
  return merge(parts);
}

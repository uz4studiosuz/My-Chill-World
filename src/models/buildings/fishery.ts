import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { door, lamp, windows } from '../details';

/** Fishery: a timber boathouse with a blue roof, a jetty on posts, a moored boat, nets drying on poles, crates and barrels. */
export function fisheryGeometry(): THREE.BufferGeometry {
  const plank = '#a07a4a', post = '#6b4a2e';
  const parts: THREE.BufferGeometry[] = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#c9b88a'),
    // the boathouse: timber walls with vertical boards, a stone base, a pitched roof
    box(0.5, 0.36, 0.42, -0.15, 0.2, -0.18, '#8a5a35'),
    ...[-0.36, -0.27, -0.18, -0.09, 0.0, 0.07].map((x) => box(0.012, 0.34, 0.425, x, 0.2, -0.18, '#7a4f2e')),
    box(0.52, 0.04, 0.44, -0.15, 0.02, -0.18, '#8d8a83'),
    shape('wedge', 0.58, 0.12, 0.26, -0.15, 0.44, -0.06, '#4f6f8a'), shape('wedge', 0.58, 0.12, 0.26, -0.15, 0.44, -0.3, '#4f6f8a'),
    ...door(-0.15, 0.035, 0.14, 0.22, '#3a2a20'),
    ...windows('left', -0.15, -0.18, 0.25, 0.21, 0.26, 1, { w: 0.1, h: 0.08 }),
    // the jetty and its posts
    box(0.18, 0.025, 0.74, 0.3, 0.06, 0.1, plank),
    ...[-0.25, 0.0, 0.25, 0.45].flatMap((z) => [box(0.035, 0.12, 0.035, 0.22, 0.03, z, post), box(0.035, 0.12, 0.035, 0.38, 0.03, z, post)]),
    ...[-0.2, -0.05, 0.1, 0.25, 0.4].map((z) => box(0.185, 0.004, 0.012, 0.3, 0.075, z, '#8a6438')),
    // a moored rowing boat with oars
    box(0.12, 0.05, 0.3, 0.44, 0.04, 0.3, '#d9443b'), box(0.1, 0.012, 0.26, 0.44, 0.07, 0.3, '#f4f1ea'), box(0.012, 0.012, 0.3, 0.44, 0.075, 0.3, '#8a6438'),
    // nets drying between two poles, crates of fish and barrels
    box(0.02, 0.3, 0.02, -0.4, 0.15, 0.22, post), box(0.02, 0.3, 0.02, -0.4, 0.15, 0.44, post),
    box(0.006, 0.18, 0.2, -0.4, 0.18, 0.33, '#4a6b5a'),
    box(0.12, 0.06, 0.1, 0.05, 0.05, 0.2, '#c49a63'), box(0.1, 0.012, 0.08, 0.05, 0.085, 0.2, '#9fb3c4'),
    box(0.12, 0.06, 0.1, 0.05, 0.11, 0.2, '#a8794d'),
    shape('cylinder', 0.08, 0.1, 0.08, -0.15, 0.07, 0.25, '#7a4f2a', 'y', 10), shape('cylinder', 0.08, 0.1, 0.08, -0.05, 0.07, 0.34, '#4f7d4a', 'y', 10),
    ...lamp(0.3, 0.45, 0.32),
  ];
  return merge(parts);
}

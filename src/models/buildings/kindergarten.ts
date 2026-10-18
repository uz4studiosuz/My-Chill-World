import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { door, windows } from '../details';

/** Kindergarten: a warm one-storey house with a stepped pink roof, round windows, a fenced playground and a sandbox. */
export function kindergartenGeometry(): THREE.BufferGeometry {
  const wall = '#ffe3a8', roof = '#e8738f', fence = '#f4f1ea';
  const parts: THREE.BufferGeometry[] = [
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#9ec46a'),
    // a paved path to the door
    box(0.16, 0.012, 0.36, -0.05, 0.02, 0.27, '#e3d6b8'),
    box(0.7, 0.38, 0.5, -0.05, 0.19, -0.18, wall),
    box(0.72, 0.04, 0.52, -0.05, 0.02, -0.18, '#d9c08a'),
    box(0.78, 0.06, 0.58, -0.05, 0.41, -0.18, roof), box(0.6, 0.06, 0.42, -0.05, 0.47, -0.18, roof), box(0.36, 0.05, 0.22, -0.05, 0.525, -0.18, roof),
    box(0.8, 0.012, 0.6, -0.05, 0.382, -0.18, '#c45f78'),
    // a little clock tower over the door
    box(0.12, 0.1, 0.12, -0.05, 0.6, -0.18, wall), shape('pyramid', 0.16, 0.1, 0.16, -0.05, 0.7, -0.18, roof), shape('cylinder', 0.06, 0.012, 0.06, -0.05, 0.6, -0.115, '#f4f1ea', 'z', 12),
    ...door(-0.05, 0.075, 0.14, 0.22, '#3a6fd1', { canopy: '#f2c230' }),
    ...windows('front', -0.05, -0.18, 0.35, 0.25, 0.22, 2, { from: -0.24, to: 0.24, w: 0.12, h: 0.12, frame: '#f4f1ea' }),
    ...windows('left', -0.05, -0.18, 0.35, 0.25, 0.22, 2, { w: 0.1, h: 0.11 }), ...windows('right', -0.05, -0.18, 0.35, 0.25, 0.22, 2, { w: 0.1, h: 0.11 }),
    // coloured blocks painted on the wall
    ...['#d9443b', '#3a6fd1', '#4c9a52', '#f2c230'].map((c, i) => box(0.05, 0.05, 0.01, -0.33 + i * 0.07, 0.33, 0.075, c)),
    // playground: a fence, a slide, a swing and a sandbox with a spade
    ...[-0.46, 0.46].map((x) => box(0.012, 0.06, 0.4, x, 0.04, 0.27, fence)),
    box(0.92, 0.06, 0.012, 0, 0.04, 0.47, fence), box(0.92, 0.012, 0.014, 0, 0.065, 0.47, fence),
    box(0.04, 0.24, 0.04, 0.3, 0.12, 0.3, '#f2c230'), box(0.16, 0.03, 0.06, 0.37, 0.16, 0.3, '#d9443b'), box(0.06, 0.012, 0.18, 0.3, 0.12, 0.38, '#3a6fd1'),
    box(0.012, 0.2, 0.012, 0.18, 0.1, 0.4, '#5d6670'), box(0.012, 0.2, 0.012, 0.18, 0.1, 0.24, '#5d6670'), box(0.012, 0.012, 0.18, 0.18, 0.2, 0.32, '#5d6670'),
    box(0.05, 0.012, 0.06, 0.18, 0.07, 0.32, '#d9443b'),
    box(0.24, 0.04, 0.24, -0.32, 0.03, 0.32, '#c49a63'), box(0.2, 0.012, 0.2, -0.32, 0.052, 0.32, '#e3cf98'),
    box(0.03, 0.03, 0.03, -0.3, 0.07, 0.3, '#d9443b'), box(0.012, 0.06, 0.012, -0.36, 0.08, 0.34, '#3a6fd1'),
  ];
  return merge(parts);
}

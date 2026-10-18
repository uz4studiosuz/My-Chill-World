import * as THREE from 'three';
import { box, merge } from '../quality';
import { door, lamp, parapet, roofKit, sign, windows } from '../details';

/** Police station: a two-storey block with a blue band, a lit entrance, a radio mast, the flag and a patrol car. */
export function policeGeometry(): THREE.BufferGeometry {
  const wall = '#dfe6ee', blue = '#2d4f8a';
  return merge([
    box(0.98, 0.02, 0.98, 0, 0.01, 0, '#9aa0a6'),
    box(0.74, 0.62, 0.52, 0, 0.31, -0.12, wall),
    box(0.76, 0.04, 0.54, 0, 0.02, -0.12, '#7d828a'),
    box(0.76, 0.05, 0.54, 0, 0.33, -0.12, blue),
    box(0.78, 0.04, 0.56, 0, 0.64, -0.12, blue),
    box(0.74, 0.012, 0.52, 0, 0.666, -0.12, '#8a8f98'),
    ...parapet(0, -0.12, 0.78, 0.56, 0.66, '#24406f'),
    ...roofKit(-0.12, -0.18, 0.5, 0.36, 0.66, 11),
    // the entrance: double glass door under a canopy, a blue lamp and the sign
    ...door(0, 0.14, 0.18, 0.24, '#3a4a5c', { glass: true, canopy: blue }),
    box(0.04, 0.04, 0.04, 0.16, 0.24, 0.16, '#6fb6ff'),
    ...sign(0, 0.33, 0.145, 0.42, 0.04, blue, '#ffffff'),
    // ground and upper floor windows
    ...windows('front', 0, -0.12, 0.37, 0.26, 0.19, 2, { from: -0.27, to: 0.27, w: 0.1, h: 0.11 }),
    ...windows('front', 0, -0.12, 0.37, 0.26, 0.48, 4, { w: 0.1, h: 0.12 }),
    ...windows('left', 0, -0.12, 0.37, 0.26, 0.19, 2, { w: 0.1, h: 0.11 }), ...windows('left', 0, -0.12, 0.37, 0.26, 0.48, 2, { w: 0.1, h: 0.12 }),
    ...windows('right', 0, -0.12, 0.37, 0.26, 0.19, 2, { w: 0.1, h: 0.11 }), ...windows('right', 0, -0.12, 0.37, 0.26, 0.48, 2, { w: 0.1, h: 0.12 }),
    // radio mast on the roof and the flag pole
    box(0.02, 0.3, 0.02, 0.26, 0.81, -0.28, '#9aa3ab'), box(0.1, 0.012, 0.012, 0.26, 0.9, -0.28, '#9aa3ab'), box(0.07, 0.012, 0.012, 0.26, 0.85, -0.28, '#9aa3ab'),
    box(0.02, 0.5, 0.02, 0.42, 0.26, 0.3, '#cccccc'), box(0.14, 0.09, 0.01, 0.49, 0.45, 0.3, blue),
    // a patrol car in front: body, cabin, light bar, wheels
    box(0.3, 0.06, 0.15, -0.22, 0.06, 0.37, '#f2f4f6'), box(0.16, 0.05, 0.13, -0.24, 0.115, 0.37, '#2d3a48'),
    box(0.3, 0.02, 0.152, -0.22, 0.065, 0.37, blue),
    box(0.06, 0.02, 0.04, -0.27, 0.145, 0.37, '#d9443b'), box(0.06, 0.02, 0.04, -0.21, 0.145, 0.37, '#3a6fd1'),
    ...[[-0.33, 0.3], [-0.11, 0.3], [-0.33, 0.44], [-0.11, 0.44]].map(([x, z]) => box(0.06, 0.05, 0.02, x, 0.03, z, '#1d2127')),
    ...lamp(0.42, 0.42, 0.3),
  ]);
}

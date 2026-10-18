import * as THREE from 'three';
import { box, merge, shape } from '../quality';
import { door, lamp } from '../details';

/** Landfill (2×2): a fenced pit with mounds of rubbish (half covered with earth), a compactor, a weighbridge hut and gulls. */
export function landfillGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#7a6f5a'),
    box(1.5, 0.02, 1.4, 0, 0.02, -0.15, '#5a5246'),
    // a gravel track in from the gate
    box(0.22, 0.012, 0.7, 0.6, 0.022, 0.6, '#9a8f78'),
  ];
  // mounds: one covered with earth and grass, two of mixed rubbish
  parts.push(shape('dome', 0.8, 0.22, 0.6, -0.4, 0.13, -0.5, '#6f7d4a', 'y', 12), shape('dome', 0.5, 0.14, 0.4, -0.45, 0.24, -0.5, '#7f8d55', 'y', 10));
  const cols = ['#6d6a62', '#8a7d70', '#4f8a3a', '#b0478f', '#d9cfae', '#3a6fd1', '#5d544b', '#c9b38a', '#e8e3d6'];
  for (let i = 0; i < 34; i++) {
    const x = -0.1 + ((i * 37) % 13) / 13 * 0.75, z = -0.7 + ((i * 53) % 11) / 11 * 0.95, h = 0.05 + ((i * 7) % 5) * 0.03;
    const s = 0.08 + ((i * 11) % 4) * 0.025;
    parts.push(box(s, h, s * 0.9, x, h / 2 + 0.02 + (((i * 3) % 4) * 0.02), z, cols[i % cols.length]));
  }
  // a few bags, a fridge and tyres on the heap
  parts.push(
    ...[[0.1, -0.3], [0.35, -0.55], [0.5, -0.2]].map(([x, z]) => shape('sphere', 0.08, 0.07, 0.08, x, 0.14, z, '#26292e', 'y', 8)),
    box(0.06, 0.12, 0.06, 0.22, 0.12, -0.05, '#f2f4f6'),
    shape('torus', 0.1, 0.03, 0.1, 0.0, 0.08, 0.05, '#26292e', 'y', 12),
    // the compactor (yellow, with a spiked drum)
    box(0.26, 0.1, 0.18, 0.2, 0.08, 0.35, '#e8a13a'), box(0.12, 0.1, 0.14, 0.16, 0.18, 0.35, '#e8a13a'), box(0.1, 0.06, 0.12, 0.16, 0.2, 0.35, '#6f9fc8'),
    shape('cylinder', 0.12, 0.2, 0.12, 0.38, 0.07, 0.35, '#5d6670', 'z', 10),
    // the weighbridge hut at the gate and the scale plate
    box(0.26, 0.24, 0.22, 0.75, 0.12, 0.2, '#e9edf0'), box(0.3, 0.03, 0.26, 0.75, 0.255, 0.2, '#4f7d4a'),
    ...door(0.75, 0.315, 0.08, 0.18, '#5d6670'),
    box(0.24, 0.012, 0.44, 0.6, 0.03, 0.55, '#8a8f98'),
    // gulls over the heap
    ...[[0.1, 0.55, -0.4], [0.3, 0.62, -0.2], [-0.05, 0.6, -0.1]].map(([x, y, z]) => box(0.08, 0.01, 0.02, x, y, z, '#f4f4f2')),
    // the fence, the gate posts and a lamp
    box(1.94, 0.14, 0.025, 0, 0.07, -0.96, '#8c8f94'), box(0.025, 0.14, 1.94, -0.96, 0.07, 0, '#8c8f94'), box(0.025, 0.14, 1.94, 0.96, 0.07, 0, '#8c8f94'),
    box(1.2, 0.14, 0.025, -0.36, 0.07, 0.96, '#8c8f94'),
    box(0.04, 0.2, 0.04, 0.46, 0.1, 0.96, '#5d6670'), box(0.04, 0.2, 0.04, 0.74, 0.1, 0.96, '#5d6670'),
    ...lamp(0.9, 0.6, 0.4),
  );
  return merge(parts);
}

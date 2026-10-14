import * as THREE from 'three';
import { box, merge } from '../../utils/voxel';

/** Landfill (2×2): a fenced pit with heaps of rubbish and a bulldozer. */
export function landfillGeometry(): THREE.BufferGeometry {
  const parts = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#7a6f5a'),
    box(1.5, 0.02, 1.4, 0, 0.02, -0.15, '#5a5246'),
  ];
  const cols = ['#6d6a62', '#8a7d70', '#4f8a3a', '#b0478f', '#d9cfae', '#3a6fd1', '#5d544b'];
  for (let i = 0; i < 26; i++) {
    const x = -0.6 + ((i * 37) % 13) / 13 * 1.2, z = -0.7 + ((i * 53) % 11) / 11 * 1.1, h = 0.06 + ((i * 7) % 5) * 0.03;
    parts.push(box(0.16, h, 0.14, x, h / 2 + 0.02, z, cols[i % cols.length]));
  }
  parts.push(
    box(0.3, 0.1, 0.2, 0.55, 0.07, 0.6, '#e8a13a'), box(0.12, 0.1, 0.14, 0.52, 0.17, 0.6, '#e8a13a'), box(0.04, 0.08, 0.26, 0.74, 0.05, 0.6, '#5d6670'),
    box(1.94, 0.14, 0.025, 0, 0.07, -0.96, '#8c8f94'), box(0.025, 0.14, 1.94, -0.96, 0.07, 0, '#8c8f94'), box(0.025, 0.14, 1.94, 0.96, 0.07, 0, '#8c8f94'),
  );
  return merge(parts);
}

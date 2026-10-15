import * as THREE from 'three';
import { box, cylX, merge, shape } from '../../utils/voxel';
import { parapet, roofKit, windows } from '../details';

/** Steel mill: the rolling hall, a riveted blast furnace with its stoves and downcomer, the chimney, glowing ladles and stacked beams. */
export function steelmillGeometry(): THREE.BufferGeometry {
  const hall = '#5d6670', dark = '#3d4148', rust = '#7a5a4a';
  return merge([
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#8c8f94'),
    // the long rolling hall with a ridge of roof lights and high windows
    box(1.1, 0.5, 0.8, -0.35, 0.25, -0.45, hall), box(1.12, 0.04, 0.82, -0.35, 0.02, -0.45, '#4a5058'),
    box(1.16, 0.06, 0.86, -0.35, 0.53, -0.45, dark), box(1.1, 0.012, 0.8, -0.35, 0.565, -0.45, '#6d737b'),
    ...parapet(-0.35, -0.45, 1.16, 0.86, 0.56, dark),
    box(0.9, 0.06, 0.16, -0.35, 0.6, -0.45, '#a8d0e6'),
    ...roofKit(-0.55, -0.6, 0.5, 0.4, 0.56, 31),
    ...windows('front', -0.35, -0.45, 0.55, 0.4, 0.38, 5, { w: 0.13, h: 0.1, frame: '#8a8f98' }),
    box(0.3, 0.26, 0.02, -0.1, 0.15, -0.045, '#3a3f46'), ...[0.07, 0.14, 0.21].map((y) => box(0.28, 0.008, 0.025, -0.1, y, -0.04, '#2a2e33')),
    // the blast furnace: a riveted shell, bands, a top and the downcomer pipe
    shape('cylinder', 0.4, 1.0, 0.4, 0.55, 0.5, -0.45, '#6f7880', 'y', 14),
    ...[0.25, 0.5, 0.75].map((y) => shape('cylinder', 0.42, 0.03, 0.42, 0.55, y, -0.45, rust, 'y', 14)),
    shape('cone', 0.4, 0.2, 0.4, 0.55, 1.1, -0.45, dark, 'y', 12),
    cylX(0.05, 0.4, 0.35, 1.0, -0.45, '#4a5058', 8), box(0.05, 0.4, 0.05, 0.15, 0.8, -0.45, '#4a5058'),
    // three hot-blast stoves with domes
    ...[0.25, 0.45, 0.65].flatMap((x) => [shape('cylinder', 0.14, 0.6, 0.14, x, 0.3, -0.85, '#7d828a', 'y', 10), shape('dome', 0.14, 0.06, 0.14, x, 0.6, -0.85, dark, 'y', 10)]),
    // the chimney
    shape('cylinder', 0.12, 0.6, 0.12, 0.85, 1.3, -0.7, '#4a5058', 'y', 8), shape('cylinder', 0.12, 1.0, 0.12, 0.85, 0.5, -0.7, '#4a5058', 'y', 8),
    shape('cylinder', 0.14, 0.04, 0.14, 0.85, 1.6, -0.7, '#2a2e33', 'y', 8),
    // the casting floor: glowing slag, two ladles and stacked steel beams
    box(0.4, 0.04, 0.3, 0.4, 0.03, 0.5, '#ff7a1a'),
    shape('cylinder', 0.16, 0.14, 0.16, 0.75, 0.09, 0.45, '#3a3f46', 'y', 10), shape('cylinder', 0.13, 0.01, 0.13, 0.75, 0.165, 0.45, '#ff9a3a', 'y', 10),
    ...[0, 1, 2].map((i) => box(0.6, 0.04, 0.06, -0.4, 0.03 + i * 0.045, 0.55, '#9aa3ab')),
    ...[0, 1].map((i) => box(0.6, 0.04, 0.06, -0.4, 0.03 + i * 0.045, 0.7, '#8a929b')),
    // a gantry crane over the yard
    box(0.03, 0.5, 0.03, -0.75, 0.25, 0.35, '#e8a13a'), box(0.03, 0.5, 0.03, -0.05, 0.25, 0.35, '#e8a13a'), box(0.76, 0.04, 0.05, -0.4, 0.5, 0.35, '#e8a13a'),
    box(0.06, 0.05, 0.06, -0.4, 0.46, 0.35, '#3a3f46'), box(0.006, 0.28, 0.006, -0.4, 0.3, 0.35, '#26292e'),
  ]);
}

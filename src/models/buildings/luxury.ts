import * as THREE from 'three';
import { box, merge, rod, shape } from '../quality';

// Luxury buildings of a big city's centre. All face +z (the street). Glass in the window colours glows at night.
const GOLD = '#d4af37';
const STONE = '#e9e2d2';
const GLASS_DEEP = '#5a7f9c';
const GLASS_SKY = '#6f9fc8';
const GLASS_LIGHT = '#a8d0e6';
const DARK = '#2d3138';

type P = THREE.BufferGeometry[];

/** A glass shaft: a glass box with thin mullions and a floor band every `band` units. */
function glassShaft(w: number, d: number, y0: number, h: number, z0: number, glass: string, frame: string, band = 0.42): P {
  const out: P = [box(w, h, d, 0, y0 + h / 2, z0, glass)];
  for (let y = y0 + band; y < y0 + h - 0.05; y += band) out.push(box(w + 0.02, 0.025, d + 0.02, 0, y, z0, frame));
  const cols = Math.max(2, Math.round(w / 0.22));
  for (let c = 1; c < cols; c++) {
    const x = -w / 2 + (c * w) / cols;
    out.push(box(0.018, h, 0.018, x, y0 + h / 2, z0 + d / 2 + 0.006, frame), box(0.018, h, 0.018, x, y0 + h / 2, z0 - d / 2 - 0.006, frame));
  }
  const rows = Math.max(2, Math.round(d / 0.22));
  for (let r = 1; r < rows; r++) {
    const z = z0 - d / 2 + (r * d) / rows;
    out.push(box(0.018, h, 0.018, w / 2 + 0.006, y0 + h / 2, z, frame), box(0.018, h, 0.018, -w / 2 - 0.006, y0 + h / 2, z, frame));
  }
  return out;
}

/** The ground of a luxury plot: paving, a golden canopy over the door, planters and lamps. */
function lobby(size: number, front: number, w: number): P {
  const half = size / 2 - 0.04;
  return [
    box(size - 0.06, 0.02, size - 0.06, 0, 0.01, 0, '#d9d3c5'),
    box(size - 0.3, 0.012, 0.32, 0, 0.026, half - 0.18, '#bfb6a2'),
    // the entrance: glass doors under a golden canopy on two posts
    box(w * 0.42, 0.22, 0.02, 0, 0.13, front + 0.01, GLASS_LIGHT),
    box(w * 0.6, 0.03, 0.3, 0, 0.27, front + 0.15, GOLD),
    rod([-w * 0.27, 0, front + 0.28], [-w * 0.27, 0.27, front + 0.28], 0.012, GOLD),
    rod([w * 0.27, 0, front + 0.28], [w * 0.27, 0.27, front + 0.28], 0.012, GOLD),
    // planters with little trees and two lamps by the door
    box(0.16, 0.08, 0.16, -half + 0.14, 0.05, half - 0.14, '#8a8f98'), shape('sphere', 0.16, 0.16, 0.16, -half + 0.14, 0.17, half - 0.14, '#4f8a3a'),
    box(0.16, 0.08, 0.16, half - 0.14, 0.05, half - 0.14, '#8a8f98'), shape('sphere', 0.16, 0.16, 0.16, half - 0.14, 0.17, half - 0.14, '#4f8a3a'),
    rod([-w * 0.45, 0, front + 0.3], [-w * 0.45, 0.32, front + 0.3], 0.01, DARK), shape('sphere', 0.05, 0.05, 0.05, -w * 0.45, 0.34, front + 0.3, '#ffe9a8'),
    rod([w * 0.45, 0, front + 0.3], [w * 0.45, 0.32, front + 0.3], 0.01, DARK), shape('sphere', 0.05, 0.05, 0.05, w * 0.45, 0.34, front + 0.3, '#ffe9a8'),
  ];
}

/** Luxury skyscraper (2 x 2), four looks picked by the plot: glass spire, art deco, round residence, dark tower. */
export function skyscraperGeometry(variant = 0): THREE.BufferGeometry {
  const v = variant % 4;
  const parts: P = [];
  if (v === 0) {
    // the glass spire: a stone podium, a tall blue-glass shaft, golden setbacks and a spire
    parts.push(...lobby(2, 0.62, 1.5), box(1.7, 0.5, 1.3, 0, 0.25, -0.05, STONE), box(1.74, 0.04, 1.34, 0, 0.52, -0.05, GOLD));
    parts.push(...glassShaft(1.2, 1.0, 0.54, 6.4, -0.05, GLASS_DEEP, '#e6e9ec'));
    parts.push(box(1.26, 0.06, 1.06, 0, 6.97, -0.05, GOLD), ...glassShaft(0.9, 0.75, 7.0, 0.8, -0.05, GLASS_SKY, '#e6e9ec', 0.4));
    parts.push(box(0.94, 0.05, 0.79, 0, 7.82, -0.05, GOLD), box(0.5, 0.35, 0.45, 0, 8.0, -0.05, STONE));
    parts.push(rod([0, 8.17, -0.05], [0, 9.6, -0.05], 0.035, GOLD, 0.008), shape('sphere', 0.07, 0.07, 0.07, 0, 9.6, -0.05, '#ff4f4f'));
  } else if (v === 1) {
    // art deco: three stepped stone tiers with tall glass strips and a golden crown
    parts.push(...lobby(2, 0.7, 1.6));
    const tiers: [number, number, number][] = [[1.6, 0, 2.8], [1.25, 2.8, 2.4], [0.9, 5.2, 1.8]];
    for (const [w, y0, h] of tiers) {
      parts.push(box(w, h, w * 0.85, 0, y0 + h / 2, -0.05, STONE));
      const n = Math.round(w / 0.2);
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * (w / n);
        parts.push(box(w / n * 0.55, h - 0.25, 0.015, x, y0 + h / 2, -0.05 + w * 0.425 + 0.006, GLASS_LIGHT));
        parts.push(box(w / n * 0.55, h - 0.25, 0.015, x, y0 + h / 2, -0.05 - w * 0.425 - 0.006, GLASS_LIGHT));
        parts.push(box(0.015, h - 0.25, w * 0.85 / n * 0.55, w / 2 + 0.006, y0 + h / 2, -0.05 - w * 0.425 + (i + 0.5) * (w * 0.85 / n), GLASS_LIGHT));
        parts.push(box(0.015, h - 0.25, w * 0.85 / n * 0.55, -w / 2 - 0.006, y0 + h / 2, -0.05 - w * 0.425 + (i + 0.5) * (w * 0.85 / n), GLASS_LIGHT));
      }
      parts.push(box(w + 0.05, 0.06, w * 0.85 + 0.05, 0, y0 + h, -0.05, GOLD));
    }
    parts.push(shape('pyramid', 0.7, 0.9, 0.6, 0, 7.45, -0.05, GOLD), rod([0, 7.8, -0.05], [0, 8.8, -0.05], 0.025, GOLD, 0.006));
  } else if (v === 2) {
    // the round residence: a glass cylinder ringed by white terraces, a golden dome
    parts.push(...lobby(2, 0.72, 1.5), shape('cylinder', 1.5, 0.45, 1.5, 0, 0.225, -0.05, STONE, 'y', 28));
    parts.push(shape('cylinder', 1.15, 7.2, 1.15, 0, 0.45 + 3.6, -0.05, GLASS_SKY, 'y', 28));
    for (let y = 0.9; y < 7.6; y += 0.48) parts.push(shape('cylinder', 1.32, 0.04, 1.32, 0, y, -0.05, '#f4f1ea', 'y', 28));
    parts.push(shape('cylinder', 1.22, 0.08, 1.22, 0, 7.68, -0.05, GOLD, 'y', 28), shape('dome', 0.95, 0.6, 0.95, 0, 7.72, -0.05, GOLD, 'y', 24));
    parts.push(rod([0, 8.3, -0.05], [0, 8.9, -0.05], 0.02, GOLD, 0.005));
  } else {
    // the dark tower: black frame and deep glass, golden fins, a rooftop pool and a helipad
    parts.push(...lobby(2, 0.66, 1.5), box(1.66, 0.6, 1.36, 0, 0.3, -0.02, DARK));
    parts.push(...glassShaft(1.34, 1.1, 0.6, 7.4, -0.02, GLASS_DEEP, DARK, 0.36));
    for (const x of [-0.67, -0.34, 0, 0.34, 0.67]) parts.push(box(0.03, 7.4, 0.06, x, 0.6 + 3.7, -0.02 + 0.58, GOLD));
    parts.push(box(1.42, 0.12, 1.18, 0, 8.06, -0.02, DARK), box(0.62, 0.04, 0.5, -0.3, 8.13, -0.2, '#4fc3e8'));
    parts.push(shape('cylinder', 0.55, 0.04, 0.55, 0.35, 8.14, 0.25, '#3a3f46', 'y', 20), box(0.24, 0.012, 0.04, 0.35, 8.165, 0.25, '#f4f1ea'));
    parts.push(box(0.04, 0.012, 0.2, 0.25, 8.165, 0.25, '#f4f1ea'), box(0.04, 0.012, 0.2, 0.45, 8.165, 0.25, '#f4f1ea'));
  }
  return merge(parts);
}

/** The city tower (3 x 3): the tallest building in town — tapering glass tiers with golden bands, a sky deck and a spire. */
export function landmarkGeometry(): THREE.BufferGeometry {
  const parts: P = [...lobby(3, 1.0, 2.2)];
  parts.push(box(2.5, 0.8, 2.0, 0, 0.4, -0.1, STONE), box(2.56, 0.05, 2.06, 0, 0.82, -0.1, GOLD));
  const tiers: [number, number][] = [[1.9, 4.2], [1.55, 3.4], [1.2, 2.8], [0.85, 2.0]];
  let y = 0.84;
  tiers.forEach(([w, h], i) => {
    parts.push(...glassShaft(w, w * 0.9, y, h, -0.1, i % 2 ? GLASS_SKY : GLASS_DEEP, '#eef0f2', 0.38));
    y += h;
    parts.push(box(w + 0.08, 0.08, w * 0.9 + 0.08, 0, y + 0.02, -0.1, GOLD));
  });
  // the sky deck: a glass ring with a golden rim
  parts.push(shape('cylinder', 1.1, 0.3, 1.1, 0, y + 0.2, -0.1, GLASS_LIGHT, 'y', 24), shape('cylinder', 1.16, 0.04, 1.16, 0, y + 0.37, -0.1, GOLD, 'y', 24));
  parts.push(shape('cone', 0.5, 1.0, 0.5, 0, y + 0.88, -0.1, '#eef0f2', 'y', 16));
  parts.push(rod([0, y + 1.3, -0.1], [0, y + 3.4, -0.1], 0.05, GOLD, 0.01), shape('sphere', 0.09, 0.09, 0.09, 0, y + 3.4, -0.1, '#ff4f4f'));
  return merge(parts);
}

/** Shopping mall (3 x 3): a wide glass-fronted building with a glass dome, shop signs, flags and a forecourt. */
export function mallGeometry(): THREE.BufferGeometry {
  const parts: P = [
    box(2.94, 0.02, 2.94, 0, 0.01, 0, '#cfc8b6'),
    box(2.7, 1.0, 2.0, 0, 0.5, -0.4, '#f1ece2'),
    box(2.74, 0.06, 2.04, 0, 1.03, -0.4, '#8a8f98'),
    // the glass front, the entrance and a big sign
    box(2.3, 0.7, 0.02, 0, 0.42, 0.61, GLASS_LIGHT),
    box(0.7, 0.5, 0.25, 0, 0.25, 0.72, GLASS_SKY),
    box(0.8, 0.05, 0.35, 0, 0.53, 0.74, '#d9443b'),
    box(1.4, 0.18, 0.04, 0, 0.88, 0.62, '#26292e'),
    box(1.2, 0.08, 0.05, 0, 0.88, 0.64, '#ffe9a8'),
    // the glass dome over the atrium
    shape('dome', 1.0, 0.55, 1.0, 0, 1.06, -0.4, GLASS_SKY, 'y', 24),
    shape('cylinder', 1.04, 0.05, 1.04, 0, 1.08, -0.4, GOLD, 'y', 24),
    // side windows
    box(0.02, 0.5, 1.6, 1.36, 0.5, -0.4, GLASS_LIGHT), box(0.02, 0.5, 1.6, -1.36, 0.5, -0.4, GLASS_LIGHT),
    // the forecourt: paving, benches and trees
    box(2.8, 0.012, 0.8, 0, 0.026, 1.0, '#bfb6a2'),
  ];
  const signs = ['#e85a7a', '#3f6fb5', '#f2b33d', '#4f8a3a', '#8a3a9a'];
  signs.forEach((c, i) => parts.push(box(0.32, 0.12, 0.03, -1.0 + i * 0.5, 0.75, 0.63, c)));
  for (const x of [-1.2, -0.6, 0.6, 1.2]) {
    parts.push(rod([x, 0, 1.25], [x, 0.7, 1.25], 0.01, '#d0d4d9'), box(0.18, 0.12, 0.005, x + 0.09, 0.62, 1.25, signs[(x * 10 + 12) % 5 | 0]));
  }
  for (const x of [-1.15, 1.15]) parts.push(rod([x, 0, 0.95], [x, 0.18, 0.95], 0.02, '#6b4a2e'), shape('sphere', 0.26, 0.24, 0.26, x, 0.3, 0.95, '#4f8a3a'));
  return merge(parts);
}

/** Game centre (2 x 2): a dark building in neon stripes with a giant controller and a PLAY sign on the roof. */
export function arcadeGeometry(): THREE.BufferGeometry {
  const parts: P = [
    box(1.94, 0.02, 1.94, 0, 0.01, 0, '#3a3540'),
    box(1.7, 0.95, 1.3, 0, 0.475, -0.15, '#3b2a55'),
    box(1.74, 0.05, 1.34, 0, 0.97, -0.15, '#26202e'),
    // neon stripes round the walls
    box(1.72, 0.03, 1.32, 0, 0.3, -0.15, '#ff4fd8'),
    box(1.72, 0.03, 1.32, 0, 0.62, -0.15, '#3ff0ff'),
    // the glass front and doors
    box(1.3, 0.24, 0.02, 0, 0.14, 0.51, GLASS_LIGHT),
    box(0.4, 0.04, 0.22, 0, 0.29, 0.6, '#ff4fd8'),
    // the PLAY sign: four coloured blocks
    box(1.2, 0.3, 0.06, 0, 0.8, 0.52, '#1d1824'),
    // a giant game controller on the roof
    box(0.9, 0.14, 0.42, 0, 1.12, -0.15, '#26292e'),
    shape('cylinder', 0.36, 0.14, 0.36, -0.42, 1.12, -0.15, '#26292e', 'y', 16),
    shape('cylinder', 0.36, 0.14, 0.36, 0.42, 1.12, -0.15, '#26292e', 'y', 16),
    box(0.16, 0.04, 0.05, -0.36, 1.21, -0.15, '#f4f1ea'), box(0.05, 0.04, 0.16, -0.36, 1.21, -0.15, '#f4f1ea'),
    shape('sphere', 0.06, 0.04, 0.06, 0.3, 1.21, -0.2, '#e8443a'), shape('sphere', 0.06, 0.04, 0.06, 0.42, 1.21, -0.1, '#4fc34a'),
    shape('sphere', 0.06, 0.04, 0.06, 0.42, 1.21, -0.3, '#3f8ae0'), shape('sphere', 0.06, 0.04, 0.06, 0.54, 1.21, -0.2, '#f2b33d'),
  ];
  ['#ff4f6a', '#ffd23f', '#3ff0ff', '#7cff6b'].forEach((c, i) => parts.push(box(0.22, 0.2, 0.02, -0.39 + i * 0.26, 0.8, 0.56, c)));
  // a claw machine and a neon arch by the door
  parts.push(box(0.22, 0.4, 0.22, -0.72, 0.2, 0.75, '#ff4fd8'), box(0.18, 0.2, 0.18, -0.72, 0.28, 0.75, GLASS_LIGHT));
  parts.push(shape('arch', 0.7, 0.5, 0.06, 0, 0.25, 0.85, '#3ff0ff'));
  return merge(parts);
}

// Small architectural details shared by the building models: framed windows, doors with canopies and steps,
// parapets, rooftop machinery, planters, lamps, benches, bins and signs. Every helper returns geometry parts
// (boxes and shapes with baked colours) to be merged into a model. Models face +z.
import * as THREE from 'three';
import { box, shape } from '../utils/voxel';

/** Window glass — must stay exactly this colour so windows glow at night. */
export const GLASS = '#a8d0e6';
export const FRAME = '#f4f1ea';
export const DARK = '#3a3f46';

type Face = 'front' | 'back' | 'left' | 'right';
type P = THREE.BufferGeometry[];

/**
 * A row of framed windows on one face of a block (centre cx, cz, half sizes hw, hd), between x (or z) a…b.
 * Each window: glass, a frame around it, a lintel and a sill.
 */
export function windows(face: Face, cx: number, cz: number, hw: number, hd: number, y: number, n: number, opt: { w?: number; h?: number; frame?: string; sill?: string; from?: number; to?: number } = {}): P {
  const w = opt.w ?? 0.11, h = opt.h ?? 0.12, fr = opt.frame ?? FRAME, sill = opt.sill ?? fr;
  const along = face === 'front' || face === 'back' ? hw : hd;
  const a = opt.from ?? -along + 0.12, b = opt.to ?? along - 0.12;
  const out: P = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1);
    out.push(...pane(face, cx, cz, hw, hd, t, y, w, h, fr, sill));
  }
  return out;
}

function pane(face: Face, cx: number, cz: number, hw: number, hd: number, t: number, y: number, w: number, h: number, fr: string, sill: string): P {
  const e = 0.012, f = 0.016;
  if (face === 'front' || face === 'back') {
    const s = face === 'front' ? 1 : -1, z = cz + s * (hd + e);
    const x = cx + t;
    return [
      box(w, h, 0.012, x, y, z, GLASS),
      box(w + f * 2, f, 0.02, x, y + h / 2 + f / 2, z, fr), box(w + f * 2, f * 1.2, 0.04, x, y - h / 2 - f / 2, z + s * 0.01, sill),
      box(f, h, 0.02, x - w / 2 - f / 2, y, z, fr), box(f, h, 0.02, x + w / 2 + f / 2, y, z, fr),
      box(0.008, h, 0.016, x, y, z + s * 0.002, fr),
    ];
  }
  const s = face === 'right' ? 1 : -1, x = cx + s * (hw + e);
  const z = cz + t;
  return [
    box(0.012, h, w, x, y, z, GLASS),
    box(0.02, f, w + f * 2, x, y + h / 2 + f / 2, z, fr), box(0.04, f * 1.2, w + f * 2, x + s * 0.01, y - h / 2 - f / 2, z, sill),
    box(0.02, h, f, x, y, z - w / 2 - f / 2, fr), box(0.02, h, f, x, y, z + w / 2 + f / 2, fr),
  ];
}

/** A shop window: one wide pane with mullions, a stone base and a lintel. */
export function shopFront(x: number, y0: number, z: number, w: number, h: number, frame = DARK): P {
  const out: P = [
    box(w, h, 0.012, x, y0 + h / 2, z, GLASS),
    box(w + 0.03, 0.04, 0.03, x, y0 - 0.02, z, '#8d8a83'),
    box(w + 0.03, 0.02, 0.025, x, y0 + h + 0.01, z, frame),
  ];
  const n = Math.max(1, Math.round(w / 0.16));
  for (let i = 0; i <= n; i++) out.push(box(0.012, h, 0.02, x - w / 2 + (w * i) / n, y0 + h / 2, z, frame));
  return out;
}

/** A door with a frame, a step and (optionally) a little canopy and a lamp. */
export function door(x: number, z: number, w = 0.14, h = 0.24, color = '#5c3a21', opt: { canopy?: string; glass?: boolean; lamp?: boolean } = {}): P {
  const out: P = [
    box(w, h, 0.014, x, h / 2 + 0.02, z, opt.glass ? GLASS : color),
    box(w + 0.03, 0.02, 0.02, x, h + 0.03, z, FRAME), box(0.015, h, 0.02, x - w / 2 - 0.008, h / 2 + 0.02, z, FRAME), box(0.015, h, 0.02, x + w / 2 + 0.008, h / 2 + 0.02, z, FRAME),
    box(w + 0.08, 0.02, 0.07, x, 0.02, z + 0.035, '#cfc8b6'),
  ];
  if (opt.glass) out.push(box(0.01, h, 0.018, x, h / 2 + 0.02, z + 0.002, DARK));
  else out.push(box(0.015, 0.015, 0.01, x + w * 0.3, h * 0.5, z + 0.01, '#d4af37'));
  if (opt.canopy) out.push(box(w + 0.12, 0.02, 0.12, x, h + 0.07, z + 0.06, opt.canopy), box(0.012, 0.06, 0.012, x - w / 2 - 0.04, h + 0.04, z + 0.11, DARK), box(0.012, 0.06, 0.012, x + w / 2 + 0.04, h + 0.04, z + 0.11, DARK));
  if (opt.lamp) out.push(box(0.02, 0.03, 0.02, x + w / 2 + 0.05, h * 0.75, z + 0.015, '#ffe9a8'));
  return out;
}

/** A thin parapet around a flat roof at height y. */
export function parapet(cx: number, cz: number, w: number, d: number, y: number, color = '#cfc8b6', t = 0.03, h = 0.04): P {
  return [
    box(w, h, t, cx, y + h / 2, cz + d / 2 - t / 2, color), box(w, h, t, cx, y + h / 2, cz - d / 2 + t / 2, color),
    box(t, h, d, cx + w / 2 - t / 2, y + h / 2, cz, color), box(t, h, d, cx - w / 2 + t / 2, y + h / 2, cz, color),
  ];
}

/** Rooftop machinery: air-conditioning units with fan grilles, vent pipes and a hatch. */
export function roofKit(cx: number, cz: number, w: number, d: number, y: number, seed = 1): P {
  const r = (i: number) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
  const out: P = [];
  const n = 1 + Math.round(r(1) * 2);
  for (let i = 0; i < n; i++) {
    const x = cx + (r(i + 2) - 0.5) * w * 0.6, z = cz + (r(i + 5) - 0.5) * d * 0.6;
    out.push(box(0.12, 0.07, 0.09, x, y + 0.035, z, '#c9ccd0'), shape('cylinder', 0.07, 0.008, 0.07, x, y + 0.074, z, '#5d6670', 'y', 10));
  }
  out.push(shape('cylinder', 0.025, 0.08, 0.025, cx - w * 0.3, y + 0.04, cz + d * 0.25, '#8a8f98', 'y', 8));
  out.push(box(0.09, 0.03, 0.09, cx + w * 0.28, y + 0.015, cz - d * 0.25, '#7d828a'));
  return out;
}

/** A round planter with a little bush. */
export function planter(x: number, z: number, leaf = '#5f9a3e'): P {
  return [
    shape('cylinder', 0.08, 0.05, 0.08, x, 0.045, z, '#a89f90', 'y', 10),
    shape('sphere', 0.09, 0.08, 0.09, x, 0.1, z, leaf, 'y', 8),
  ];
}

/** A street lamp. */
export function lamp(x: number, z: number, h = 0.36): P {
  return [
    box(0.02, h, 0.02, x, h / 2 + 0.02, z, DARK),
    box(0.06, 0.02, 0.06, x, h + 0.025, z, DARK),
    box(0.04, 0.025, 0.04, x, h + 0.003, z, '#ffe9a8'),
  ];
}

/** A bench seen from the front. */
export function bench(x: number, z: number, rotY = false): P {
  const w = rotY ? 0.05 : 0.16, d = rotY ? 0.16 : 0.05;
  return [box(w, 0.015, d, x, 0.05, z, '#8a5a35'), box(rotY ? 0.012 : w, 0.04, rotY ? d : 0.012, x + (rotY ? -0.02 : 0), 0.075, z - (rotY ? 0 : 0.02), '#8a5a35'), box(w * 0.9, 0.04, d * 0.9, x, 0.022, z, DARK)];
}

/** A litter bin. */
export function bin(x: number, z: number): P {
  return [shape('cylinder', 0.035, 0.06, 0.035, x, 0.04, z, '#3f6b4a', 'y', 8)];
}

/** A sign board on a wall (or a fascia): coloured board with a lighter strip of "letters". */
export function sign(x: number, y: number, z: number, w: number, h: number, bg: string, letters = '#f4f1ea'): P {
  const out: P = [box(w, h, 0.025, x, y, z, bg)];
  const n = Math.max(2, Math.round(w / 0.05));
  for (let i = 0; i < n; i++) out.push(box(w / n * 0.6, h * 0.45, 0.01, x - w / 2 + (w * (i + 0.5)) / n, y, z + 0.016, letters));
  return out;
}

/** A pavement strip in front of a building (with a kerb). */
export function pavement(cx: number, z: number, w: number, d: number): P {
  return [box(w, 0.012, d, cx, 0.021, z, '#cfc8b6'), box(w, 0.02, 0.02, cx, 0.02, z + d / 2, '#a8a294')];
}

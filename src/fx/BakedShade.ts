import * as THREE from 'three';

/**
 * Baked ambient occlusion for the voxel models, kept in its own vertex attribute (`aDark`, 0 = untouched) so the
 * vertex colours stay exact — the night windows are found by their colour.
 *
 * - the ground darkens the lowest part of every wall (a soft contact shadow, strongest at the foot)
 * - faces turned down (eaves, balconies, awnings from below) and faces right under a ledge are darker
 * - small details on top of roofs stay as they are
 */
export function bakeShade(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.getAttribute('aDark')) return g;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const n = pos.count;
  const dark = new Float32Array(n);
  let top = 0;
  for (let i = 0; i < n; i++) top = Math.max(top, pos.getY(i));
  // the occlusion reaches higher on tall buildings (a tower's foot is darker for longer)
  const reach = Math.min(0.42, 0.14 + top * 0.12);
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    const ny = nor ? nor.getY(i) : 0;
    let d = 0;
    // contact shadow at the foot of walls (not on the flat ground plates themselves)
    if (Math.abs(ny) < 0.5) {
      const k = Math.max(0, 1 - y / reach);
      d += 0.32 * k * k;
    }
    // undersides are in the shade
    if (ny < -0.5) d += 0.28;
    // a gentle darkening of the lowest storey of tall buildings, lighter towards the roof
    if (top > 0.9 && Math.abs(ny) < 0.5) d += 0.06 * Math.max(0, 1 - y / top);
    dark[i] = Math.min(0.55, d);
  }
  g.setAttribute('aDark', new THREE.BufferAttribute(dark, 1));
  return g;
}

/** Shader code that applies `aDark` (missing attribute → 0 → no change). */
export function applyShade(sh: { vertexShader: string; fragmentShader: string }) {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aDark;\nvarying float vDark;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDark = aDark;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vDark;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - vDark;');
}

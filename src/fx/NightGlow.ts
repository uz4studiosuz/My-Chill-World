import * as THREE from 'three';

/** 0 = day, 1 = deep night. Shared by every material that lights up after dark. */
export const nightLevel = { value: 0 };

/** Window colours used by the building models (they glow warm at night). */
const WINDOWS: [string, number][] = [['#ffe9a8', 1], ['#a8d0e6', 1], ['#6f9fc8', 0.55], ['#5a7f9c', 0.8], ['#cfe0ec', 0.6]];

/**
 * Lambert material whose window-coloured faces glow at night. About a third of the windows stay dark
 * (picked by position), so towns look lived-in instead of uniformly lit.
 */
export function windowMaterial(lit = true) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!lit) return m;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = nightLevel;
    WINDOWS.forEach(([c], i) => { sh.uniforms[`uWin${i}`] = { value: new THREE.Color(c) }; });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlowPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const uni = WINDOWS.map((_, i) => `uniform vec3 uWin${i};`).join('\n');
    const sum = WINDOWS.map(([, s], i) => `g = max(g, (1.0 - smoothstep(0.004, 0.02, distance(vColor.rgb, uWin${i}))) * ${s.toFixed(2)});`).join('\n');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight;\nvarying vec3 vGlowPos;\n${uni}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (uNight > 0.01) {
        float g = 0.0;
        ${sum}
        vec3 cell = floor(vGlowPos * vec3(5.0, 4.0, 5.0));
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float on = step(0.33, h);
        vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.88, 0.62), fract(h * 7.0));
        totalEmissiveRadiance += warm * g * on * uNight * 1.15;
      }`);
  };
  m.customProgramCacheKey = () => 'window-glow';
  return m;
}

/** Radial soft spot texture for light pools on the ground. */
export function glowTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

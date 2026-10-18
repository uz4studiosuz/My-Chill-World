import * as THREE from 'three';
import { N } from './grid';
import { fbm } from '../utils/rng';

/** How far the clouds reach out from the map (tiles) — far past anything the camera can see. */
const SPAN = N * 4;

/**
 * A sea of clouds round the map: beyond its edge the world is hidden under thick, slowly drifting clouds that nobody
 * can pass. Two layers drift at different speeds; they thin out over the first tiles past the edge, so the land
 * seems to sink into them. They take the light of the day (dark at night, warm at dusk).
 */
export class CloudSea {
  readonly group = new THREE.Group();
  private layers: { tex: THREE.Texture; speed: [number, number] }[] = [];

  constructor(seed: number) {
    // under everything, a floor of cloud so no gap ever shows
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#dfe6ee' }));
    floor.position.y = -2.7;
    this.group.add(floor);
    const edge = edgeMask();
    const LAYERS: [number, number, number, [number, number], number][] = [
      // height, texture repeats over the plane, how solid, drift, edge fade start
      [0.35, 9, 1, [0.0016, 0.0007], 1],
      [1.6, 6, 0.85, [-0.0011, 0.0013], 4],
      [3.2, 4, 0.55, [0.0008, -0.0009], 9],
    ];
    LAYERS.forEach(([y, rep, solid, speed], i) => {
      const tex = cloudTexture(seed + i * 17, solid);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rep, rep);
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaMap: edge, transparent: true, depthWrite: i === 0, emissive: new THREE.Color('#2a2f36') });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN).rotateX(-Math.PI / 2), mat);
      m.position.y = y;
      m.renderOrder = 2 + i;
      this.group.add(m);
      this.layers.push({ tex, speed });
    });
  }

  update(dt: number) {
    for (const l of this.layers) { l.tex.offset.x += l.speed[0] * dt; l.tex.offset.y += l.speed[1] * dt; }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshLambertMaterial;
      mat.map?.dispose(); mat.alphaMap?.dispose(); mat.dispose();
    });
  }
}

/** White cloud tops with soft grey hollows (and see-through gaps when not fully solid), tiling seamlessly. */
function cloudTexture(seed: number, solid: number) {
  const S = 256, P = 8;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  // a tiling noise: the edges are blended with the opposite side
  const n = (x: number, y: number) => {
    const fx = x / S, fy = y / S;
    const a = fbm(fx * P, fy * P, seed, 5), b = fbm((fx - 1) * P, fy * P, seed, 5), c2 = fbm(fx * P, (fy - 1) * P, seed, 5), d = fbm((fx - 1) * P, (fy - 1) * P, seed, 5);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c2 * (1 - fx) + d * fx) * fy;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = n(x, y);
    const k = (y * S + x) * 4;
    const shade = 0.86 + Math.min(1, Math.max(0, (v - 0.35) * 2.2)) * 0.14;
    img.data[k] = 255 * shade; img.data[k + 1] = 255 * (shade * 0.99 + 0.01); img.data[k + 2] = 255 * Math.min(1, shade * 1.02 + 0.02);
    img.data[k + 3] = 255 * Math.min(1, Math.max(0, solid >= 1 ? 1 : (v - 0.42) * 4 * solid + (solid - 0.5)));
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Clear over the map, thickening over the first tiles past its edge, solid beyond (green channel, as three.js reads it). */
function edgeMask() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const half = N / 2, k = SPAN / S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wx = (x + 0.5) * k - SPAN / 2, wz = (y + 0.5) * k - SPAN / 2;
    const d = Math.max(Math.abs(wx), Math.abs(wz)) - half; // tiles past the edge
    const t = Math.min(1, Math.max(0, (d + 1) / 9));
    const v = 255 * t * t * (3 - 2 * t);
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

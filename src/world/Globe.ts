import * as THREE from 'three';
import { IS_TOUCH } from '../config';
import type { WorldMap } from './WorldMap';
import { N } from './grid';
import { t } from '../i18n/i18n';
import { fbm } from '../utils/rng';
import { LAKE_COLOR, WildTile, groundColor, riversOut, worldSample, wrapX } from './Wild';
import { RIVER_REACH } from './Skirt';

/** One town shown on the globe. */
export interface GlobeTown { id: number; name: string; x: number; z: number; people: number; mine: boolean; friend: boolean; tint: string }

/** What the globe needs from the game. */
export interface GlobeHost {
  map: WorldMap;
  seed: number;
  /** Road tiles (non-zero = road). */
  roads: ArrayLike<number>;
  trees: Set<number>;
  /** Buildings: tile, size and a roof colour. */
  buildings(): { x: number; z: number; size: number; color: string }[];
  towns(): GlobeTown[];
  /** The tile the map camera looks at. */
  focus(): { x: number; z: number };
  /** Back down to the map at this tile. */
  land(x: number, z: number): void;
}

/** Our land on the globe: a patch of 72° × 72° around the front of the planet. */
const SPAN = THREE.MathUtils.degToRad(72);
const P0 = Math.PI / 2 - SPAN / 2, T0 = Math.PI / 2 - SPAN / 2;
const R = 1;
const MIN_D = 1.22;
/** Colours are written into the pictures as sRGB (three.js keeps them linear). */
const rgb = { r: 0, g: 0, b: 0 };
const put = (d: Uint8ClampedArray, i: number, c: THREE.Color, a = 255) => { c.getRGB(rgb, THREE.SRGBColorSpace); d[i] = rgb.r * 255; d[i + 1] = rgb.g * 255; d[i + 2] = rgb.b * 255; d[i + 3] = a; };

/** A point on the sphere (the same layout three.js uses for a sphere's texture). */
const point = (phi: number, theta: number, r = R) => new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
const tileAngles = (x: number, z: number) => ({ phi: P0 + ((x + 0.5) / N) * SPAN, theta: T0 + ((z + 0.5) / N) * SPAN });

/** 3D value noise (no seams on a sphere). */
function hash3(x: number, y: number, z: number, s: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise3(x: number, y: number, z: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, k: number) => a + (b - a) * k;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, s);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(p: THREE.Vector3, f: number, s: number, oct: number) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * noise3(p.x * f, p.y * f, p.z * f, s + i * 31); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

const hex = (c: string) => new THREE.Color(c);
const PAL = {
  deep: hex('#174a72'), ocean: hex('#22618f'), shallow: hex('#3f93c4'), sand: hex('#d9c99a'),
  grass: hex('#8cb156'), grass2: hex('#a4c064'), forest: hex('#5f8f3c'), steppe: hex('#b8b06a'), desert: hex('#e2cc92'),
  rock: hex('#9b978e'), rockLow: hex('#8f9a6a'), snow: hex('#f2f4f6'), tundra: hex('#8fa792'), road: hex('#5b5f66'),
};

/**
 * The planet: zoomed far out, the world is a globe turning in space. Our land (the real map, with its towns, roads and
 * fields) lies on its front; around it the ocean and the faraway lands. Drag to turn it, zoom in to land again.
 */
export class Globe {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  active = false;
  private group = new THREE.Group();
  private land?: THREE.Mesh;
  private clouds?: THREE.Mesh;
  private markers = new THREE.Group();
  private baseSeed = -1;
  private phi = Math.PI / 2;
  private theta = Math.PI / 2;
  private dist = 3;
  private goal = 3;
  private vel = { x: 0, y: 0 };
  private idle = 0;
  private leaving: { t: number; x: number; z: number } | null = null;
  private ui: HTMLDivElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private press = { x: 0, y: 0, moved: false, time: 0 };
  private pinch = 0;
  private ray = new THREE.Raycaster();

  constructor(parent: HTMLElement, private host: GlobeHost, private onExit: () => void) {
    this.scene.background = new THREE.Color('#05070d');
    this.scene.add(new THREE.AmbientLight('#cfd8ff', 0.75));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.1);
    sun.position.set(-3, 2, 4);
    this.camera.add(sun);
    this.scene.add(this.camera, this.group, this.stars());
    this.group.add(this.markers);
    this.atmosphere();
    // the controls: a layer over the map while the globe is shown
    this.ui = document.createElement('div');
    this.ui.className = 'globe-ui';
    this.ui.innerHTML = `<div class="gl-top"><b></b><small></small></div><button class="gl-back"></button>`;
    (this.ui.querySelector('.gl-top b') as HTMLElement).textContent = t('The world');
    (this.ui.querySelector('.gl-top small') as HTMLElement).textContent = IS_TOUCH ? t('Drag to turn · pinch in to land · tap a town') : t('Drag to turn · scroll in to land · click a town');
    const back = this.ui.querySelector('.gl-back') as HTMLButtonElement;
    back.textContent = `↓ ${t('Back to the town')}`;
    back.addEventListener('click', () => { const f = this.host.focus(); this.leave(f.x, f.z); });
    parent.appendChild(this.ui);
    this.ui.addEventListener('pointerdown', this.down);
    this.ui.addEventListener('pointermove', this.move);
    this.ui.addEventListener('pointerup', this.up);
    this.ui.addEventListener('pointercancel', this.up);
    this.ui.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('keydown', this.key);
  }

  /** The distance at which the whole planet fits on the screen (a tall phone needs to step back further). */
  private fit() {
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.min(1, this.camera.aspect));
    return Math.max(4.2, 1.18 / Math.sin(half));
  }
  private get maxD() { return this.fit() + 3; }

  resize(w: number, h: number) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Zoom out from the map to the globe, starting over the place the camera looked at. */
  open() {
    if (this.active) return;
    this.build();
    const f = this.host.focus();
    const a = tileAngles(f.x, f.z);
    this.phi = a.phi; this.theta = a.theta;
    this.dist = 1.03; this.goal = this.fit();
    this.arrive = 0;
    this.vel = { x: 0, y: 0 };
    this.leaving = null;
    this.active = true;
    this.ui.classList.add('show');
    this.ui.classList.remove('diving');
    this.cloud(1);
    document.body.classList.add('globe-on');
    this.apply();
  }

  /** Dive back down to the map at a tile. */
  leave(x: number, z: number) {
    if (!this.active || this.leaving) return;
    const a = tileAngles(x, z);
    this.leaving = { t: 0, x, z };
    this.dropDetail();
    this.ui.classList.add('diving');
    this.vel = { x: 0, y: 0 };
    this.fromAngles = { phi: this.phi, theta: this.theta, dist: this.dist };
    // the short way round, even after the planet turned many times
    const tau = Math.PI * 2;
    const dp = ((a.phi - this.phi) % tau + tau * 1.5) % tau - tau / 2;
    this.toAngles = { phi: this.phi + dp, theta: a.theta };
  }
  private fromAngles = { phi: 0, theta: 0, dist: 0 };
  private arrive = 1;
  /** A veil of cloud over the whole screen (0..1), faded over `fade` seconds. */
  private veil?: HTMLDivElement;
  private cloud(v: number, fade = 0) {
    if (!this.veil) { this.veil = document.createElement('div'); this.veil.className = 'gl-cloud'; document.body.appendChild(this.veil); }
    this.veil.style.transition = fade ? `opacity ${fade}s ease-out` : 'none';
    this.veil.style.opacity = `${THREE.MathUtils.clamp(v, 0, 1)}`;
  }
  private toAngles = { phi: 0, theta: 0 };

  private close() {
    this.active = false;
    this.ui.classList.remove('show');
    document.body.classList.remove('globe-on');
    this.onExit();
  }

  update(dt: number) {
    if (!this.active) return;
    if (this.leaving) {
      const L = this.leaving;
      // like Google Earth: first the planet turns to the place, then the camera falls towards it through the clouds
      L.t = Math.min(1, L.t + dt / 2.1);
      const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      const turn = ease(Math.min(1, L.t / 0.6));
      const fall = L.t < 0.3 ? 0 : (L.t - 0.3) / 0.7;
      this.phi = this.fromAngles.phi + (this.toAngles.phi - this.fromAngles.phi) * turn;
      this.theta = this.fromAngles.theta + (this.toAngles.theta - this.fromAngles.theta) * turn;
      this.dist = R + (this.fromAngles.dist - R) * Math.pow(1 - fall, 2.4) + 0.012;
      this.cloud(L.t < 0.78 ? 0 : (L.t - 0.78) / 0.22);
      this.apply();
      if (L.t >= 1) { this.host.land(L.x, L.z); this.close(); this.cloud(0, 0.9); }
      return;
    }
    // spin on after a flick, slowing down; after a while alone it turns by itself
    this.idle += dt;
    if (!this.pointers.size) {
      this.phi += this.vel.x * dt;
      this.theta = THREE.MathUtils.clamp(this.theta + this.vel.y * dt, 0.2, Math.PI - 0.2);
      const k = Math.exp(-dt * 2.6);
      this.vel.x *= k; this.vel.y *= k;
      if (this.idle > 6 && this.goal > 2.5) this.phi += dt * 0.05;
    }
    // arriving from the map: the camera rises out of the clouds into space
    if (this.arrive < 1) {
      this.arrive = Math.min(1, this.arrive + dt / 1.9);
      const e = 1 - Math.pow(1 - this.arrive, 3);
      this.dist = 1.03 + (this.goal - 1.03) * e;
      this.cloud(Math.max(0, 1 - this.arrive * 3));
    } else this.dist += (this.goal - this.dist) * Math.min(1, dt * 6);
    if (this.clouds) this.clouds.rotation.y += dt * 0.006;
    this.updateDetail();
    this.apply();
  }

  private apply() {
    this.camera.position.copy(point(this.phi, this.theta, this.dist));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    // name tags only on the side facing us, and a little smaller far away
    const cam = this.camera.position;
    const tag = 0.034 * Math.min(1, 0.5 + this.camera.aspect * 0.5);
    for (const m of this.markers.children) {
      const facing = m.position.dot(cam) / (m.position.length() * cam.length());
      m.visible = facing > 0.25;
      const s = m.userData.w as number;
      (m as THREE.Sprite).scale.set(s * tag, tag, 1);
    }
  }

  // ---------- the close-up: sharper land under the camera as it comes near ----------
  private detail?: THREE.Mesh;
  private detailAt = { x: 1e9, z: 1e9 };
  private detailJob?: { x0: number; z0: number; img: ImageData; c: HTMLCanvasElement; row: number };
  /** Tiles covered by the close-up and its pixels per tile. */
  private static DSPAN = 150;
  private static DPX = 3;

  private updateDetail() {
    if (this.dist > 1.9 || this.leaving) { if (this.detail && this.dist > 2.2) this.dropDetail(); return; }
    const c = this.placeAt(this.phi, this.theta);
    const near = (a: { x: number; z: number }) => Math.abs(wrapX(a.x - c.x + N / 2) - N / 2) < Globe.DSPAN * 0.22 && Math.abs(a.z - c.z) < Globe.DSPAN * 0.22;
    if (this.detailJob ? near({ x: this.detailJob.x0 + Globe.DSPAN / 2, z: this.detailJob.z0 + Globe.DSPAN / 2 }) : near(this.detailAt)) {
      if (this.detailJob) this.stepDetail(18);
      return;
    }
    const S = Globe.DSPAN * Globe.DPX;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    this.detailJob = { x0: c.x - Globe.DSPAN / 2, z0: c.z - Globe.DSPAN / 2, c: cv, img: cv.getContext('2d')!.createImageData(S, S), row: 0 };
  }

  /** Paint a few rows of the close-up; when done, lay it over the planet. */
  private stepDetail(rows: number) {
    const J = this.detailJob!, S = Globe.DSPAN * Globe.DPX, D = Globe.DPX;
    const map = this.host.map, rivers = this.rivers ??= riversOut(map, RIVER_REACH);
    const col = new THREE.Color(), wt = {} as WildTile, d = J.img.data;
    for (const stop = Math.min(Globe.DSPAN, J.row + rows); J.row < stop; J.row++) {
      const tz = J.z0 + J.row;
      for (let i = 0; i < Globe.DSPAN; i++) {
        const tx = J.x0 + i, wx = Math.floor(wrapX(tx));
        let a = 255;
        if (wx >= 0 && tz >= 0 && wx < N && tz < N) {
          // our map: deep inside, its own detailed picture shows through; near its edge (where that picture fades) the ground is drawn here
          if (Math.min(wx, tz, N - 1 - wx, N - 1 - tz) > 14) a = 0;
          else {
            const k = tz * N + wx;
            if (map.water[k]) col.copy(LAKE_COLOR);
            else if (this.host.roads[k]) col.copy(PAL.road);
            else groundColor(map.height[k], map.arid[k], map.cold[k], 0.5, this.host.trees.has(k) ? 0.65 : 0.4, col);
          }
        }
        else {
          const river = wx >= -rivers.off && tz >= -rivers.off && wx < N + rivers.off && tz < N + rivers.off && rivers.set.has(rivers.key(wx, tz));
          worldSample(this.host.seed, tx + 0.5, tz + 0.5, river, col, wt);
        }
        // soft edges so the close-up melts into the planet
        const e = Math.min(i, Globe.DSPAN - 1 - i, J.row, Globe.DSPAN - 1 - J.row) / 14;
        if (e < 1) a *= e * e * (3 - 2 * e);
        for (let py = 0; py < D; py++) for (let px = 0; px < D; px++) {
          const k = ((J.row * D + py) * S + i * D + px) * 4;
          if (a) put(d, k, col, a); else d[k + 3] = 0;
        }
      }
    }
    if (J.row < Globe.DSPAN) return;
    J.c.getContext('2d')!.putImageData(J.img, 0, 0);
    this.dropDetail();
    const tex = new THREE.CanvasTexture(J.c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.magFilter = THREE.NearestFilter;
    const a = tileAngles(J.x0, J.z0);
    const span = (Globe.DSPAN / N) * SPAN;
    const phi0 = a.phi - ((0.5 / N) * SPAN), th0 = a.theta - ((0.5 / N) * SPAN);
    this.detail = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0026, 64, 64, phi0, span, Math.max(0.01, th0), span), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95 }));
    this.group.add(this.detail);
    this.detailAt = { x: J.x0 + Globe.DSPAN / 2, z: J.z0 + Globe.DSPAN / 2 };
    this.detailJob = undefined;
  }

  private dropDetail() {
    if (!this.detail) return;
    this.group.remove(this.detail);
    this.detail.geometry.dispose();
    (this.detail.material as THREE.MeshStandardMaterial).map?.dispose();
    (this.detail.material as THREE.Material).dispose();
    this.detail = undefined;
    this.detailAt = { x: 1e9, z: 1e9 };
  }

  // ---------- building the planet ----------
  private build() {
    this.prepare(1e6);
    this.landPatch();
    this.townMarkers();
  }

  /** The planet's picture is painted a few rows per frame in the background, so opening the globe is quick. */
  private rivers?: ReturnType<typeof riversOut>;
  private paint?: { W: number; H: number; img: ImageData; c: HTMLCanvasElement; y: number; seed: number };

  /** Paint part of the planet (called every frame while the town is played); true when it is ready. */
  prepare(rows = 12) {
    if (this.baseSeed === this.host.seed) return true;
    if (!this.paint || this.paint.seed !== this.host.seed) {
      const W = IS_TOUCH ? 768 : 1024, H = W / 2;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      this.paint = { W, H, c, img: c.getContext('2d')!.createImageData(W, H), y: 0, seed: this.host.seed };
    }
    const P = this.paint, { W, H, img } = P;
    const s = this.host.seed, map = this.host.map;
    const rivers = this.rivers ??= riversOut(map, RIVER_REACH);
    const col = new THREE.Color(), col2 = new THREE.Color();
    const wt = {} as WildTile;
    // the land of the map carried on all round the planet: one turn is ROUND tiles, the seam lies behind it
    const ROUND = (N * Math.PI * 2) / SPAN, seam = N / 2 + ROUND / 2;
    for (const stop = Math.min(H, P.y + rows); P.y < stop; P.y++) {
      const y = P.y;
      const theta = ((y + 0.5) / H) * Math.PI;
      const lat = Math.abs(Math.cos(theta));
      const tz = ((theta - T0) / SPAN) * N;
      for (let x = 0; x < W; x++) {
        const phi = ((x + 0.5) / W) * Math.PI * 2;
        let tx = ((phi - P0) / SPAN) * N;
        if (tx > seam) tx -= ROUND;
        if (tx < seam - ROUND) tx += ROUND;
        const ix = Math.floor(tx), iz = Math.floor(tz);
        if (ix >= 0 && iz >= 0 && ix < N && iz < N) {
          // our own map: exactly its ground (the detailed picture lies over it)
          const k = iz * N + ix;
          if (map.water[k]) col.copy(LAKE_COLOR);
          else groundColor(map.height[k], map.arid[k], map.cold[k], 0.5, 0.5, col);
        } else {
          const river = ix >= -rivers.off && iz >= -rivers.off && ix < N + rivers.off && iz < N + rivers.off && rivers.set.has(rivers.key(ix, iz));
          worldSample(s, tx, tz, river, col, wt);
          put(img.data, (y * W + x) * 4, col);
          continue;
        }
        if (lat > 0.78) col.lerp(col2.copy(PAL.snow), Math.min(0.95, (lat - 0.78) * 7));
        put(img.data, (y * W + x) * 4, col);
      }
    }
    if (P.y < H) return false;
    P.c.getContext('2d')!.putImageData(img, 0, 0);
    this.paint = undefined;
    this.baseSeed = s;
    const tex = new THREE.CanvasTexture(P.c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const old = this.group.getObjectByName('planet') as THREE.Mesh | undefined;
    if (old) { this.group.remove(old); old.geometry.dispose(); ((old.material as THREE.MeshStandardMaterial).map)?.dispose(); (old.material as THREE.Material).dispose(); }
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
    planet.name = 'planet';
    this.group.add(planet);
    this.cloudLayer();
    return true;
  }

  private cloudLayer() {
    const s = this.host.seed, p = new THREE.Vector3();
    const front = point(Math.PI / 2, Math.PI / 2);
    // clouds drifting over everything
    if (!this.clouds) {
      const CW = 512, CH = 256;
      const cc = document.createElement('canvas');
      cc.width = CW; cc.height = CH;
      const cg = cc.getContext('2d')!;
      const ci = cg.createImageData(CW, CH);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        p.copy(point(((x + 0.5) / CW) * Math.PI * 2, ((y + 0.5) / CH) * Math.PI));
        const v = fbm3(p, 3.2, s + 77, 4);
        // thinner over our land, so the towns stay in sight
        const a = THREE.MathUtils.clamp((v - 0.52) * 4, 0, 0.85) * (0.25 + 0.75 * Math.min(1, p.angleTo(front) / 0.95));
        const i = (y * CW + x) * 4;
        ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = 255; ci.data[i + 3] = a * 255;
      }
      cg.putImageData(ci, 0, 0);
      const ct = new THREE.CanvasTexture(cc);
      ct.colorSpace = THREE.SRGBColorSpace;
      this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 48), new THREE.MeshStandardMaterial({ map: ct, transparent: true, depthWrite: false, roughness: 1 }));
      this.group.add(this.clouds);
    }
  }

  /** Our land, drawn from the real map: water, fields, forests, roads and every building. */
  private landPatch() {
    const S = IS_TOUCH ? 960 : 1600;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d')!;
    const k = S / N;
    const { map, roads, trees } = this.host;
    const col = new THREE.Color();
    const img = g.createImageData(N, N);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x;
      if (map.water[i]) col.copy(PAL.shallow).lerp(PAL.ocean, 0.25);
      else if (roads[i]) col.copy(PAL.road);
      else {
        col.copy(PAL.grass).lerp(PAL.grass2, fbm(x * 0.15, z * 0.15, 7, 2));
        if (map.arid[i] > 0.6) col.copy(PAL.desert); else if (map.arid[i] > 0.52) col.copy(PAL.steppe);
        if (map.cold[i] > 0.5) col.lerp(PAL.tundra, 0.6);
        if (trees.has(i)) col.lerp(PAL.forest, 0.75);
        const hh = map.height[i];
        if (hh) col.copy(hh <= 2 ? PAL.rockLow : PAL.rock).lerp(PAL.snow, Math.min(1, Math.max(0, hh - 5) / 3)).multiplyScalar(1.04 - hh * 0.015);
      }
      put(img.data, i * 4, col);
    }
    // the tiles, scaled up smoothly, then the buildings on top as little roofs
    const tc = document.createElement('canvas');
    tc.width = N; tc.height = N;
    tc.getContext('2d')!.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(tc, 0, 0, S, S);
    for (const b of this.host.buildings()) {
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(b.x * k + k * 0.35, b.z * k + k * 0.35, b.size * k, b.size * k);
      g.fillStyle = b.color;
      g.fillRect(b.x * k + k * 0.1, b.z * k + k * 0.1, b.size * k - k * 0.2, b.size * k - k * 0.2);
    }
    // the edges fade into the land around it
    const d = g.getImageData(0, 0, S, S);
    const f = S * 0.035;
    for (let y = 0; y < S; y++) {
      const ey = Math.min(y, S - 1 - y);
      for (let x = 0; x < S; x++) {
        const e = Math.min(ey, x, S - 1 - x);
        if (e >= f) continue;
        const a = e / f;
        d.data[(y * S + x) * 4 + 3] = 255 * a * a * (3 - 2 * a);
      }
    }
    g.putImageData(d, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (this.land) { this.group.remove(this.land); this.land.geometry.dispose(); (this.land.material as THREE.MeshStandardMaterial).map?.dispose(); (this.land.material as THREE.Material).dispose(); }
    this.land = new THREE.Mesh(new THREE.SphereGeometry(R * 1.002, 96, 96, P0, SPAN, T0, SPAN), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }));
    this.group.add(this.land);
  }

  /** A small name tag over every town (a dot in the town's colour, yours in amber). */
  private townMarkers() {
    for (const m of [...this.markers.children] as THREE.Sprite[]) { m.material.map?.dispose(); m.material.dispose(); this.markers.remove(m); }
    for (const tw of this.host.towns()) {
      const a = tileAngles(tw.x, tw.z);
      const c = townTag(tw.name, tw.mine ? '#f2a93b' : tw.tint, tw.friend);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false }));
      s.center.set(0.5, 0);
      s.position.copy(point(a.phi, a.theta, R * 1.004));
      s.userData = { w: c.width / c.height, town: tw };
      s.renderOrder = 10;
      this.markers.add(s);
    }
  }

  private atmosphere() {
    const glow = (side: THREE.Side, r: number, power: number, alpha: number) => new THREE.Mesh(
      new THREE.SphereGeometry(r, 96, 48),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side, blending: THREE.AdditiveBlending,
        uniforms: { power: { value: power }, alpha: { value: alpha } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: side === THREE.BackSide
          ? 'uniform float power; uniform float alpha; varying vec3 vN; varying vec3 vV; void main(){ float k = pow(max(0.0, dot(vN, vV) + 0.55), power); gl_FragColor = vec4(0.42, 0.72, 1.0, 1.0) * k * alpha; }'
          : 'uniform float power; uniform float alpha; varying vec3 vN; varying vec3 vV; void main(){ float k = pow(1.0 - max(0.0, dot(vN, vV)), power); gl_FragColor = vec4(0.55, 0.8, 1.0, 1.0) * k * alpha; }',
      }),
    );
    this.group.add(glow(THREE.BackSide, R * 1.14, 3.2, 0.85), glow(THREE.FrontSide, R * 1.004, 2.6, 0.9));
  }

  private stars() {
    const n = 2500, pos = new Float32Array(n * 3), cols = new Float32Array(n * 3);
    let s = 1234567;
    const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 40;
      const q = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * q * r, u * r, Math.sin(a) * q * r], i * 3);
      const b = 0.45 + rnd() * 0.55, warm = rnd();
      cols.set([b, b * (0.92 + warm * 0.08), b * (1.05 - warm * 0.15)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  }

  // ---------- controls ----------
  private down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    this.ui.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.press = { x: e.clientX, y: e.clientY, moved: false, time: performance.now() };
    this.vel = { x: 0, y: 0 };
    this.idle = 0;
    if (this.pointers.size === 2) this.pinch = this.spread();
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || this.leaving) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6) this.press.moved = true;
    this.idle = 0;
    if (this.pointers.size === 2) {
      const d = this.spread();
      if (this.pinch > 10 && d > 10) this.zoom(this.pinch / d);
      this.pinch = d;
      return;
    }
    // turn the planet: the surface follows the finger (slower when close)
    const k = (this.dist - R * 0.92) * 1.4 / Math.max(300, window.innerHeight);
    this.phi -= dx * k;
    this.theta = THREE.MathUtils.clamp(this.theta - dy * k, 0.2, Math.PI - 0.2);
    const dt = Math.max(1, performance.now() - this.press.time) / 1000;
    this.press.time = performance.now();
    this.vel = { x: (-dx * k) / Math.max(0.016, dt), y: (-dy * k) / Math.max(0.016, dt) };
  };

  private up = (e: PointerEvent) => {
    const wasTap = this.pointers.size === 1 && !this.press.moved;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    if (wasTap) this.tap(e.clientX, e.clientY);
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.idle = 0;
    this.zoom(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  };

  private key = (e: KeyboardEvent) => {
    if (!this.active) return;
    if (e.key === 'Escape') { const f = this.host.focus(); this.leave(f.x, f.z); }
  };

  private spread() { const [a, b] = [...this.pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }

  /** Zoom; going in past the closest view lands on the map under the middle of the screen. */
  private zoom(f: number) {
    if (this.leaving) return;
    if (f < 1 && this.goal <= MIN_D + 0.01) {
      const tile = this.placeAt(this.phi, this.theta);
      this.leave(tile.x, tile.z);
      return;
    }
    this.goal = THREE.MathUtils.clamp(R + (this.goal - R) * f, MIN_D, this.maxD);
  }

  /** The place under these angles anywhere on the planet (x round the world, z from pole to pole). */
  private placeAt(phi: number, theta: number) {
    return { x: Math.floor(wrapX(((phi - P0) / SPAN) * N)), z: Math.floor(((theta - T0) / SPAN) * N) };
  }

  /** A tap: on a town's tag → go there; on our land → land there. */
  private tap(cx: number, cy: number) {
    const r = this.ui.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects(this.markers.children.filter((m) => m.visible), false)[0];
    if (hit) { const tw = hit.object.userData.town as GlobeTown; this.leave(tw.x, tw.z); return; }
    const g = this.ray.intersectObject(this.group.getObjectByName('planet')!, false)[0];
    if (!g) return;
    const v = g.point.clone().normalize();
    const theta = Math.acos(THREE.MathUtils.clamp(v.y, -1, 1));
    const phi = Math.atan2(v.z, -v.x);
    const tile = this.placeAt(phi, theta);
    this.leave(tile.x, tile.z);
  }

  dispose() {
    window.removeEventListener('keydown', this.key);
    this.ui.remove();
    this.veil?.remove();
    document.body.classList.remove('globe-on');
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material & { map?: THREE.Texture };
      if (mat) { mat.map?.dispose(); mat.dispose(); }
    });
  }
}

/** A small, quiet name tag: a dark pill with a coloured dot and the name (the same for towns on the globe and friends' towns on the map). */
export function townTag(name: string, color: string, friend = false) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '700 30px Nunito, system-ui, sans-serif';
  g.font = font;
  const text = name.length > 22 ? `${name.slice(0, 21)}…` : name;
  const w = Math.ceil(g.measureText(text).width) + 58;
  c.width = w; c.height = 52;
  g.font = font;
  g.fillStyle = 'rgba(14,17,21,.74)';
  g.beginPath(); g.roundRect(1, 1, w - 2, 50, 25); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(25, 26, 7.5, 0, Math.PI * 2); g.fill();
  if (friend) { g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath(); g.arc(25, 26, 12.5, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#f4f6f8'; g.textBaseline = 'middle';
  g.fillText(text, 43, 27);
  return c;
}

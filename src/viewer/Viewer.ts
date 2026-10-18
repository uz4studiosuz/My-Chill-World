import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { transform } from 'sucrase';

/**
 * /viewer — a hidden page (linked from nowhere): paste any model file of the game (TypeScript, as it is) and press
 * RUN. Its imports (three, utils/voxel, details, _shared…) are the game's own modules; every exported function that
 * gives a geometry or a 3D object is drawn, and you can turn round it.
 */

// the game's modules a pasted file may import, by path
const MODULES = import.meta.glob(['../models/**/*.ts', '../utils/*.ts', '../buildings/BuildingTypes.ts', '../fx/BakedShade.ts', '../world/grid.ts', '../config.ts'], { eager: true }) as Record<string, Record<string, unknown>>;
const KEY = 'mcw_viewer_code';

/** The module for an import path: the one whose path ends the same way (the more parts match, the better). */
function resolve(spec: string): Record<string, unknown> {
  if (spec === 'three') return THREE as unknown as Record<string, unknown>;
  const want = spec.replace(/\.(ts|js)$/, '').split('/').filter((p) => p && p !== '.' && p !== '..');
  let best: Record<string, unknown> | null = null, score = 0;
  for (const [path, mod] of Object.entries(MODULES)) {
    const have = path.replace(/\.ts$/, '').split('/');
    let n = 0;
    while (n < want.length && n < have.length && want[want.length - 1 - n] === have[have.length - 1 - n]) n++;
    if (n > score) { score = n; best = mod; }
  }
  if (!best) throw new Error(`Cannot find the module "${spec}" in the game`);
  return best;
}

export class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  private controls: OrbitControls;
  private shown = new THREE.Group();
  private ta: HTMLTextAreaElement;
  private out: HTMLDivElement;
  private pick: HTMLSelectElement;
  private results: { name: string; obj: THREE.Object3D }[] = [];
  private wire = false;

  constructor(root: HTMLElement) {
    document.title = 'My Chill World — Viewer';
    root.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'vw';
    wrap.innerHTML = `
      <div class="vw-left">
        <div class="vw-bar"><b>Viewer</b><span>Paste a model file (.ts) as it is · Ctrl+Enter</span><button class="vw-run">▶ RUN</button></div>
        <textarea spellcheck="false" placeholder="import * as THREE from 'three';&#10;import { box, merge } from '../../utils/voxel';&#10;&#10;export function myGeometry(): THREE.BufferGeometry {&#10;  return merge([box(0.8, 0.4, 0.8, 0, 0.2, 0, '#e8738f')]);&#10;}"></textarea>
        <div class="vw-out"></div>
      </div>
      <div class="vw-right">
        <canvas></canvas>
        <div class="vw-tools"><select></select><button class="vw-wire">Wireframe</button><button class="vw-fit">Fit</button><button class="vw-bg">Background</button></div>
      </div>`;
    root.appendChild(wrap);
    this.ta = wrap.querySelector('textarea')!;
    this.out = wrap.querySelector('.vw-out')!;
    this.pick = wrap.querySelector('select')!;
    const canvas = wrap.querySelector('canvas')!;
    try { this.ta.value = localStorage.getItem(KEY) ?? ''; } catch { /* private mode */ }

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color('#9fc3d1');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b7a5a', 1.4));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.position.set(3, 5, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#8cb156' }));
    ground.receiveShadow = true;
    ground.position.y = -0.001;
    this.scene.add(ground, new THREE.GridHelper(10, 10, '#5d7a3c', '#7a9a55'), this.shown);
    this.camera.position.set(1.6, 1.3, 1.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.3, 0);
    this.controls.enableDamping = true;

    const run = () => this.run();
    wrap.querySelector('.vw-run')!.addEventListener('click', run);
    this.ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      // a tab key writes two spaces instead of leaving the box
      if (e.key === 'Tab') { e.preventDefault(); const s = this.ta.selectionStart; this.ta.setRangeText('  ', s, this.ta.selectionEnd, 'end'); }
    });
    this.pick.addEventListener('change', () => this.show(Number(this.pick.value)));
    wrap.querySelector('.vw-wire')!.addEventListener('click', () => { this.wire = !this.wire; this.show(Number(this.pick.value) || 0); });
    wrap.querySelector('.vw-fit')!.addEventListener('click', () => this.fit());
    wrap.querySelector('.vw-bg')!.addEventListener('click', () => {
      const bg = this.scene.background as THREE.Color;
      bg.set(bg.getHexString() === '9fc3d1' ? '#1a1d22' : bg.getHexString() === '1a1d22' ? '#f4f4f2' : '#9fc3d1');
    });
    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      this.renderer.setSize(r.width, r.height, false);
      this.camera.aspect = r.width / Math.max(1, r.height);
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas.parentElement!);
    resize();
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    loop();
    if (this.ta.value.trim()) run();
    document.getElementById('loading')?.classList.add('done');
  }

  /** Turn the TypeScript into JavaScript, run it with the game's modules and draw what its exports make. */
  private run() {
    const src = this.ta.value;
    try { localStorage.setItem(KEY, src); } catch { /* private mode */ }
    this.results = [];
    this.pick.replaceChildren();
    const log: string[] = [];
    try {
      const js = transform(src, { transforms: ['typescript', 'imports'], production: true }).code;
      const module = { exports: {} as Record<string, unknown> };
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function('require', 'exports', 'module', js)(resolve, module.exports, module);
      for (const [name, value] of Object.entries(module.exports)) {
        if (typeof value === 'function') {
          try {
            const r = (value as () => unknown)();
            const obj = this.toObject(r);
            if (obj) { this.results.push({ name, obj }); continue; }
            log.push(`· ${name}(): returned ${r === undefined ? 'nothing' : typeof r} — not drawn`);
          } catch (e) { log.push(`· ${name}(): ${(e as Error).message}`); }
        } else {
          const obj = this.toObject(value);
          if (obj) this.results.push({ name, obj });
        }
      }
      if (!this.results.length) throw new Error(`Nothing to draw: export a function that returns a THREE.BufferGeometry, Mesh or Group.${log.length ? '\n' + log.join('\n') : ''}`);
      this.results.forEach((r, i) => { const o = document.createElement('option'); o.value = `${i}`; o.textContent = r.name; this.pick.appendChild(o); });
      this.show(0);
      this.fit();
      const g = this.results[0].obj;
      const tris = countTris(g);
      this.say(`✓ ${this.results.length} model${this.results.length > 1 ? 's' : ''} · ${tris.toLocaleString('en-US')} triangles${log.length ? '\n' + log.join('\n') : ''}`, false);
    } catch (e) {
      this.shown.clear();
      this.say(`✗ ${(e as Error).message}`, true);
      console.error(e);
    }
  }

  /** A geometry becomes a mesh with the game's look (vertex colours); a mesh or group is shown as it is. */
  private toObject(v: unknown): THREE.Object3D | null {
    if (v instanceof THREE.BufferGeometry) {
      const hasColor = !!v.getAttribute('color');
      const m = new THREE.Mesh(v, new THREE.MeshLambertMaterial({ vertexColors: hasColor, color: hasColor ? '#ffffff' : '#c9c2b4' }));
      m.castShadow = m.receiveShadow = true;
      return m;
    }
    if (v instanceof THREE.Object3D) { v.traverse((o) => { o.castShadow = o.receiveShadow = true; }); return v; }
    return null;
  }

  private show(i: number) {
    this.shown.clear();
    const r = this.results[i];
    if (!r) return;
    this.shown.add(r.obj);
    r.obj.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material & { wireframe?: boolean } | undefined;
      if (mat && 'wireframe' in mat) mat.wireframe = this.wire;
    });
  }

  /** Point the camera at the whole model. */
  private fit() {
    const box = new THREE.Box3().setFromObject(this.shown);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 1;
    this.controls.target.copy(c);
    this.camera.position.copy(c).add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(size * 2));
  }

  private say(text: string, bad: boolean) {
    this.out.textContent = text;
    this.out.classList.toggle('bad', bad);
  }
}

function countTris(o: THREE.Object3D) {
  let n = 0;
  o.traverse((x) => { const g = (x as THREE.Mesh).geometry; if (g) n += (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3; });
  return Math.round(n);
}

const CSS = `
html, body { overflow: hidden; }
.vw { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(320px, 42%) 1fr; grid-template-rows: 100%; background: #15181d; color: #eceef1; font: 13px/1.4 Nunito, system-ui, sans-serif; z-index: 50; }
.vw-left { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; border-right: 1px solid #343a43; }
.vw-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #343a43; }
.vw-bar b { font: 600 16px Fredoka, system-ui; }
.vw-bar span { color: #8e96a1; font-size: 12px; flex: 1; }
.vw-run { border: 0; border-radius: 8px; background: #3ecf8e; color: #0b2417; font: 800 13px Nunito, system-ui; padding: 8px 16px; cursor: pointer; }
.vw textarea { flex: 1; min-height: 0; resize: none; border: 0; outline: none; background: #111418; color: #e6ecf2; font: 12.5px/1.5 ui-monospace, Consolas, monospace; padding: 12px; tab-size: 2; white-space: pre; user-select: text; -webkit-user-select: text; }
.vw-out { max-height: 30%; overflow: auto; padding: 8px 12px; border-top: 1px solid #343a43; white-space: pre-wrap; font: 12px/1.45 ui-monospace, Consolas, monospace; color: #6fcf97; }
.vw-out.bad { color: #f07167; }
.vw-right { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.vw-right canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.vw-tools { position: absolute; top: 10px; left: 10px; display: flex; gap: 6px; }
.vw-tools select, .vw-tools button { background: rgba(21,24,29,.85); color: #eceef1; border: 1px solid #343a43; border-radius: 8px; padding: 6px 10px; font: 700 12px Nunito, system-ui; cursor: pointer; }
@media (max-width: 760px) { .vw { grid-template-columns: 1fr; grid-template-rows: 45% 55%; } .vw-left { border-right: 0; border-bottom: 1px solid #343a43; } }
`;

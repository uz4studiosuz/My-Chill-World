import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { buildingGeometry } from '../buildings/Buildings';
import { BUILDINGS, BuildingKind } from '../buildings/BuildingTypes';
import { t } from '../i18n/i18n';
import { ShapeKind, orient, unitShape } from '../utils/voxel';

/** One box of a voxel model — the same shape the game's models are made of: box(w, h, d, x, y, z, color). */
/** A part of the model: a box, or a round / sloped shape, turned along an axis. */
interface Part { id: number; w: number; h: number; d: number; x: number; y: number; z: number; color: string; name?: string; shape?: ShapeKind; axis?: 'x' | 'y' | 'z' }

interface ModelFile { format: 'mcw-model'; version: 1; name: string; size: 1 | 2 | 3; parts: Omit<Part, 'id'>[] }

const KEY = 'mcw_editor';
const PALETTE = [
  '#efe6d2', '#dbe5ec', '#f1dcc6', '#e8e0f0', '#ffffff', '#cfc8b6', '#9d9d9a', '#5d6670', '#3d4148', '#26292e',
  '#c4553d', '#d9443b', '#e85a3a', '#e8a13a', '#f2c230', '#f2b33d', '#4f8a3a', '#5f9a3e', '#76b04f', '#2d5a32',
  '#3a6fd1', '#3f6fb5', '#2d4f8a', '#4fa3d1', '#a8d0e6', '#6f9fc8', '#8a5a35', '#6b4a2e', '#b0478f', '#e85a7a',
];
const round = (v: number) => Math.round(v * 1000) / 1000;
const SHAPE_NAME: Record<ShapeKind, string> = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', cone: 'Cone', dome: 'Dome', wedge: 'Ramp' };

/**
 * Model editor at /editor: build a model from boxes (like every model in the game), recolour, move and resize
 * them, import glTF/OBJ for reference, load an existing game model as a starting point, and export the result
 * as a JSON file or ready-to-paste TypeScript that can be added to the game.
 */
export class Editor {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  private orbit: OrbitControls;
  private gizmo: TransformControls;
  private root = new THREE.Group();
  private imported = new THREE.Group();
  private footprint = new THREE.Group();
  private parts: Part[] = [];
  private meshes = new Map<number, THREE.Mesh>();
  private selected: number[] = [];
  private nextId = 1;
  private name = 'my_model';
  private size: 1 | 2 | 3 = 1;
  private snap = 0.01;
  private color = '#efe6d2';
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private ui!: { list: HTMLDivElement; props: HTMLDivElement; status: HTMLDivElement; name: HTMLInputElement; size: HTMLSelectElement; swatch: HTMLInputElement };
  private ray = new THREE.Raycaster();
  private down = { x: 0, y: 0 };

  constructor(private host: HTMLElement) {
    document.title = 'My Chill World — Editor';
    document.body.classList.add('editor-page');
    host.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.className = 'ed-canvas';
    host.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color('#1a1d22');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6f7f4c', 1.6));
    const sun = new THREE.DirectionalLight('#fff3df', 2.2);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -3; sc.right = sc.top = 3;
    this.scene.add(sun, this.root, this.imported, this.footprint);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7fa65a' }));
    ground.position.y = -0.001;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);
    const grid = new THREE.GridHelper(12, 12 * 10, '#3d5a2a', '#5f8a45');
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(grid);

    this.camera.position.set(2.2, 2.0, 2.6);
    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.target.set(0, 0.3, 0);
    this.orbit.enableDamping = true;
    this.gizmo = new TransformControls(this.camera, canvas);
    this.gizmo.setSize(0.8);
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
      if (e.value) this.pushUndo();
      else this.syncFromGizmo();
    });
    this.gizmo.addEventListener('objectChange', () => this.syncFromGizmo(false));
    this.scene.add(this.gizmo.getHelper());

    this.buildUi();
    this.load();
    this.drawFootprint();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.key(e));
    canvas.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => { if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5) this.pick(e); });
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.orbit.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  // ---------- UI ----------

  private buildUi() {
    const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
    const btn = (label: string, fn: () => void, cls = 'ed-btn', title = '') => {
      const b = h('button', cls) as HTMLButtonElement;
      b.textContent = label;
      if (title) b.title = title;
      b.addEventListener('click', fn);
      return b;
    };

    const top = h('div', 'ed-top');
    const title = h('b', 'ed-title', 'My Chill World · <span>' + t('Model editor') + '</span>');
    const name = h('input', 'ed-input ed-name') as HTMLInputElement;
    name.value = this.name;
    name.title = t('Model name');
    name.addEventListener('change', () => { this.name = name.value.replace(/[^a-zA-Z0-9_]/g, '_') || 'my_model'; name.value = this.name; this.save(); });
    const size = h('select', 'ed-input') as HTMLSelectElement;
    for (const n of [1, 2, 3]) { const o = h('option') as HTMLOptionElement; o.value = `${n}`; o.textContent = t('{n}×{n} tiles', { n }); size.appendChild(o); }
    size.addEventListener('change', () => { this.size = +size.value as 1 | 2 | 3; this.drawFootprint(); this.save(); });
    const file = h('input') as HTMLInputElement;
    file.type = 'file';
    file.accept = '.json,.glb,.gltf,.obj';
    file.style.display = 'none';
    file.addEventListener('change', () => { if (file.files?.[0]) this.importFile(file.files[0]); file.value = ''; });
    const template = h('select', 'ed-input') as HTMLSelectElement;
    const first = h('option') as HTMLOptionElement;
    first.textContent = t('Start from a game model…');
    first.value = '';
    template.appendChild(first);
    for (const k of Object.keys(BUILDINGS) as BuildingKind[]) {
      if (!BUILDINGS[k].buildable) continue;
      const o = h('option') as HTMLOptionElement;
      o.value = k;
      o.textContent = t(BUILDINGS[k].name);
      template.appendChild(o);
    }
    template.addEventListener('change', () => { if (template.value) this.fromGame(template.value as BuildingKind); template.value = ''; });
    top.append(
      title, name, size, template,
      btn(t('New'), () => { if (confirm(t('Start a new empty model?'))) { this.pushUndo(); this.parts = []; this.imported.clear(); this.rebuild(); } }),
      btn(t('Import'), () => file.click(), 'ed-btn', t('JSON from this editor, or a .glb / .gltf / .obj model')),
      btn(t('Export JSON'), () => this.exportJson(), 'ed-btn primary'),
      btn(t('Copy code'), () => this.copyCode(), 'ed-btn', t('TypeScript for the game: box(w, h, d, x, y, z, color)')),
      btn(t('Export GLB'), () => this.exportGlb()),
      btn(t('Screenshot'), () => this.screenshot()),
      btn(t('Back to game'), () => { location.href = location.pathname.replace(/editor(\.html)?\/?$/, '') || './'; }),
      file,
    );

    const left = h('div', 'ed-panel ed-left');
    left.append(h('div', 'ed-h', t('Add')));
    const adds = h('div', 'ed-grid2');
    adds.append(
      btn(t('Box'), () => this.add({ w: 0.2, h: 0.2, d: 0.2, x: 0, y: 0.1, z: 0 })),
      btn(t('Wall'), () => this.add({ w: 0.6, h: 0.4, d: 0.05, x: 0, y: 0.2, z: 0 })),
      btn(t('Floor'), () => this.add({ w: 0.9, h: 0.02, d: 0.9, x: 0, y: 0.01, z: 0 })),
      btn(t('Roof'), () => this.add({ w: 0.7, h: 0.1, d: 0.6, x: 0, y: 0.47, z: 0, color: '#c4553d' })),
      btn(t('Window'), () => this.add({ w: 0.12, h: 0.1, d: 0.02, x: 0, y: 0.26, z: 0.21, color: '#a8d0e6' })),
      btn(t('Door'), () => this.add({ w: 0.12, h: 0.2, d: 0.02, x: 0, y: 0.1, z: 0.21, color: '#6b4a2e' })),
      btn(t('Pillar'), () => this.add({ w: 0.05, h: 0.4, d: 0.05, x: 0, y: 0.2, z: 0, color: '#f4f1ea' })),
      btn(t('Tree'), () => this.addTree()),
      btn(t('Cylinder'), () => this.add({ w: 0.2, h: 0.3, d: 0.2, x: 0, y: 0.15, z: 0, shape: 'cylinder' })),
      btn(t('Sphere'), () => this.add({ w: 0.2, h: 0.2, d: 0.2, x: 0, y: 0.1, z: 0, shape: 'sphere' })),
      btn(t('Cone'), () => this.add({ w: 0.24, h: 0.3, d: 0.24, x: 0, y: 0.15, z: 0, shape: 'cone' })),
      btn(t('Dome'), () => this.add({ w: 0.4, h: 0.2, d: 0.4, x: 0, y: 0.1, z: 0, shape: 'dome' })),
      btn(t('Ramp'), () => this.add({ w: 0.3, h: 0.15, d: 0.3, x: 0, y: 0.075, z: 0, shape: 'wedge' })),
      btn(t('Wheel'), () => this.add({ w: 0.03, h: 0.06, d: 0.06, x: 0, y: 0.03, z: 0, shape: 'cylinder', axis: 'x', color: '#1f2226' })),
    );
    left.append(adds, h('div', 'ed-h', t('Colour')));
    const pal = h('div', 'ed-palette');
    for (const c of PALETTE) {
      const s = h('button', 'ed-swatch') as HTMLButtonElement;
      s.style.background = c;
      s.title = c;
      s.addEventListener('click', () => this.setColor(c));
      pal.appendChild(s);
    }
    const swatch = h('input', 'ed-color') as HTMLInputElement;
    swatch.type = 'color';
    swatch.value = this.color;
    swatch.addEventListener('input', () => this.setColor(swatch.value));
    left.append(pal, swatch, h('div', 'ed-h', t('Tools')));
    const tools = h('div', 'ed-grid2');
    tools.append(
      btn(t('Move') + ' (G)', () => this.gizmo.setMode('translate')),
      btn(t('Resize') + ' (S)', () => this.gizmo.setMode('scale')),
      btn(t('Duplicate') + ' (D)', () => this.duplicate()),
      btn(t('Delete') + ' (Del)', () => this.remove()),
      btn(t('Mirror X'), () => this.mirror()),
      btn(t('To ground'), () => this.toGround()),
      btn(t('Undo') + ' (Z)', () => this.undo()),
      btn(t('Redo') + ' (Y)', () => this.redo()),
    );
    const snapSel = h('select', 'ed-input') as HTMLSelectElement;
    for (const v of [0, 0.005, 0.01, 0.02, 0.05, 0.1]) { const o = h('option') as HTMLOptionElement; o.value = `${v}`; o.textContent = v ? `${t('Snap')} ${v}` : t('No snap'); if (v === this.snap) o.selected = true; snapSel.appendChild(o); }
    snapSel.addEventListener('change', () => { this.snap = +snapSel.value; this.applySnap(); });
    left.append(tools, snapSel);
    const help = h('div', 'ed-help', t('Click a box to select it, Shift+click to select several. Drag the arrows to move. The yellow outline is the building plot; the arrow points to the road (front).'));
    left.append(help);

    const right = h('div', 'ed-panel ed-right');
    const props = h('div', 'ed-props') as HTMLDivElement;
    const list = h('div', 'ed-list') as HTMLDivElement;
    right.append(h('div', 'ed-h', t('Selected')), props, h('div', 'ed-h', t('Parts')), list);
    const status = h('div', 'ed-status') as HTMLDivElement;
    this.host.append(top, left, right, status);
    this.ui = { list, props, status, name, size, swatch };
    this.injectStyle();
  }

  private renderList() {
    const { list } = this.ui;
    list.replaceChildren();
    this.parts.forEach((p, i) => {
      const row = document.createElement('button');
      row.className = 'ed-row' + (this.selected.includes(p.id) ? ' on' : '');
      row.innerHTML = `<i style="background:${p.color};border-radius:${p.shape && p.shape !== 'box' && p.shape !== 'wedge' ? '50%' : '3px'}"></i><span>${p.name ?? t(SHAPE_NAME[p.shape ?? 'box'])} ${i + 1}</span><small>${p.w}×${p.h}×${p.d}</small>`;
      row.addEventListener('click', (e) => this.select(p.id, e.shiftKey));
      list.appendChild(row);
    });
    const n = this.imported.children.length;
    this.ui.status.textContent = `${this.parts.length} ${t('parts')}${n ? ` · ${n} ${t('imported models')}` : ''} · ${t('Plot')} ${this.size}×${this.size}`;
  }

  private renderProps() {
    const { props } = this.ui;
    props.replaceChildren();
    const p = this.parts.find((q) => q.id === this.selected[0]);
    if (!p) {
      props.innerHTML = `<div class="ed-empty">${t('Nothing selected')}</div>`;
      return;
    }
    const field = (key: 'w' | 'h' | 'd' | 'x' | 'y' | 'z', label: string) => {
      const wrap = document.createElement('label');
      wrap.className = 'ed-field';
      wrap.innerHTML = `<span>${label}</span>`;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '0.01';
      inp.value = `${p[key]}`;
      inp.addEventListener('change', () => {
        this.pushUndo();
        const v = parseFloat(inp.value);
        if (!Number.isFinite(v)) return;
        p[key] = round(key === 'w' || key === 'h' || key === 'd' ? Math.max(0.005, v) : v);
        this.rebuild();
      });
      wrap.appendChild(inp);
      return wrap;
    };
    const grid = document.createElement('div');
    grid.className = 'ed-fields';
    grid.append(field('w', t('Width')), field('h', t('Height')), field('d', t('Depth')), field('x', 'X'), field('y', 'Y'), field('z', 'Z'));
    const nm = document.createElement('input');
    nm.className = 'ed-input';
    nm.placeholder = t('Part name');
    // shape and direction of the selected part
    const shapeSel = document.createElement('select');
    shapeSel.className = 'ed-input';
    for (const [v, label] of [['box', 'Box'], ['cylinder', 'Cylinder'], ['sphere', 'Sphere'], ['cone', 'Cone'], ['dome', 'Dome'], ['wedge', 'Ramp']] as const) {
      const o = document.createElement('option'); o.value = v; o.textContent = t(label); if ((p.shape ?? 'box') === v) o.selected = true; shapeSel.appendChild(o);
    }
    shapeSel.addEventListener('change', () => { this.pushUndo(); p.shape = shapeSel.value === 'box' ? undefined : shapeSel.value as ShapeKind; this.rebuild(); });
    const axisSel = document.createElement('select');
    axisSel.className = 'ed-input';
    for (const [v, label] of [['y', 'Upright (Y)'], ['x', 'Sideways (X)'], ['z', 'Forward (Z)']] as const) {
      const o = document.createElement('option'); o.value = v; o.textContent = t(label); if ((p.axis ?? 'y') === v) o.selected = true; axisSel.appendChild(o);
    }
    axisSel.addEventListener('change', () => { this.pushUndo(); p.axis = axisSel.value === 'y' ? undefined : axisSel.value as 'x' | 'z'; this.rebuild(); });
    nm.value = p.name ?? '';
    nm.addEventListener('change', () => { p.name = nm.value || undefined; this.renderList(); this.save(); });
    props.append(grid, shapeSel, axisSel, nm);
  }

  // ---------- model ----------

  private add(p: Partial<Part> & Pick<Part, 'w' | 'h' | 'd' | 'x' | 'y' | 'z'>) {
    this.pushUndo();
    const part: Part = { color: this.color, ...p, id: this.nextId++ };
    this.parts.push(part);
    this.rebuild();
    this.select(part.id);
  }

  private addTree() {
    this.pushUndo();
    const ids: number[] = [];
    for (const p of [
      { w: 0.06, h: 0.2, d: 0.06, x: 0, y: 0.1, z: 0, color: '#6b4a2e', name: 'Trunk' },
      { w: 0.3, h: 0.24, d: 0.3, x: 0, y: 0.3, z: 0, color: '#4f8a3a', name: 'Leaves' },
      { w: 0.2, h: 0.12, d: 0.2, x: 0, y: 0.46, z: 0, color: '#5f9a3e', name: 'Leaves' },
    ]) { const id = this.nextId++; this.parts.push({ ...p, id }); ids.push(id); }
    this.rebuild();
    this.selected = ids;
    this.refreshSelection();
  }

  private rebuild() {
    for (const m of this.meshes.values()) { this.root.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.meshes.clear();
    for (const p of this.parts) {
      const m = new THREE.Mesh(orient(unitShape(p.shape ?? 'box', 32), p.axis ?? 'y'), new THREE.MeshLambertMaterial({ color: p.color }));
      m.scale.set(p.w, p.h, p.d);
      m.position.set(p.x, p.y, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.part = p.id;
      this.root.add(m);
      this.meshes.set(p.id, m);
    }
    this.selected = this.selected.filter((id) => this.meshes.has(id));
    this.refreshSelection();
    this.save();
  }

  private select(id: number | null, add = false) {
    if (id === null) this.selected = [];
    else if (add) this.selected = this.selected.includes(id) ? this.selected.filter((s) => s !== id) : [...this.selected, id];
    else this.selected = [id];
    this.refreshSelection();
  }

  private refreshSelection() {
    for (const [id, m] of this.meshes) {
      const mat = m.material as THREE.MeshLambertMaterial;
      mat.emissive.set(this.selected.includes(id) ? '#3a2a00' : '#000000');
    }
    const first = this.selected.length === 1 ? this.meshes.get(this.selected[0]) : undefined;
    if (first) this.gizmo.attach(first);
    else this.gizmo.detach();
    const p = this.parts.find((q) => q.id === this.selected[0]);
    if (p) { this.color = p.color; this.ui.swatch.value = p.color; }
    this.renderList();
    this.renderProps();
  }

  private syncFromGizmo(commit = true) {
    const id = this.selected[0];
    const m = id !== undefined ? this.meshes.get(id) : undefined;
    const p = this.parts.find((q) => q.id === id);
    if (!m || !p) return;
    const s = this.snap || 0.001;
    const q = (v: number) => round(Math.round(v / s) * s);
    p.x = q(m.position.x); p.y = q(m.position.y); p.z = q(m.position.z);
    p.w = Math.max(0.005, q(Math.abs(m.scale.x))); p.h = Math.max(0.005, q(Math.abs(m.scale.y))); p.d = Math.max(0.005, q(Math.abs(m.scale.z)));
    if (commit) {
      m.position.set(p.x, p.y, p.z);
      m.scale.set(p.w, p.h, p.d);
      this.renderProps();
      this.renderList();
      this.save();
    }
  }

  private applySnap() {
    if (!this.snap) return;
    this.gizmo.setTranslationSnap(this.snap);
    this.gizmo.setScaleSnap(this.snap);
  }

  private setColor(c: string) {
    this.color = c;
    this.ui.swatch.value = c;
    if (!this.selected.length) return;
    this.pushUndo();
    for (const p of this.parts) if (this.selected.includes(p.id)) p.color = c;
    this.rebuild();
  }

  private duplicate() {
    if (!this.selected.length) return;
    this.pushUndo();
    const ids: number[] = [];
    for (const p of this.parts.filter((q) => this.selected.includes(q.id))) {
      const id = this.nextId++;
      this.parts.push({ ...p, id, x: round(p.x + 0.1) });
      ids.push(id);
    }
    this.rebuild();
    this.selected = ids;
    this.refreshSelection();
  }

  private remove() {
    if (!this.selected.length) return;
    this.pushUndo();
    this.parts = this.parts.filter((p) => !this.selected.includes(p.id));
    this.selected = [];
    this.rebuild();
  }

  private mirror() {
    if (!this.selected.length) return;
    this.pushUndo();
    const ids: number[] = [];
    for (const p of this.parts.filter((q) => this.selected.includes(q.id))) {
      const id = this.nextId++;
      this.parts.push({ ...p, id, x: round(-p.x) });
      ids.push(id);
    }
    this.rebuild();
    this.selected = ids;
    this.refreshSelection();
  }

  private toGround() {
    if (!this.selected.length) return;
    this.pushUndo();
    for (const p of this.parts) if (this.selected.includes(p.id)) p.y = round(p.h / 2);
    this.rebuild();
  }

  /** Split one of the game's models back into its boxes (24 vertices each). */
  private fromGame(kind: BuildingKind) {
    const g = buildingGeometry(kind).toNonIndexed();
    const pos = g.attributes.position, col = g.attributes.color;
    const n = pos.count;
    const per = 36; // a non-indexed box has 36 vertices
    if (n % per) { alert(t('This model is not made only of boxes and cannot be split.')); return; }
    this.pushUndo();
    this.parts = [];
    const c = new THREE.Color();
    for (let i = 0; i < n; i += per) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let j = i; j < i + per; j++) {
        x0 = Math.min(x0, pos.getX(j)); x1 = Math.max(x1, pos.getX(j));
        y0 = Math.min(y0, pos.getY(j)); y1 = Math.max(y1, pos.getY(j));
        z0 = Math.min(z0, pos.getZ(j)); z1 = Math.max(z1, pos.getZ(j));
      }
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace);
      this.parts.push({ id: this.nextId++, w: round(x1 - x0), h: round(y1 - y0), d: round(z1 - z0), x: round((x0 + x1) / 2), y: round((y0 + y1) / 2), z: round((z0 + z1) / 2), color: `#${c.getHexString()}` });
    }
    this.size = Math.min(3, BUILDINGS[kind].size) as 1 | 2 | 3;
    this.ui.size.value = `${this.size}`;
    this.name = `${kind}_custom`;
    this.ui.name.value = this.name;
    this.drawFootprint();
    this.selected = [];
    this.rebuild();
    this.fit();
  }

  /** Frame the whole plot. */
  private fit() {
    const d = 1.6 + this.size * 1.3;
    this.orbit.target.set(0, 0.3 * this.size, 0);
    this.camera.position.set(d * 0.8, d * 0.75, d);
  }

  private drawFootprint() {
    this.footprint.clear();
    const s = this.size;
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(s, 0.001, s)),
      new THREE.LineBasicMaterial({ color: '#f2b33d' }),
    );
    line.position.y = 0.002;
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.01, s / 2), 0.35, '#f2b33d', 0.12, 0.08);
    this.footprint.add(line, arrow);
  }

  // ---------- picking & keys ----------

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects([...this.meshes.values()], false)[0];
    if (hit) this.select(hit.object.userData.part as number, e.shiftKey);
    else if (!e.shiftKey) this.select(null);
  }

  private key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicate(); return; }
    if (ctrl) return;
    switch (e.key) {
      case 'Delete': case 'Backspace': this.remove(); break;
      case 'g': case 'G': this.gizmo.setMode('translate'); break;
      case 's': case 'S': this.gizmo.setMode('scale'); break;
      case 'd': case 'D': this.duplicate(); break;
      case 'z': case 'Z': this.undo(); break;
      case 'y': case 'Y': this.redo(); break;
      case 'Escape': this.select(null); break;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': case 'PageUp': case 'PageDown': {
        e.preventDefault();
        if (!this.selected.length) return;
        const st = this.snap || 0.01;
        this.pushUndo();
        for (const p of this.parts) {
          if (!this.selected.includes(p.id)) continue;
          if (e.key === 'ArrowLeft') p.x = round(p.x - st);
          if (e.key === 'ArrowRight') p.x = round(p.x + st);
          if (e.key === 'ArrowUp') p.z = round(p.z - st);
          if (e.key === 'ArrowDown') p.z = round(p.z + st);
          if (e.key === 'PageUp') p.y = round(p.y + st);
          if (e.key === 'PageDown') p.y = round(p.y - st);
        }
        this.rebuild();
      }
    }
  }

  // ---------- undo, save ----------

  private snapshot() { return JSON.stringify({ parts: this.parts, size: this.size, name: this.name }); }

  private pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  private restore(json: string) {
    const s = JSON.parse(json) as { parts: Part[]; size: 1 | 2 | 3; name: string };
    this.parts = s.parts;
    this.size = s.size;
    this.name = s.name;
    this.nextId = this.parts.reduce((m, p) => Math.max(m, p.id + 1), 1);
    this.ui.size.value = `${this.size}`;
    this.ui.name.value = this.name;
    this.drawFootprint();
    this.rebuild();
  }

  private undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
  }

  private redo() {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
  }

  private save() {
    try { localStorage.setItem(KEY, this.snapshot()); } catch { /* ignore */ }
  }

  private load() {
    let s: string | null = null;
    try { s = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (s) { try { this.restore(s); return; } catch { /* fall through */ } }
    // a little starter house so the page is not empty
    this.parts = [
      { id: 1, w: 0.62, h: 0.42, d: 0.52, x: 0, y: 0.21, z: -0.06, color: '#efe6d2', name: 'Walls' },
      { id: 2, w: 0.72, h: 0.1, d: 0.62, x: 0, y: 0.47, z: -0.06, color: '#c4553d', name: 'Roof' },
      { id: 3, w: 0.56, h: 0.1, d: 0.46, x: 0, y: 0.57, z: -0.06, color: '#c4553d', name: 'Roof' },
      { id: 4, w: 0.12, h: 0.2, d: 0.02, x: 0, y: 0.1, z: 0.205, color: '#6b4a2e', name: 'Door' },
      { id: 5, w: 0.12, h: 0.1, d: 0.02, x: -0.19, y: 0.26, z: 0.205, color: '#a8d0e6', name: 'Window' },
      { id: 6, w: 0.12, h: 0.1, d: 0.02, x: 0.19, y: 0.26, z: 0.205, color: '#a8d0e6', name: 'Window' },
    ];
    this.nextId = 7;
    this.rebuild();
  }

  // ---------- import / export ----------

  private model(): ModelFile {
    return { format: 'mcw-model', version: 1, name: this.name, size: this.size, parts: this.parts.map(({ id: _id, ...p }) => p) };
  }

  private download(blob: Blob, file: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  private exportJson() {
    this.download(new Blob([JSON.stringify(this.model(), null, 1)], { type: 'application/json' }), `${this.name}.mcw.json`);
    this.toast(t('Saved {file} — send this file to add the model to the game', { file: `${this.name}.mcw.json` }));
  }

  /** TypeScript in the style of src/models/buildings.ts. */
  private code() {
    const fn = this.name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const lines = this.parts.map((p) => {
      const call = !p.shape || p.shape === 'box' ? `box(${p.w}, ${p.h}, ${p.d}, ${p.x}, ${p.y}, ${p.z}, '${p.color}')`
        : `shape('${p.shape}', ${p.w}, ${p.h}, ${p.d}, ${p.x}, ${p.y}, ${p.z}, '${p.color}'${p.axis && p.axis !== 'y' ? `, '${p.axis}'` : ''})`;
      return `    ${call},${p.name ? ` // ${p.name}` : ''}`;
    });
    return `/** ${this.name} — ${this.size}×${this.size} tiles, made in the model editor. */\nexport function ${fn}Geometry(): THREE.BufferGeometry {\n  return merge([\n${lines.join('\n')}\n  ]);\n}\n`;
  }

  private async copyCode() {
    const code = this.code();
    try {
      await navigator.clipboard.writeText(code);
      this.toast(t('Code copied to the clipboard'));
    } catch {
      this.download(new Blob([code], { type: 'text/plain' }), `${this.name}.ts`);
    }
  }

  private exportGlb() {
    const group = new THREE.Group();
    group.add(this.root.clone(), this.imported.clone());
    new GLTFExporter().parse(group, (res) => {
      this.download(new Blob([res as ArrayBuffer], { type: 'model/gltf-binary' }), `${this.name}.glb`);
    }, (err) => this.toast(String(err)), { binary: true });
  }

  private screenshot() {
    this.gizmo.getHelper().visible = false;
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.toBlob((b) => { if (b) this.download(b, `${this.name}.png`); });
    this.gizmo.getHelper().visible = true;
  }

  private async importFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'json') {
        const m = JSON.parse(await f.text()) as ModelFile;
        if (m.format !== 'mcw-model' || !Array.isArray(m.parts)) throw new Error(t('Not a model file from this editor'));
        this.pushUndo();
        this.parts = m.parts.map((p) => ({ ...p, id: this.nextId++ }));
        this.size = m.size ?? 1;
        this.name = m.name ?? 'my_model';
        this.ui.size.value = `${this.size}`;
        this.ui.name.value = this.name;
        this.drawFootprint();
        this.rebuild();
        this.fit();
        return;
      }
      const url = URL.createObjectURL(f);
      let obj: THREE.Object3D;
      if (ext === 'obj') obj = await new OBJLoader().loadAsync(url);
      else obj = (await new GLTFLoader().loadAsync(url)).scene;
      URL.revokeObjectURL(url);
      // fit the model on the plot
      const box = new THREE.Box3().setFromObject(obj);
      const sz = box.getSize(new THREE.Vector3());
      const k = (this.size * 0.95) / Math.max(sz.x, sz.z, 1e-6);
      obj.scale.multiplyScalar(k);
      const box2 = new THREE.Box3().setFromObject(obj);
      const c = box2.getCenter(new THREE.Vector3());
      obj.position.sub(new THREE.Vector3(c.x, box2.min.y, c.z));
      obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      this.imported.add(obj);
      this.renderList();
      this.toast(t('Model imported. Export GLB to send it, or rebuild it with boxes on top.'));
    } catch (err) {
      this.toast(`${t('Could not import')}: ${(err as Error).message}`);
    }
  }

  private toast(text: string) {
    const el = document.createElement('div');
    el.className = 'ed-toast';
    el.textContent = text;
    this.host.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  private resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  private injectStyle() {
    const css = document.createElement('style');
    css.textContent = `
body.editor-page { overflow: hidden; background: var(--base, #1a1d22); }
body.editor-page #loading { display: none; }
.ed-canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
.ed-top { position: fixed; top: 0; left: 0; right: 0; display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; gap: 6px; align-items: center; padding: 8px 12px; background: #1a1d22; border-bottom: 1px solid #343a43; color: #eceef1; font-family: Nunito, system-ui, sans-serif; z-index: 2; }
.ed-title { font-family: Fredoka, Nunito, sans-serif; font-size: 15px; margin-right: 6px; white-space: nowrap; }
.ed-top > * { flex: none; }
.ed-top::-webkit-scrollbar { display: none; }
.ed-title span { color: #f2a93b; }
.ed-btn { border: 0; border-radius: 8px; background: #272b32; color: #eceef1; font-weight: 800; font-size: 12px; padding: 7px 10px; cursor: pointer; font-family: inherit; }
.ed-btn:hover { background: #30353d; }
.ed-btn.primary { background: #f2a93b; color: #1d1406; }
.ed-input { background: #272b32; color: #eceef1; border: 1px solid #343a43; border-radius: 8px; padding: 6px 8px; font: inherit; font-size: 12px; font-weight: 700; }
.ed-name { width: 140px; }
.ed-panel { position: fixed; top: 58px; bottom: 34px; width: 230px; overflow-y: auto; background: #1a1d22; border: 1px solid #343a43; border-radius: 10px; padding: 10px; color: #eceef1; font-family: Nunito, system-ui, sans-serif; z-index: 2; scrollbar-width: none; }
.ed-panel::-webkit-scrollbar { display: none; }
.ed-left { left: 10px; }
.ed-right { right: 10px; }
.ed-h { font-size: 11px; font-weight: 800; color: #8e96a1; text-transform: uppercase; letter-spacing: 0.05em; margin: 10px 0 6px; }
.ed-h:first-child { margin-top: 0; }
.ed-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.ed-palette { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; }
.ed-swatch { aspect-ratio: 1; border: 1px solid #343a43; border-radius: 4px; cursor: pointer; padding: 0; }
.ed-color { width: 100%; height: 30px; margin-top: 6px; border: 1px solid #343a43; border-radius: 8px; background: #272b32; }
.ed-panel > .ed-input { width: 100%; margin-top: 6px; }
.ed-help { font-size: 11.5px; color: #8e96a1; line-height: 1.4; margin-top: 10px; }
.ed-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
.ed-field { display: flex; flex-direction: column; gap: 2px; font-size: 10.5px; font-weight: 800; color: #8e96a1; }
.ed-field input { width: 100%; background: #272b32; color: #eceef1; border: 1px solid #343a43; border-radius: 6px; padding: 5px; font: inherit; font-size: 12px; }
.ed-props .ed-input { width: 100%; margin-top: 6px; }
.ed-empty { font-size: 12px; color: #8e96a1; }
.ed-list { display: flex; flex-direction: column; gap: 3px; }
.ed-row { display: flex; align-items: center; gap: 7px; border: 1px solid transparent; border-radius: 7px; background: #272b32; color: #eceef1; padding: 5px 7px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-align: left; }
.ed-row.on { border-color: #f2a93b; }
.ed-row i { width: 12px; height: 12px; border-radius: 3px; flex: none; border: 1px solid #343a43; }
.ed-row small { margin-left: auto; color: #8e96a1; font-size: 10.5px; }
.ed-status { position: fixed; left: 0; right: 0; bottom: 0; padding: 7px 12px; background: #1a1d22; border-top: 1px solid #343a43; color: #8e96a1; font: 700 12px Nunito, system-ui, sans-serif; z-index: 2; }
.ed-toast { position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%); background: #272b32; color: #eceef1; border: 1px solid #343a43; border-radius: 10px; padding: 9px 14px; font: 700 13px Nunito, system-ui, sans-serif; z-index: 3; max-width: calc(100vw - 32px); }
@media (max-width: 760px) {
  .ed-panel { top: auto; bottom: 34px; width: calc(50vw - 15px); max-height: 38vh; }
  .ed-name { width: 100px; }
}`;
    document.head.appendChild(css);
  }
}

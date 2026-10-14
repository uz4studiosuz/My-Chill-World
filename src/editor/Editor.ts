import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { buildingGeometry } from '../buildings/Buildings';
import { BUILDINGS, BuildingKind } from '../buildings/BuildingTypes';
import { t } from '../i18n/i18n';
import { ShapeKind, orient, roundBoxUnit, unitShape } from '../utils/voxel';
import { PRESETS, PresetPart } from './presets';

/** One box of a voxel model — the same shape the game's models are made of: box(w, h, d, x, y, z, color). */
/** A part of the model: a box, or a round / sloped shape, turned along an axis. */
interface Part { id: number; w: number; h: number; d: number; x: number; y: number; z: number; color: string; name?: string; shape?: ShapeKind; axis?: 'x' | 'y' | 'z'; /** Rounded corners (boxes): radius in tiles. */ r?: number; /** Group: parts of a group are selected and moved together. */ g?: number; /** Group name. */ gn?: string; /** Hidden in the editor (still exported). */ hide?: boolean }

interface ModelFile { format: 'mcw-model'; version: 1; name: string; size: 1 | 2 | 3; parts: Omit<Part, 'id'>[] }

const KEY = 'mcw_editor';
const PALETTE = [
  '#efe6d2', '#dbe5ec', '#f1dcc6', '#e8e0f0', '#ffffff', '#cfc8b6', '#9d9d9a', '#5d6670', '#3d4148', '#26292e',
  '#c4553d', '#d9443b', '#e85a3a', '#e8a13a', '#f2c230', '#f2b33d', '#4f8a3a', '#5f9a3e', '#76b04f', '#2d5a32',
  '#3a6fd1', '#3f6fb5', '#2d4f8a', '#4fa3d1', '#a8d0e6', '#6f9fc8', '#8a5a35', '#6b4a2e', '#b0478f', '#e85a7a',
];
const round = (v: number) => Math.round(v * 1000) / 1000;
const SHAPE_NAME: Record<ShapeKind, string> = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', cone: 'Cone', dome: 'Dome', wedge: 'Ramp', capsule: 'Capsule', torus: 'Ring', pyramid: 'Pyramid', hexagon: 'Hexagon', arch: 'Arch', tube: 'Pipe' };

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
  /** Several parts selected: the gizmo moves this pivot and every part follows (moved and scaled together). */
  private pivot = new THREE.Object3D();
  private gizmoBusy = false;
  /** Groups folded in the layers list. */
  private folded = new Set<number>();
  /** Last part clicked: Shift+click selects everything from here to the clicked part. */
  private anchor: number | null = null;
  /** The model as it was after the last change (undo works by comparing with it). */
  private lastSnap = '';
  private restoring = false;
  private hovered: number | null = null;
  private topUi!: { undo: HTMLButtonElement; redo: HTMLButtonElement; move: HTMLButtonElement; scale: HTMLButtonElement; help: HTMLDivElement };
  private pivotStart: { center: THREE.Vector3; parts: Map<number, { pos: THREE.Vector3; scale: THREE.Vector3 }> } | null = null;

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
      this.gizmoBusy = !!e.value;
      if (!e.value) { this.syncFromGizmo(); setTimeout(() => { this.gizmoBusy = false; }, 0); this.gizmoBusy = true; }
    });
    this.gizmo.addEventListener('objectChange', () => this.syncFromGizmo(false));
    this.scene.add(this.gizmo.getHelper(), this.pivot);

    this.buildUi();
    this.gizmo.setMode('translate');
    this.topUi.move.classList.add('on');
    this.load();
    this.drawFootprint();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.key(e));
    canvas.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => { if (e.button === 0 && !this.gizmoBusy && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5) this.pick(e); });
    canvas.addEventListener('pointermove', (e) => this.hover(e));
    canvas.addEventListener('pointerleave', () => { this.hovered = null; this.paintSelection(); });
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
    const undoBtn = btn('↶', () => this.undo(), 'ed-btn ed-icon', t('Undo') + ' (Ctrl+Z)');
    const redoBtn = btn('↷', () => this.redo(), 'ed-btn ed-icon', t('Redo') + ' (Ctrl+Y)');
    const moveBtn = btn('✥ ' + t('Move'), () => this.setMode('translate'), 'ed-btn ed-mode', t('Move') + ' (G)');
    const scaleBtn = btn('⤡ ' + t('Resize'), () => this.setMode('scale'), 'ed-btn ed-mode', t('Resize') + ' (S)');
    const views = h('div', 'ed-seg');
    views.append(
      btn(t('Fit'), () => this.focus(), 'ed-btn ed-small', t('Show the selection (F)')),
      btn(t('Top'), () => this.view('top'), 'ed-btn ed-small', '7'),
      btn(t('Front'), () => this.view('front'), 'ed-btn ed-small', '1'),
      btn(t('Side'), () => this.view('side'), 'ed-btn ed-small', '3'),
    );
    const edit = h('div', 'ed-seg');
    edit.append(undoBtn, redoBtn);
    const modes = h('div', 'ed-seg');
    modes.append(moveBtn, scaleBtn);
    const help = h('div', 'ed-shortcuts') as HTMLDivElement;
    help.innerHTML = `<b>${t('Keyboard')}</b>` + ([
      ['Click', 'Select (a whole group)'], ['Ctrl+click', 'Add or remove one'], ['Shift+click', 'Select a range (2 … 5)'], ['Alt+click', 'One part of a group'],
      ['Ctrl+A', 'Select all'], ['Ctrl+G / Ctrl+Shift+G', 'Group / ungroup'], ['G / S', 'Move / resize'], ['D or Ctrl+D', 'Duplicate'], ['Delete', 'Delete'],
      ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Arrows, PgUp/PgDn', 'Nudge'], ['F', 'Show the selection'], ['1 / 3 / 7', 'Front / side / top view'], ['Esc', 'Deselect'],
    ] as const).map(([k, v]) => `<div><kbd>${k}</kbd><span>${t(v)}</span></div>`).join('');
    help.addEventListener('click', () => help.classList.remove('show'));
    const helpBtn = btn('?', () => help.classList.toggle('show'), 'ed-btn ed-icon', t('Keyboard shortcuts'));
    this.topUi = { undo: undoBtn, redo: redoBtn, move: moveBtn, scale: scaleBtn, help };
    top.append(
      title, edit, modes, views, helpBtn, name, size, template,
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
    left.append(h('div', 'ed-h', t('Shapes')));
    const shapes = h('div', 'ed-grid3');
    const shapeBtn = (label: string, p: Partial<Part> & Pick<Part, 'w' | 'h' | 'd' | 'y'>) => {
      const b = btn(t(label), () => this.add({ x: 0, z: 0, ...p }), 'ed-btn ed-shape');
      b.dataset.s = p.r ? 'rounded' : p.shape ?? 'box';
      return b;
    };
    shapes.append(
      shapeBtn('Box', { w: 0.2, h: 0.2, d: 0.2, y: 0.1 }),
      shapeBtn('Rounded box', { w: 0.24, h: 0.14, d: 0.32, y: 0.07, r: 0.04 }),
      shapeBtn('Cylinder', { w: 0.2, h: 0.3, d: 0.2, y: 0.15, shape: 'cylinder' }),
      shapeBtn('Sphere', { w: 0.2, h: 0.2, d: 0.2, y: 0.1, shape: 'sphere' }),
      shapeBtn('Capsule', { w: 0.12, h: 0.3, d: 0.12, y: 0.15, shape: 'capsule' }),
      shapeBtn('Cone', { w: 0.24, h: 0.3, d: 0.24, y: 0.15, shape: 'cone' }),
      shapeBtn('Pyramid', { w: 0.3, h: 0.2, d: 0.3, y: 0.1, shape: 'pyramid' }),
      shapeBtn('Dome', { w: 0.4, h: 0.2, d: 0.4, y: 0.1, shape: 'dome' }),
      shapeBtn('Ramp', { w: 0.3, h: 0.15, d: 0.3, y: 0.075, shape: 'wedge' }),
      shapeBtn('Arch', { w: 0.4, h: 0.2, d: 0.5, y: 0.1, shape: 'arch' }),
      shapeBtn('Hexagon', { w: 0.24, h: 0.2, d: 0.24, y: 0.1, shape: 'hexagon' }),
      shapeBtn('Ring', { w: 0.3, h: 0.06, d: 0.3, y: 0.03, shape: 'torus' }),
      shapeBtn('Pipe', { w: 0.08, h: 0.4, d: 0.08, y: 0.2, shape: 'tube' }),
    );
    left.append(shapes, h('div', 'ed-h', t('Parts')));
    const adds = h('div', 'ed-grid2');
    adds.append(
      btn(t('Wall'), () => this.add({ w: 0.6, h: 0.4, d: 0.05, x: 0, y: 0.2, z: 0 })),
      btn(t('Floor'), () => this.add({ w: 0.9, h: 0.02, d: 0.9, x: 0, y: 0.01, z: 0 })),
      btn(t('Roof'), () => this.add({ w: 0.7, h: 0.22, d: 0.6, x: 0, y: 0.51, z: 0, color: '#c4553d', shape: 'pyramid' })),
      btn(t('Window'), () => this.add({ w: 0.12, h: 0.1, d: 0.02, x: 0, y: 0.26, z: 0.21, color: '#a8d0e6' })),
      btn(t('Door'), () => this.add({ w: 0.12, h: 0.2, d: 0.02, x: 0, y: 0.1, z: 0.21, color: '#6b4a2e' })),
      btn(t('Pillar'), () => this.add({ w: 0.05, h: 0.4, d: 0.05, x: 0, y: 0.2, z: 0, color: '#f4f1ea', shape: 'cylinder' })),
      btn(t('Wheel'), () => this.addPreset('Wheel')),
      btn(t('Glass'), () => this.add({ w: 0.3, h: 0.12, d: 0.02, x: 0, y: 0.2, z: 0, color: '#6f9fc8', r: 0.008 })),
    );
    // whole ready-made objects: added together, then edit any part
    const tpl = h('select', 'ed-input') as HTMLSelectElement;
    const o0 = h('option') as HTMLOptionElement;
    o0.value = '';
    o0.textContent = t('Add a ready object…');
    tpl.appendChild(o0);
    for (const name of Object.keys(PRESETS)) { const o = h('option') as HTMLOptionElement; o.value = name; o.textContent = t(name); tpl.appendChild(o); }
    tpl.addEventListener('change', () => { if (tpl.value) this.addPreset(tpl.value); tpl.value = ''; });
    const quick = h('div', 'ed-grid3');
    for (const name of ['Car', 'Bus', 'Tree', 'Pine', 'House', 'Lamp post', 'Bench', 'Fence', 'Person']) quick.appendChild(btn(t(name), () => this.addPreset(name), 'ed-btn ed-small'));
    left.append(adds, h('div', 'ed-h', t('Ready objects')), quick, tpl, h('div', 'ed-h', t('Colour')));
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
      btn(t('Group') + ' (Ctrl+G)', () => this.group()),
      btn(t('Ungroup'), () => this.ungroup()),
      btn(t('Select all'), () => { this.selected = this.parts.map((p) => p.id); this.refreshSelection(); }),
      btn(t('Undo') + ' (Z)', () => this.undo()),
      btn(t('Redo') + ' (Y)', () => this.redo()),
    );
    const snapSel = h('select', 'ed-input') as HTMLSelectElement;
    for (const v of [0, 0.005, 0.01, 0.02, 0.05, 0.1]) { const o = h('option') as HTMLOptionElement; o.value = `${v}`; o.textContent = v ? `${t('Snap')} ${v}` : t('No snap'); if (v === this.snap) o.selected = true; snapSel.appendChild(o); }
    snapSel.addEventListener('change', () => { this.snap = +snapSel.value; this.applySnap(); });
    left.append(tools, snapSel);
    const tip = h('div', 'ed-help', t('Click a part to select it (a whole group), Ctrl+click to add, Shift+click for a range, Alt+click for one part of a group. Drag the arrows to move. The yellow outline is the plot; the arrow points to the road. Press ? for all shortcuts.'));
    left.append(tip);

    const right = h('div', 'ed-panel ed-right');
    const props = h('div', 'ed-props') as HTMLDivElement;
    const list = h('div', 'ed-list') as HTMLDivElement;
    right.append(h('div', 'ed-h', t('Selected')), props, h('div', 'ed-h', t('Parts')), list);
    const status = h('div', 'ed-status') as HTMLDivElement;
    this.host.append(top, left, right, status, help);
    this.ui = { list, props, status, name, size, swatch };
    this.injectStyle();
    this.updateUndoUi();
  }

  private renderList() {
    const { list } = this.ui;
    const scroll = list.scrollTop;
    list.replaceChildren();
    const eye = (hidden: boolean, onClick: () => void) => {
      const b = document.createElement('span');
      b.className = 'ed-eye' + (hidden ? ' off' : '');
      b.textContent = hidden ? '◌' : '●';
      b.title = hidden ? t('Show') : t('Hide');
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
      return b;
    };
    const partRow = (p: Part, i: number, nested: boolean) => {
      const row = document.createElement('div');
      row.className = 'ed-row' + (this.selected.includes(p.id) ? ' on' : '') + (nested ? ' nested' : '') + (p.hide ? ' hidden' : '');
      row.innerHTML = `<i style="background:${p.color};border-radius:${p.shape && p.shape !== 'box' && p.shape !== 'wedge' ? '50%' : p.r ? '5px' : '2px'}"></i><span></span><small>${round(p.w)}×${round(p.h)}×${round(p.d)}</small>`;
      (row.querySelector('span') as HTMLElement).textContent = `${p.name ?? t(SHAPE_NAME[p.shape ?? 'box'])} ${i + 1}`;
      row.appendChild(eye(!!p.hide, () => { p.hide = !p.hide || undefined; this.rebuild(); }));
      // a click on a part inside a group picks just that part
      row.addEventListener('click', (e) => this.select(p.id, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : nested || e.altKey ? 'single' : 'replace'));
      return row;
    };
    const seen = new Set<number>();
    this.parts.forEach((p, i) => {
      if (p.g === undefined) { list.appendChild(partRow(p, i, false)); return; }
      if (seen.has(p.g)) return;
      seen.add(p.g);
      const g = p.g;
      const members = this.parts.map((q, j) => [q, j] as const).filter(([q]) => q.g === g);
      const allSel = members.every(([q]) => this.selected.includes(q.id));
      const head = document.createElement('div');
      head.className = 'ed-grp' + (allSel ? ' on' : '');
      const caret = document.createElement('span');
      caret.className = 'ed-caret';
      caret.textContent = this.folded.has(g) ? '▸' : '▾';
      caret.addEventListener('click', (e) => { e.stopPropagation(); if (this.folded.has(g)) this.folded.delete(g); else this.folded.add(g); this.renderList(); });
      const name = document.createElement('b');
      name.textContent = p.gn ?? `${t('Group')} ${g}`;
      name.title = t('Double-click to rename');
      name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const v = window.prompt(t('Group name'), name.textContent ?? '');
        if (v === null) return;
        for (const [q] of members) q.gn = v.trim() || undefined;
        this.renderList();
        this.save();
      });
      const count = document.createElement('small');
      count.textContent = `${members.length}`;
      const hidden = members.every(([q]) => q.hide);
      head.append(caret, name, count, eye(hidden, () => { for (const [q] of members) q.hide = !hidden || undefined; this.rebuild(); }));
      head.addEventListener('click', (e) => this.select(p.id, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace'));
      list.appendChild(head);
      if (!this.folded.has(g)) for (const [q, j] of members) list.appendChild(partRow(q, j, true));
    });
    list.scrollTop = scroll;
    const n = this.imported.children.length;
    const groups = new Set(this.parts.filter((p) => p.g !== undefined).map((p) => p.g)).size;
    this.ui.status.textContent = `${this.parts.length} ${t('parts')} · ${t('{n} groups', { n: groups })}${this.selected.length ? ` · ${t('{n} selected', { n: this.selected.length })}` : ''}${n ? ` · ${n} ${t('imported models')}` : ''} · ${t('Plot')} ${this.size}×${this.size} · ${t('Press ? for shortcuts')}`;
  }

  private renderProps() {
    const { props } = this.ui;
    props.replaceChildren();
    const p = this.parts.find((q) => q.id === this.selected[0]);
    if (!p) {
      props.innerHTML = `<div class="ed-empty">${t('Nothing selected')}<small>${t('Click a part, or add a shape on the left')}</small></div>`;
      return;
    }
    if (this.selected.length > 1) return this.renderMulti();
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
    for (const [v, label] of Object.entries(SHAPE_NAME) as [ShapeKind, string][]) {
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
    props.append(grid, shapeSel, axisSel);
    // rounded corners for boxes: no sharp edges on a car body
    if (!p.shape || p.shape === 'box') {
      const max = Math.min(p.w, p.h, p.d) / 2;
      const wrap = document.createElement('label');
      wrap.className = 'ed-radius';
      wrap.innerHTML = `<span>${t('Corner radius')}</span><b>${(p.r ?? 0).toFixed(3)}</b>`;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = `${round(max)}`;
      range.step = '0.001';
      range.value = `${Math.min(max, p.r ?? 0)}`;
      range.addEventListener('pointerdown', () => this.pushUndo());
      range.addEventListener('input', () => {
        const v = round(parseFloat(range.value));
        p.r = v > 0.0005 ? v : undefined;
        (wrap.querySelector('b') as HTMLElement).textContent = (p.r ?? 0).toFixed(3);
        this.rebuildOne(p);
      });
      range.addEventListener('change', () => this.save());
      wrap.appendChild(range);
      props.appendChild(wrap);
    }
    props.appendChild(nm);
  }

  /** Several parts selected: where the selection is, its size, and what can be done with all of them. */
  private renderMulti() {
    const { props } = this.ui;
    const sel = this.parts.filter((q) => this.selected.includes(q.id));
    const groups = new Set(sel.map((q) => q.g));
    const oneGroup = groups.size === 1 && sel[0].g !== undefined;
    const box = new THREE.Box3();
    for (const q of sel) box.union(new THREE.Box3(new THREE.Vector3(q.x - q.w / 2, q.y - q.h / 2, q.z - q.d / 2), new THREE.Vector3(q.x + q.w / 2, q.y + q.h / 2, q.z + q.d / 2)));
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const head = document.createElement('div');
    head.className = 'ed-multi';
    head.innerHTML = '<b></b><small></small>';
    (head.querySelector('b') as HTMLElement).textContent = oneGroup ? (sel[0].gn ?? `${t('Group')} ${sel[0].g}`) : t('{n} parts selected', { n: sel.length });
    (head.querySelector('small') as HTMLElement).textContent = `${round(sz.x)} × ${round(sz.y)} × ${round(sz.z)}${oneGroup ? ` · ${t('{n} parts', { n: sel.length })}` : ''}`;
    // moving the whole selection by its centre (and its bottom)
    const grid = document.createElement('div');
    grid.className = 'ed-fields';
    const field = (label: string, value: number, apply: (v: number) => void) => {
      const wrap = document.createElement('label');
      wrap.className = 'ed-field';
      wrap.innerHTML = `<span>${label}</span>`;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '0.01';
      inp.value = `${round(value)}`;
      inp.addEventListener('change', () => { const v = parseFloat(inp.value); if (Number.isFinite(v)) { apply(v); this.rebuild(); } });
      wrap.appendChild(inp);
      return wrap;
    };
    grid.append(
      field('X', c.x, (v) => { for (const q of sel) q.x = round(q.x + v - c.x); }),
      field(t('Bottom'), box.min.y, (v) => { for (const q of sel) q.y = round(q.y + v - box.min.y); }),
      field('Z', c.z, (v) => { for (const q of sel) q.z = round(q.z + v - c.z); }),
    );
    const acts = document.createElement('div');
    acts.className = 'ed-grid2';
    const b = (label: string, fn: () => void, cls = 'ed-btn') => { const e = document.createElement('button'); e.className = cls; e.textContent = label; e.addEventListener('click', fn); return e; };
    acts.append(
      oneGroup ? b(t('Ungroup'), () => this.ungroup()) : b(t('Group') + ' (Ctrl+G)', () => this.group(), 'ed-btn primary'),
      b(t('To ground'), () => this.toGround()),
      b(t('Duplicate'), () => this.duplicate()),
      b(t('Mirror X'), () => this.mirror()),
      b(t('Centre on plot'), () => { for (const q of sel) { q.x = round(q.x - c.x); q.z = round(q.z - c.z); } this.rebuild(); }),
      b(t('Delete'), () => this.remove(), 'ed-btn danger'),
    );
    const note = document.createElement('div');
    note.className = 'ed-help';
    note.textContent = t('A colour from the palette paints all selected parts. Drag the arrows to move or resize them together.');
    props.append(head, grid, acts, note);
  }

  // ---------- model ----------

  private add(p: Partial<Part> & Pick<Part, 'w' | 'h' | 'd' | 'x' | 'y' | 'z'>) {
    this.pushUndo();
    const part: Part = { color: this.color, ...p, id: this.nextId++ };
    this.parts.push(part);
    this.rebuild();
    this.select(part.id);
  }

  /** Add a ready-made object (all its parts, selected together). */
  private addPreset(name: string) {
    const list: PresetPart[] | undefined = PRESETS[name];
    if (!list) return;
    this.pushUndo();
    const ids: number[] = [];
    const g = Math.max(0, ...this.parts.map((p) => p.g ?? 0)) + 1;
    for (const p of list) { const id = this.nextId++; this.parts.push({ ...p, w: round(p.w), h: round(p.h), d: round(p.d), x: round(p.x), y: round(p.y), z: round(p.z), r: p.r === undefined ? undefined : round(p.r), name: p.name ? t(p.name) : undefined, id, g, gn: t(name) }); ids.push(id); }
    this.rebuild();
    this.selected = ids;
    this.refreshSelection();
  }

  private geometryOf(p: Part) {
    if (p.r && (!p.shape || p.shape === 'box')) return roundBoxUnit(p.w, p.h, p.d, p.r);
    return orient(unitShape(p.shape ?? 'box', 32), p.axis ?? 'y');
  }

  /** Replace one part's mesh geometry (radius or size changed). */
  private rebuildOne(p: Part) {
    const m = this.meshes.get(p.id);
    if (!m) return;
    m.geometry.dispose();
    m.geometry = this.geometryOf(p);
    m.scale.set(p.w, p.h, p.d);
  }

  private rebuild() {
    for (const m of this.meshes.values()) { this.root.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.meshes.clear();
    for (const p of this.parts) {
      const m = new THREE.Mesh(this.geometryOf(p), new THREE.MeshLambertMaterial({ color: p.color }));
      m.scale.set(p.w, p.h, p.d);
      m.position.set(p.x, p.y, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.part = p.id;
      m.visible = !p.hide;
      this.root.add(m);
      this.meshes.set(p.id, m);
    }
    this.selected = this.selected.filter((id) => this.meshes.has(id));
    this.refreshSelection();
    this.save();
  }

  /**
   * Select parts. 'replace' = only this one (its whole group), 'toggle' = add / remove (Ctrl+click),
   * 'range' = everything in the list from the last clicked part to this one (Shift+click), 'single' = one part of a group.
   */
  private select(id: number | null, mode: 'replace' | 'toggle' | 'range' | 'single' = 'replace') {
    if (id === null) { this.selected = []; this.anchor = null; this.refreshSelection(); return; }
    const p = this.parts.find((q) => q.id === id);
    if (!p) return;
    const ids = p.g !== undefined && mode !== 'single' ? this.parts.filter((q) => q.g === p.g).map((q) => q.id) : [id];
    if (mode === 'range' && this.anchor !== null) {
      const order = this.order();
      const a = order.indexOf(this.anchor), b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const span = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        this.selected = [...new Set([...this.selected, ...span])];
      } else this.selected = ids;
    } else if (mode === 'toggle') {
      this.selected = ids.every((i) => this.selected.includes(i)) ? this.selected.filter((s) => !ids.includes(s)) : [...new Set([...this.selected, ...ids])];
      this.anchor = id;
    } else {
      this.selected = ids;
      this.anchor = id;
    }
    this.refreshSelection();
  }

  /** The parts in the order of the layers list (a group's parts together, where the group starts). */
  private order() {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const p of this.parts) {
      if (p.g === undefined) { out.push(p.id); continue; }
      if (seen.has(p.g)) continue;
      seen.add(p.g);
      for (const q of this.parts) if (q.g === p.g) out.push(q.id);
    }
    return out;
  }

  /** Mode of the arrows on the selection. */
  private setMode(m: 'translate' | 'scale') {
    this.gizmo.setMode(m);
    this.topUi.move.classList.toggle('on', m === 'translate');
    this.topUi.scale.classList.toggle('on', m === 'scale');
  }

  /** Camera: frame the selection (or the whole plot). */
  private focus() {
    const ids = this.selected.length ? this.selected : this.parts.map((p) => p.id);
    const box = new THREE.Box3();
    for (const id of ids) { const m = this.meshes.get(id); if (m && m.visible) box.expandByObject(m); }
    if (box.isEmpty()) return this.fit();
    const c = box.getCenter(new THREE.Vector3()), r = Math.max(0.15, box.getSize(new THREE.Vector3()).length());
    const dir = this.camera.position.clone().sub(this.orbit.target).normalize();
    this.orbit.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir, r * 1.6 + 0.3);
  }

  private view(v: 'top' | 'front' | 'side') {
    const t0 = this.orbit.target, d = this.camera.position.distanceTo(t0);
    if (v === 'top') this.camera.position.set(t0.x, t0.y + d, t0.z + 0.001);
    if (v === 'front') this.camera.position.set(t0.x, t0.y + d * 0.15, t0.z + d);
    if (v === 'side') this.camera.position.set(t0.x + d, t0.y + d * 0.15, t0.z);
  }

  /** The part under the mouse lights up a little. */
  private hover(e: PointerEvent) {
    if (this.gizmoBusy || e.buttons) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObjects([...this.meshes.values()].filter((m) => m.visible), false)[0];
    const id = hit ? hit.object.userData.part as number : null;
    if (id === this.hovered) return;
    this.hovered = id;
    this.paintSelection();
    this.renderer.domElement.style.cursor = id !== null ? 'pointer' : '';
  }

  /** Selected parts glow orange, the hovered part (and its group) a little. */
  private paintSelection() {
    const hp = this.hovered !== null ? this.parts.find((p) => p.id === this.hovered) : undefined;
    const hov = new Set(hp ? (hp.g !== undefined ? this.parts.filter((q) => q.g === hp.g).map((q) => q.id) : [hp.id]) : []);
    for (const [id, m] of this.meshes) {
      const mat = m.material as THREE.MeshLambertMaterial;
      mat.emissive.set(this.selected.includes(id) ? '#3a2a00' : hov.has(id) ? '#1d2630' : '#000000');
    }
  }

  private updateUndoUi() {
    if (!this.topUi) return;
    this.topUi.undo.disabled = !this.undoStack.length;
    this.topUi.redo.disabled = !this.redoStack.length;
    this.topUi.undo.title = `${t('Undo')} (Ctrl+Z) · ${this.undoStack.length}`;
    this.topUi.redo.title = `${t('Redo')} (Ctrl+Y) · ${this.redoStack.length}`;
  }

  /** Make one group of the selected parts (Ctrl+G): from now on they move together. */
  private group() {
    if (this.selected.length < 2) return this.toast(t('Select two or more parts first (Shift+click)'));
    this.pushUndo();
    const g = Math.max(0, ...this.parts.map((p) => p.g ?? 0)) + 1;
    for (const p of this.parts) if (this.selected.includes(p.id)) { p.g = g; p.gn = `${t('Group')} ${g}`; }
    this.toast(t('Grouped {n} parts — they now move together. Alt+click picks one part.', { n: this.selected.length }));
    this.rebuild();
  }

  private ungroup() {
    if (!this.selected.length) return;
    this.pushUndo();
    for (const p of this.parts) if (this.selected.includes(p.id)) { p.g = undefined; p.gn = undefined; }
    this.toast(t('Ungrouped'));
    this.rebuild();
  }

  private refreshSelection() {
    this.paintSelection();
    const first = this.selected.length === 1 ? this.meshes.get(this.selected[0]) : undefined;
    this.pivotStart = null;
    if (first) this.gizmo.attach(first);
    else if (this.selected.length > 1) {
      // many parts: the gizmo sits in their middle and moves / resizes all of them
      const box = new THREE.Box3();
      for (const id of this.selected) { const m = this.meshes.get(id); if (m) box.expandByObject(m); }
      const c = box.getCenter(new THREE.Vector3());
      this.pivot.position.copy(c);
      this.pivot.scale.set(1, 1, 1);
      this.pivot.rotation.set(0, 0, 0);
      this.pivot.updateMatrixWorld();
      this.gizmo.attach(this.pivot);
    } else this.gizmo.detach();
    const p = this.parts.find((q) => q.id === this.selected[0]);
    if (p) { this.color = p.color; this.ui.swatch.value = p.color; }
    this.renderList();
    this.renderProps();
  }

  private syncFromGizmo(commit = true) {
    if (this.selected.length > 1) return this.syncGroup(commit);
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
      if (p.r) this.rebuildOne(p);
      m.scale.set(p.w, p.h, p.d);
      this.renderProps();
      this.renderList();
      this.save();
    }
  }

  /** The pivot was dragged: move (and scale) every selected part around it. */
  private syncGroup(commit: boolean) {
    if (!this.pivotStart) {
      const parts = new Map<number, { pos: THREE.Vector3; scale: THREE.Vector3 }>();
      for (const id of this.selected) { const m = this.meshes.get(id); if (m) parts.set(id, { pos: m.position.clone(), scale: m.scale.clone() }); }
      // the pivot already moved a little: its start is where the selection's centre was
      const box = new THREE.Box3();
      for (const id of this.selected) { const m = this.meshes.get(id); if (m) box.expandByObject(m); }
      this.pivotStart = { center: box.getCenter(new THREE.Vector3()), parts };
    }
    const st = this.pivotStart;
    const s = this.pivot.scale, d = this.pivot.position.clone().sub(st.center);
    for (const [id, p0] of st.parts) {
      const m = this.meshes.get(id);
      if (!m) continue;
      m.position.set(st.center.x + (p0.pos.x - st.center.x) * s.x + d.x, st.center.y + (p0.pos.y - st.center.y) * s.y + d.y, st.center.z + (p0.pos.z - st.center.z) * s.z + d.z);
      m.scale.set(p0.scale.x * s.x, p0.scale.y * s.y, p0.scale.z * s.z);
    }
    if (!commit) return;
    const q = (v: number) => { const sn = this.snap || 0.001; return round(Math.round(v / sn) * sn); };
    for (const p of this.parts) {
      const m = this.meshes.get(p.id);
      if (!m || !st.parts.has(p.id)) continue;
      p.x = q(m.position.x); p.y = q(m.position.y); p.z = q(m.position.z);
      p.w = Math.max(0.005, q(Math.abs(m.scale.x))); p.h = Math.max(0.005, q(Math.abs(m.scale.y))); p.d = Math.max(0.005, q(Math.abs(m.scale.z)));
    }
    this.rebuild();
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
    const top = Math.max(0, ...this.parts.map((p) => p.g ?? 0));
    const groups = new Map<number, number>();
    const regroup = (g: number) => { let n = groups.get(g); if (n === undefined) { n = top + groups.size + 1; groups.set(g, n); } return n; };
    const ids: number[] = [];
    for (const p of this.parts.filter((q) => this.selected.includes(q.id))) {
      const id = this.nextId++;
      this.parts.push({ ...p, id, g: p.g === undefined ? undefined : regroup(p.g), x: round(p.x + 0.1) });
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
    const top = Math.max(0, ...this.parts.map((p) => p.g ?? 0));
    const groups = new Map<number, number>();
    const regroup = (g: number) => { let n = groups.get(g); if (n === undefined) { n = top + groups.size + 1; groups.set(g, n); } return n; };
    const ids: number[] = [];
    for (const p of this.parts.filter((q) => this.selected.includes(q.id))) {
      const id = this.nextId++;
      this.parts.push({ ...p, id, g: p.g === undefined ? undefined : regroup(p.g), x: round(-p.x) });
      ids.push(id);
    }
    this.rebuild();
    this.selected = ids;
    this.refreshSelection();
  }

  /** Put the selection on the ground: a group (or several selected parts) keeps its shape and lands as one piece. */
  private toGround() {
    if (!this.selected.length) return;
    const sel = this.parts.filter((p) => this.selected.includes(p.id));
    // units: each group is one piece; loose parts selected together are one piece too
    const units = new Map<string, Part[]>();
    for (const p of sel) {
      const key = p.g !== undefined ? `g${p.g}` : 'loose';
      units.set(key, [...(units.get(key) ?? []), p]);
    }
    if (units.size > 1 && units.has('loose')) {
      // loose parts selected with groups: everything lands together
      units.clear();
      units.set('all', sel);
    }
    for (const list of units.values()) {
      const bottom = Math.min(...list.map((p) => p.y - p.h / 2));
      for (const p of list) p.y = round(p.y - bottom);
    }
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
    const hit = this.ray.intersectObjects([...this.meshes.values()].filter((m) => m.visible), false)[0];
    const mode = e.altKey ? 'single' : e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace';
    if (hit) this.select(hit.object.userData.part as number, mode);
    else if (mode === 'replace') this.select(null);
  }

  private key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    // e.code is the physical key: shortcuts work with any keyboard language
    const k = e.code;
    if (ctrl && k === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (ctrl && k === 'KeyY') { e.preventDefault(); this.redo(); return; }
    if (ctrl && k === 'KeyD') { e.preventDefault(); this.duplicate(); return; }
    if (ctrl && k === 'KeyG') { e.preventDefault(); if (e.shiftKey) this.ungroup(); else this.group(); return; }
    if (ctrl && k === 'KeyA') { e.preventDefault(); this.selected = this.parts.map((p) => p.id); this.refreshSelection(); return; }
    if (ctrl) return;
    if (k === 'KeyG') return this.setMode('translate');
    if (k === 'KeyS') return this.setMode('scale');
    if (k === 'KeyD') return this.duplicate();
    if (k === 'KeyF') return this.focus();
    if (k === 'Digit7' || k === 'Numpad7') return this.view('top');
    if (k === 'Digit1' || k === 'Numpad1') return this.view('front');
    if (k === 'Digit3' || k === 'Numpad3') return this.view('side');
    if (e.key === '?' || (k === 'Slash' && e.shiftKey)) { this.topUi.help.classList.toggle('show'); return; }
    switch (e.key) {
      case 'Delete': case 'Backspace': this.remove(); break;
      case 'Escape': this.topUi.help.classList.remove('show'); this.select(null); break;
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

  /** Kept for the callers: the undo step is written when the change is saved (see save()). */
  private pushUndo() { /* nothing to do */ }

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
    if (!s) return this.toast(t('Nothing to undo'));
    this.redoStack.push(this.lastSnap);
    this.restoring = true;
    this.restore(s);
    this.restoring = false;
    this.lastSnap = s;
    this.updateUndoUi();
  }

  private redo() {
    const s = this.redoStack.pop();
    if (!s) return this.toast(t('Nothing to redo'));
    this.undoStack.push(this.lastSnap);
    this.restoring = true;
    this.restore(s);
    this.restoring = false;
    this.lastSnap = s;
    this.updateUndoUi();
  }

  /** Store the model; when it changed since the last save, the old state becomes an undo step. */
  private save() {
    const s = this.snapshot();
    if (!this.restoring && this.lastSnap && s !== this.lastSnap) {
      this.undoStack.push(this.lastSnap);
      if (this.undoStack.length > 150) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    if (!this.restoring) this.lastSnap = s;
    this.updateUndoUi();
    try { localStorage.setItem(KEY, s); } catch { /* ignore */ }
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
    // a valid identifier whatever the model is called: "My big house-2" → myBigHouse2
    const words = this.name.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    let fn = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('') || 'custom';
    if (/^[0-9]/.test(fn)) fn = `model${fn}`;
    const num = (v: number) => { const r = round(v); return Object.is(r, -0) ? '0' : `${r}`; };
    const usesShape = this.parts.some((p) => p.shape && p.shape !== 'box');
    const usesRound = this.parts.some((p) => p.r && (!p.shape || p.shape === 'box'));
    const lines = this.parts.map((p) => {
      const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color.toLowerCase() : '#ffffff';
      const dims = `${num(p.w)}, ${num(p.h)}, ${num(p.d)}, ${num(p.x)}, ${num(p.y)}, ${num(p.z)}, '${color}'`;
      const call = !p.shape || p.shape === 'box' ? (p.r ? `roundBox(${dims}, ${num(p.r)})` : `box(${dims})`) : `shape('${p.shape}', ${dims}${p.axis && p.axis !== 'y' ? `, '${p.axis}'` : ''})`;
      const note = p.name ? ` // ${p.name.replace(/[\r\n]+/g, ' ').replace(/\*\//g, '')}` : '';
      return `    ${call},${note}`;
    });
    // a whole file: save it as src/models/custom/${fn}.ts — it compiles as it is (one element per file, like every model)
    return [
      `import * as THREE from 'three';`,
      `import { ${['box', 'merge', ...(usesRound ? ['roundBox'] : []), ...(usesShape ? ['shape'] : [])].join(', ')} } from '../../utils/voxel';`,
      ``,
      `/** ${this.name.replace(/\*\//g, '')} — ${this.size}×${this.size} tiles (${this.parts.length} parts), made in the model editor. Faces +z (the road). */`,
      `export function ${fn}Geometry(): THREE.BufferGeometry {`,
      `  return merge([`,
      ...(lines.length ? lines : [`    box(0.5, 0.5, 0.5, 0, 0.25, 0, '#cccccc'),`]),
      `  ]);`,
      `}`,
      ``,
    ].join('\n');
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
    css.textContent = `.ed-top { gap: 6px; }
.ed-seg .ed-small { padding: 4px 8px !important; min-width: 0; white-space: nowrap; }
@media (max-width: 1350px) { .ed-title { display: none; } }
.ed-seg { display: flex; gap: 2px; background: #15181d; border: 1px solid #343a43; border-radius: 9px; padding: 2px; }
.ed-seg .ed-btn { border: 0; }
.ed-icon { min-width: 34px; font-size: 16px !important; padding: 4px 8px !important; }
.ed-btn:disabled { opacity: .35; cursor: default; }
.ed-mode.on { background: #f2a93b !important; color: #1d1406 !important; }
.ed-btn.danger { background: #5a2626; color: #ffd9d6; }
.ed-btn.danger:hover { background: #7a2f2f; }
.ed-multi { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 9px; background: #3a2f17; border: 1px solid #f2a93b; margin-bottom: 8px; }
.ed-multi b { font-size: 14px; }
.ed-multi small { color: #d8c49a; font-size: 11.5px; }
.ed-empty small { display: block; margin-top: 4px; color: #6f7883; font-size: 11.5px; }
.ed-shortcuts { position: fixed; right: 260px; top: 60px; z-index: 6; display: none; background: #1a1d22; border: 1px solid #f2a93b; border-radius: 12px; padding: 12px 14px; color: #eceef1; font: 12.5px Nunito, system-ui, sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,.45); min-width: 300px; }
.ed-shortcuts.show { display: block; }
.ed-shortcuts b { display: block; margin-bottom: 8px; color: #f2a93b; font-size: 14px; }
.ed-shortcuts div { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; border-bottom: 1px solid #23272e; }
.ed-shortcuts kbd { font: 700 11.5px ui-monospace, monospace; background: #272b32; border: 1px solid #3d4148; border-radius: 5px; padding: 1px 6px; white-space: nowrap; }
.ed-shortcuts span { color: #aab4be; text-align: right; }
@media (max-width: 900px) { .ed-shortcuts { right: 10px; } }

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
.ed-grp { display: flex; align-items: center; gap: 6px; padding: 6px 6px; margin-top: 4px; border-radius: 8px; background: #23272e; cursor: pointer; font-size: 12px; }
.ed-grp.on { background: #3a2f17; outline: 1px solid #f2a93b; }
.ed-grp b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-grp small { color: #8b949e; }
.ed-caret { width: 14px; text-align: center; color: #f2a93b; }
.ed-row.nested { margin-left: 14px; border-left: 2px solid #343a43; }
.ed-row.hidden { opacity: .45; }
.ed-eye { margin-left: auto; padding: 0 4px; color: #aab4be; cursor: pointer; font-size: 11px; }
.ed-eye.off { color: #5d6670; }
.ed-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.ed-shape, .ed-small { font-size: 11px !important; padding: 6px 2px !important; }
.ed-radius { display: grid; grid-template-columns: 1fr auto; gap: 2px 6px; margin-top: 8px; font-size: 12px; color: #aab4be; }
.ed-radius b { color: #f2a93b; font-weight: 700; }
.ed-radius input { grid-column: 1 / -1; width: 100%; accent-color: #f2a93b; }
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
.ed-props { min-height: 268px; }
.ed-props .ed-input { width: 100%; margin-top: 6px; }
.ed-empty { font-size: 12px; color: #8e96a1; }
.ed-list { display: flex; flex-direction: column; gap: 3px; }
.ed-row { display: flex; align-items: center; cursor: pointer;  display: flex; align-items: center; gap: 7px; border: 1px solid transparent; border-radius: 7px; background: #272b32; color: #eceef1; padding: 5px 7px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-align: left; }
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

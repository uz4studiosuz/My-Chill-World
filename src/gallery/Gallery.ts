import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CATALOG, CatalogEntry, CatalogGroup, centerObject, disposeObject, fitCamera } from '../models/catalog';
import { el, icon } from '../ui/dom';
import { t } from '../i18n/i18n';

const GROUPS: CatalogGroup[] = ['Buildings', 'Roads', 'People', 'Vehicles', 'Animals', 'Nature'];

/** 3D viewer for every model in the game: orbit, zoom, auto-rotate, wireframe. */
export class Gallery {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  visible = false;

  private root: HTMLDivElement;
  private list: HTMLDivElement;
  private title: HTMLHeadingElement;
  private desc: HTMLParagraphElement;
  private stats: HTMLDivElement;
  private controls: OrbitControls | null = null;
  private current: THREE.Object3D | null = null;
  private entry: CatalogEntry = CATALOG[0];
  private autoRotate = true;
  private wireframe = false;
  private buttons = new Map<string, HTMLButtonElement>();
  private autoBtn: HTMLButtonElement;
  private wireBtn: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private head!: HTMLElement;

  constructor(private canvas: HTMLCanvasElement, parent: HTMLElement, private onClose: () => void) {
    this.scene.background = new THREE.Color('#a9c9d6');
    this.scene.add(new THREE.HemisphereLight('#e4f1ff', '#6f7f4c', 1.6));
    const sun = new THREE.DirectionalLight('#fff3df', 2.4);
    sun.position.set(-4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.2, 0.2, 48), new THREE.MeshLambertMaterial({ color: '#8cb156' }));
    floor.position.y = -0.101;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.PolarGridHelper(6, 8, 6, 48, '#6f9444', '#7da34e');
    grid.position.y = 0.001;
    this.scene.add(grid);

    this.root = el('div', 'gallery');
    const side = el('div', 'gallery-side');
    const head = el('div', 'gallery-head');
    const h = el('b', '');
    this.head = h;
    h.textContent = t('Gallery');
    const close = el('button', 'rbtn');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close gallery'));
    close.addEventListener('click', () => this.onClose());
    head.append(h, close);
    this.list = el('div', 'gallery-list');
    side.append(head, this.list);

    const info = el('div', 'gallery-info');
    this.title = el('h2', '');
    this.desc = el('p', '');
    this.stats = el('div', 'gallery-stats');
    const tools = el('div', 'gallery-tools');
    this.autoBtn = el('button', 'chipbtn active');
    this.autoBtn.textContent = t('Auto-rotate');
    this.autoBtn.addEventListener('click', () => this.setAutoRotate(!this.autoRotate));
    this.wireBtn = el('button', 'chipbtn');
    this.wireBtn.textContent = t('Wireframe');
    this.wireBtn.addEventListener('click', () => this.setWireframe(!this.wireframe));
    const reset = el('button', 'chipbtn');
    this.resetBtn = reset;
    reset.textContent = t('Reset view');
    reset.addEventListener('click', () => this.frame());
    tools.append(this.autoBtn, this.wireBtn, reset);
    info.append(this.title, this.desc, this.stats, tools);

    this.buildList();
    this.root.append(side, info);
    parent.appendChild(this.root);
  }

  private buildList() {
    this.list.replaceChildren();
    this.buttons.clear();
    for (const g of GROUPS) {
      const label = el('div', 'gallery-group');
      label.textContent = t(g);
      this.list.appendChild(label);
      for (const e of CATALOG.filter((c) => c.group === g)) {
        const b = el('button', 'gallery-item');
        b.textContent = t(e.name);
        b.addEventListener('click', () => this.select(e));
        this.buttons.set(e.id, b);
        this.list.appendChild(b);
      }
    }
  }

  /** Language changed: re-translate labels. */
  relabel() {
    this.head.textContent = t('Gallery');
    this.autoBtn.textContent = t('Auto-rotate');
    this.wireBtn.textContent = t('Wireframe');
    this.resetBtn.textContent = t('Reset view');
    this.buildList();
    if (this.visible) this.select(this.entry);
  }

  show() {
    this.visible = true;
    this.root.classList.add('show');
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.select(this.entry);
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
    this.controls?.dispose();
    this.controls = null;
    if (this.current) {
      this.scene.remove(this.current);
      disposeObject(this.current);
      this.current = null;
    }
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  update() {
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 1.5;
      this.controls.update();
    }
  }

  private select(e: CatalogEntry) {
    this.entry = e;
    this.buttons.forEach((b, id) => b.classList.toggle('active', id === e.id));
    if (this.current) {
      this.scene.remove(this.current);
      disposeObject(this.current);
    }
    const obj = centerObject(e.make());
    // small things (cars, animals) are scaled up so they're comfortable to inspect
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    const scale = Math.max(1, 1.2 / Math.max(size.x, size.y, size.z));
    obj.scale.multiplyScalar(scale);
    centerObject(obj);
    this.current = obj;
    this.scene.add(obj);
    this.setWireframe(this.wireframe);
    this.frame();

    let tris = 0;
    obj.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g?.attributes.position) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    this.title.textContent = t(e.name);
    this.desc.textContent = t(e.desc);
    this.stats.textContent = `${t(e.group)} · ${t('{n} triangles', { n: Math.round(tris).toLocaleString('en-US') })} · ${fmt(size.x)} × ${fmt(size.z)} · ${t('height {n}', { n: fmt(size.y) })}${scale > 1 ? ` · ×${fmt(scale)}` : ''}`;
  }

  private frame() {
    if (!this.current) return;
    const s = fitCamera(this.camera, this.current, 1.35);
    this.controls?.target.copy(s.center);
    this.controls?.update();
  }

  private setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.autoBtn.classList.toggle('active', on);
  }

  private setWireframe(on: boolean) {
    this.wireframe = on;
    this.wireBtn.classList.toggle('active', on);
    this.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (m) m.wireframe = on;
    });
  }
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

import * as THREE from 'three';
import type { Building } from '../buildings/Buildings';
import { BUILDINGS } from '../buildings/BuildingTypes';

/** A problem shown above a building. */
export type Problem = 'power' | 'water' | 'food' | 'workers' | 'road' | 'cold' | 'trash' | 'sick';

const ICON: Record<Problem, [string, string]> = {
  power: ['⚡', '#f2b33d'], water: ['💧', '#4fa3d1'], food: ['🍞', '#e8a13a'], workers: ['👷', '#6fb6ff'],
  road: ['🚧', '#f07167'], cold: ['❄️', '#9fd3ff'], trash: ['🗑️', '#8e96a1'], sick: ['🤒', '#f07167'],
};

/**
 * Map overlays: problem badges floating over buildings, the reach of a selected service (police, fire, decorations)
 * and the buildings fed by a selected power plant.
 */
export class Overlays {
  readonly group = new THREE.Group();
  private badges = new Map<number, { sprite: THREE.Sprite; problem: Problem }>();
  private textures = new Map<Problem, THREE.Texture>();
  private ring: THREE.Group;
  private fill: THREE.Mesh;
  private edge: THREE.Mesh;
  private grid: THREE.InstancedMesh;
  private time = 0;
  /** Thought bubbles over walkers. */
  private bubbles: { target: { x: number; z: number; leaving: boolean; scale: number }; sprite: THREE.Sprite; t: number }[] = [];
  private bubbleTex = new Map<string, THREE.Texture>();

  /** Show a little speech bubble with an emoji above a walking person for a few seconds. */
  bubble(target: { x: number; z: number; leaving: boolean; scale: number }, emoji: string) {
    if (this.bubbles.length > 12 || this.bubbles.some((b) => b.target === target)) return;
    let tex = this.bubbleTex.get(emoji);
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const g = c.getContext('2d')!;
      g.fillStyle = '#f4f4f2';
      g.beginPath(); g.ellipse(48, 42, 40, 32, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(34, 66); g.lineTo(28, 90); g.lineTo(52, 70); g.fill();
      g.font = '40px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, 48, 44);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.bubbleTex.set(emoji, tex);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.renderOrder = 19;
    sprite.scale.set(0.26, 0.26, 1);
    this.group.add(sprite);
    this.bubbles.push({ target, sprite, t: 3.5 });
  }

  constructor() {
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6fb6ff', transparent: true, opacity: 0.12, depthWrite: false }));
    this.edge = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#6fb6ff', transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring = new THREE.Group();
    this.ring.add(this.fill, this.edge);
    this.ring.position.y = 0.06;
    this.ring.renderOrder = 6;
    this.ring.visible = false;
    this.grid = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.5, depthWrite: false }), 600);
    this.grid.count = 0;
    this.grid.frustumCulled = false;
    this.grid.renderOrder = 6;
    this.group.add(this.ring, this.grid);
  }

  private texture(p: Problem) {
    let tex = this.textures.get(p);
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(26,29,34,0.92)';
    g.beginPath(); g.arc(48, 44, 38, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ICON[p][1];
    g.lineWidth = 6;
    g.stroke();
    g.beginPath(); g.moveTo(38, 78); g.lineTo(48, 92); g.lineTo(58, 78); g.fillStyle = 'rgba(26,29,34,0.92)'; g.fill();
    g.font = '44px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ICON[p][0], 48, 46);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(p, tex);
    return tex;
  }

  /** Set the problem shown above each building (undefined = none). */
  setProblems(list: Building[], problemOf: (b: Building) => Problem | undefined) {
    const seen = new Set<number>();
    for (const b of list) {
      const p = problemOf(b);
      if (!p) continue;
      seen.add(b.id);
      let e = this.badges.get(b.id);
      if (!e) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(p), depthTest: false, transparent: true }));
        sprite.renderOrder = 19;
        this.group.add(sprite);
        e = { sprite, problem: p };
        this.badges.set(b.id, e);
      } else if (e.problem !== p) {
        e.problem = p;
        (e.sprite.material as THREE.SpriteMaterial).map = this.texture(p);
      }
      const s = BUILDINGS[b.kind].size;
      e.sprite.position.set(b.mesh.position.x, 0.75 + s * 0.45, b.mesh.position.z);
      e.sprite.userData.y = e.sprite.position.y;
      e.sprite.scale.set(0.42, 0.42, 1);
    }
    for (const [id, e] of this.badges) {
      if (seen.has(id)) continue;
      this.group.remove(e.sprite);
      e.sprite.material.dispose();
      this.badges.delete(id);
    }
  }

  /** Show how far a service reaches (radius in tiles) around a building, or hide it. */
  showRange(b: Building | undefined, radius = 0, color = '#6fb6ff') {
    this.ring.visible = !!b && radius > 0;
    if (!b || radius <= 0) return;
    this.ring.position.set(b.mesh.position.x, 0.06, b.mesh.position.z);
    this.ring.scale.set(radius, 1, radius);
    (this.fill.material as THREE.MeshBasicMaterial).color.set(color);
    (this.edge.material as THREE.MeshBasicMaterial).color.set(color);
  }

  /** Light up the footprints of the given buildings (e.g. everything a power plant feeds). */
  showGrid(list: Building[], color = '#ffe066', colors?: (b: Building) => string) {
    (this.grid.material as THREE.MeshBasicMaterial).color.set(colors ? '#ffffff' : color);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let n = 0;
    for (const b of list) {
      if (n >= 600) break;
      const s = BUILDINGS[b.kind].size;
      m.makeScale(s * 0.98, 1, s * 0.98).setPosition(b.mesh.position.x, 0.05, b.mesh.position.z);
      this.grid.setColorAt(n, c.set(colors ? colors(b) : '#ffffff'));
      this.grid.setMatrixAt(n++, m);
    }
    this.grid.count = n;
    this.grid.instanceMatrix.needsUpdate = true;
    if (this.grid.instanceColor) this.grid.instanceColor.needsUpdate = true;
    this.steady = !!colors;
  }
  /** A map layer is shown: no pulsing. */
  private steady = false;

  set visible(v: boolean) { this.group.visible = v; }

  update(dt: number) {
    this.time += dt;
    const bob = Math.sin(this.time * 3) * 0.04;
    for (const e of this.badges.values()) e.sprite.position.y = (e.sprite.userData.y as number) + bob;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t -= dt;
      if (b.t <= 0 || b.target.leaving) {
        this.group.remove(b.sprite);
        b.sprite.material.dispose();
        this.bubbles.splice(i, 1);
        continue;
      }
      b.sprite.position.set(b.target.x, 0.32 * b.target.scale + 0.08, b.target.z);
      (b.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, b.t * 2, (3.5 - b.t) * 4);
    }
    (this.grid.material as THREE.MeshBasicMaterial).opacity = this.grid.count ? (this.steady ? 0.62 : 0.5 + Math.sin(this.time * 4) * 0.15) : 0;
  }
}

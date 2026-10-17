import * as THREE from 'three';
import { BUILDINGS, BuildingKind } from '../buildings/BuildingTypes';
import { N, tileToWorld } from '../world/grid';

/** A town as another player shows it: its buildings (kind, x, z, turn, level) and its road tiles. */
export interface TownLayout { b: [string, number, number, number, number][]; r: number[] }

/**
 * Friends' towns on my map (online): the buildings and streets they built, drawn where their town lies, with their
 * town's name above it. Only a picture — nothing in them moves, and they appear once the friend has joined and played.
 */
/** One building of a friend's town, found by the tile it stands on. */
export interface GhostBuilding { owner: string; town: string; kind: BuildingKind; x: number; z: number; level: number }

export class GhostTowns {
  private towns = new Map<string, { key: string; group: THREE.Group }>();
  /** Tile → the friend's building on it (so it can be tapped). */
  private tiles = new Map<number, GhostBuilding>();
  private mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  private roadMat = new THREE.MeshLambertMaterial({ color: '#4a4f57' });
  private roadGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  constructor(private scene: THREE.Scene, private geometry: (kind: BuildingKind, x: number, z: number) => THREE.BufferGeometry) {}

  /** Show (or update) one friend's town. */
  set(id: string, name: string, tint: string, layout: TownLayout) {
    const key = `${name}|${layout.b.length}|${layout.r.length}|${JSON.stringify(layout.b).length}`;
    const old = this.towns.get(id);
    if (old?.key === key) return;
    if (old) this.drop(id);
    const g = new THREE.Group();
    let sx = 0, sz = 0, n = 0;
    for (const [kind, x, z, rot, level] of layout.b) {
      const d = BUILDINGS[kind as BuildingKind];
      if (!d) continue;
      let geo: THREE.BufferGeometry;
      try { geo = this.geometry(kind as BuildingKind, x, z); } catch { continue; }
      const m = new THREE.Mesh(geo, this.mat);
      m.position.set(tileToWorld(x) + (d.size - 1) / 2, 0, tileToWorld(z) + (d.size - 1) / 2);
      m.rotation.y = rot;
      if (level > 1 && kind !== 'house') m.scale.y = 1 + (level - 1) * 0.15;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      for (let dz = 0; dz < d.size; dz++) for (let dx = 0; dx < d.size; dx++) this.tiles.set((z + dz) * N + x + dx, { owner: id, town: name, kind: kind as BuildingKind, x, z, level });
      if (kind === 'townhall') { sx = m.position.x; sz = m.position.z; n = -1; }
      else if (n >= 0) { sx += m.position.x; sz += m.position.z; n++; }
    }
    if (layout.r.length) {
      const roads = new THREE.InstancedMesh(this.roadGeo, this.roadMat, layout.r.length);
      const mx = new THREE.Matrix4();
      layout.r.forEach((k, i) => { mx.makeTranslation(tileToWorld(k % N), 0.03, tileToWorld(Math.floor(k / N))); roads.setMatrixAt(i, mx); });
      roads.receiveShadow = true;
      g.add(roads);
    }
    // the town's name over its centre, in the friend's colour
    const cx = n > 0 ? sx / n : sx, cz = n > 0 ? sz / n : sz;
    g.add(label(name, tint, cx, cz));
    this.scene.add(g);
    this.towns.set(id, { key, group: g });
  }

  /** The friend's building on this tile, if any. */
  at(k: number) { return this.tiles.get(k); }

  /** Remove a friend's town (they left the world). */
  drop(id: string) {
    for (const [k, b] of this.tiles) if (b.owner === id) this.tiles.delete(k);
    const t = this.towns.get(id);
    if (!t) return;
    this.scene.remove(t.group);
    t.group.traverse((o) => { if ((o as THREE.Sprite).isSprite) { const s = o as THREE.Sprite; s.material.map?.dispose(); s.material.dispose(); } });
    this.towns.delete(id);
  }

  /** Keep only these friends. */
  keep(ids: string[]) { for (const id of [...this.towns.keys()]) if (!ids.includes(id)) this.drop(id); }

  dispose() { for (const id of [...this.towns.keys()]) this.drop(id); }
}

/** A floating name tag: "🌐 Name". */
function label(text: string, tint: string, x: number, z: number) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(26,29,34,0.88)';
  g.beginPath(); g.roundRect(8, 16, 496, 96, 28); g.fill();
  g.strokeStyle = tint; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 54px Fredoka, Nunito, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`🌐 ${text}`.slice(0, 22), 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(3, 0.75, 1);
  s.position.set(x, 2.4, z);
  s.renderOrder = 20;
  return s;
}

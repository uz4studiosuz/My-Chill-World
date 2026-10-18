import { IS_TOUCH } from '../config';
import * as THREE from 'three';
import { Tile, clampTile, diagPath, inBounds, lPath } from '../world/grid';

import { Preview } from './Preview';
import { t as tr } from '../i18n/i18n';

export type PlaceKind =
  | 'townhall' | 'house' | 'office' | 'school' | 'parking' | 'weddinghall' | 'watertower' | 'quarry'
  | 'woodcutter' | 'powerplant' | 'farm' | 'orchard' | 'ranch' | 'cemetery' | 'roundabout'
  | 'kindergarten' | 'hotel' | 'windturbine' | 'solarfarm' | 'trainstation' | 'apartment' | 'ironmine' | 'fishery' | 'police' | 'firestation' | 'busdepot' | 'busstop' | 'grocery' | 'clothes' | 'park' | 'hospital' | 'university' | 'market' | 'carmarket' | 'bank' | 'gasstation' | 'factory' | 'carfactory' | 'construction'
  | 'stadium' | 'cinema' | 'academy' | 'playground' | 'fountain' | 'flowerbed' | 'statue' | 'bench' | 'lamppost' | 'sapling' | 'roadsign' | 'airport'
  | 'military' | 'landfill' | 'recycling' | 'mill' | 'bakery' | 'sawmill' | 'battery' | 'kiosk' | 'dairyshop' | 'greenhouse' | 'apiary' | 'poultry' | 'eldercare' | 'restaurant' | 'zoo' | 'pier' | 'forestry' | 'garage' | 'metro' | 'cctv' | 'levee' | 'embassy'
  | 'pharmacy' | 'dairy' | 'supermarket' | 'brickworks' | 'steelmill' | 'sewage' | 'coalmine' | 'coalplant' | 'hydro'
  | 'tower15' | 'tower30' | 'tower50' | 'warehouse' | 'concerthall' | 'casino' | 'mosque' | 'themepark' | 'bigpark' | 'gym' | 'teahouse' | 'barber' | 'bikefactory' | 'migration' | 'gazebo' | 'pond' | 'clocktower' | 'flagpole' | 'planter' | 'archway';

export type LineKind = 'road' | 'litroad' | 'path' | 'path_stone' | 'path_brick' | 'path_gravel' | 'path_wood' | 'canal' | 'rail' | 'pipe' | 'cable' | 'tunnel' | 'zone_res' | 'zone_com' | 'zone_ind' | 'zone_none';
/** Footpath styles: the tool and the style number kept in the tiles (1 = yellow pavers). */
export const PATH_STYLE: Partial<Record<string, number>> = { path: 1, path_stone: 2, path_brick: 3, path_gravel: 4, path_wood: 5 };
export const isPathKind = (t: string) => PATH_STYLE[t] !== undefined;
/** Zoning brushes: residential, commercial, industrial, and the eraser (painted as a rectangle). */
export const ZONE_OF: Partial<Record<string, number>> = { zone_res: 1, zone_com: 2, zone_ind: 3, zone_none: 0 };
export const isZone = (t: string) => ZONE_OF[t] !== undefined;
export type ToolId = 'pan' | 'bulldoze' | LineKind | PlaceKind;

export interface CheckResult { ok: boolean; reason?: string; money?: number; stone?: number; wood?: number; iron?: number; bridges?: number }

export interface GhostInfo {
  geo: THREE.BufferGeometry;
  size: number;
  rot: number;
}

/** What the tool needs from the game. Every action re-validates and reports its own errors. */
export interface ToolHost {
  checkLine(kind: LineKind, path: Tile[]): CheckResult;
  buildLine(kind: LineKind, path: Tile[]): void;
  checkPlace(kind: PlaceKind, t: Tile, rotDir?: number): CheckResult;
  place(kind: PlaceKind, t: Tile, rotDir?: number): void;
  footprint(kind: PlaceKind, t: Tile): Tile[];
  bulldoze(path: Tile[]): void;
  showHint(text: string | null): void;
  /** A build is waiting for the player's confirmation (null = nothing pending). */
  pending(info: { text: string; ok: boolean; canRotate?: boolean } | null): void;
  getGhost?(kind: PlaceKind, t: Tile, rotDir: number): GhostInfo | null;
}

const OK = new THREE.Color('#5fe08a');
const BAD = new THREE.Color('#ff5a4f');
const REMOVE = new THREE.Color('#ff8a3d');

const isLine = (t: ToolId): t is LineKind => t === 'road' || t === 'litroad' || isPathKind(t) || t === 'canal' || t === 'rail' || t === 'pipe' || t === 'cable' || t === 'tunnel' || isZone(t);
const isPlace = (t: ToolId): t is PlaceKind => t !== 'pan' && t !== 'bulldoze' && !isLine(t);

export class BuildTool {
  tool: ToolId = 'pan';
  rotDir = 0;
  private start: Tile | null = null;
  private current: Tile | null = null;
  private path: Tile[] = [];
  private waiting: { tool: ToolId; path: Tile[]; cur: Tile } | null = null;

  constructor(private host: ToolHost, private preview: Preview) {}

  get active() { return this.tool !== 'pan'; }
  /** A building (not a road or the bulldozer) is being placed. */
  get placing() { return isPlace(this.tool); }

  /** Is this tile under the building that waits for confirmation (so a drag there moves the building)? */
  onGhost(t: Tile) {
    const w = this.waiting;
    if (!w || !isPlace(w.tool)) return false;
    return this.host.footprint(w.tool, w.cur).some((f) => f.x === t.x && f.z === t.z);
  }

  /** Tap: put the building (waiting for confirmation) on this tile. */
  placeAt(t: Tile) {
    this.begin(t);
    this.commit();
  }
  get hasPending() { return this.waiting !== null; }

  setTool(t: ToolId) {
    this.cancel();
    this.tool = t;
    this.rotDir = 0;
  }

  setRotation(dir: number) {
    this.rotDir = ((dir % 4) + 4) % 4;
    const target = this.current ?? this.waiting?.cur;
    if (target) this.update(target);
  }

  rotate() {
    if (!isPlace(this.tool)) return;
    this.rotDir = (this.rotDir + 1) % 4;
    const target = this.current ?? this.waiting?.cur;
    if (target) {
      const wasWaiting = this.waiting;
      this.update(target);
      if (wasWaiting) {
        this.current = null;
        const r = this.host.checkPlace(wasWaiting.tool as PlaceKind, target, this.rotDir);
        const tiles = isLine(wasWaiting.tool) ? `${tr('{n} tiles', { n: wasWaiting.path.length })} · ` : '';
        this.host.pending({ text: r.ok ? `${tiles}${cost(r)}` : `⛔ ${r.reason ?? tr('Cannot build here')} · ${tr('drag it to a free place')}`, ok: r.ok, canRotate: true });
      }
    }
  }

  begin(t: Tile) {
    if (this.waiting) { this.waiting = null; this.host.pending(null); }
    this.start = clampTile(t);
    this.update(this.start);
  }

  drag(t: Tile) {
    if (!this.start) return;
    this.update(t);
  }

  hover(t: Tile | null) {
    if (this.start || !this.active || this.waiting) return;
    if (!t || !inBounds(t.x, t.z)) {
      this.preview.hide();
      this.host.showHint(null);
      return;
    }
    this.start = t;
    this.update(t);
    this.start = null;
  }

  commit() {
    if (!this.start || !this.current) return;
    const path = this.path, cur = this.current, tool = this.tool;
    if (tool === 'bulldoze') { this.cancel(); this.host.bulldoze(path); return; }
    // buildings and lines wait for a confirmation (the preview stays on the map)
    const r = isLine(tool) ? this.host.checkLine(tool, path) : isPlace(tool) ? this.host.checkPlace(tool, cur, this.rotDir) : { ok: false };
    this.start = null;
    this.current = null;
    // a building that cannot stand here still goes down (in red, saying why): drag it to a good place
    if (!r.ok && isPlace(tool)) {
      this.waiting = { tool, path, cur };
      this.host.pending({ text: `⛔ ${r.reason ?? tr('Cannot build here')} · ${tr('drag it to a free place')}`, ok: false, canRotate: true });
      this.host.showHint(null);
      return;
    }
    if (!r.ok) {
      this.cancel();
      if (isLine(tool)) this.host.buildLine(tool, path);
      else if (isPlace(tool)) this.host.place(tool, cur, this.rotDir);
      return;
    }
    this.waiting = { tool, path, cur };
    const tiles = isLine(tool) ? `${tr('{n} tiles', { n: path.length })} · ` : '';
    this.host.pending({ text: `${tiles}${cost(r)}`, ok: true, canRotate: isPlace(tool) });
    this.host.showHint(null);
  }

  /** Build what is waiting for confirmation. */
  confirm() {
    const w = this.waiting;
    if (!w) return;
    const rot = this.rotDir;
    this.cancel();
    if (isLine(w.tool)) this.host.buildLine(w.tool, w.path);
    else if (isPlace(w.tool)) this.host.place(w.tool, w.cur, rot);
  }

  cancel() {
    if (this.waiting) { this.waiting = null; }
    this.host.pending(null);
    this.start = null;
    this.current = null;
    this.path = [];
    this.preview.hide();
    this.host.showHint(null);
  }

  private update(t: Tile) {
    const cur = clampTile(t);
    this.current = cur;
    const tool = this.tool;
    if (isPlace(tool)) {
      const r = this.host.checkPlace(tool, cur, this.rotDir);
      this.preview.show(this.host.footprint(tool, cur), r.ok ? OK : BAD);
      const ghost = this.host.getGhost?.(tool, cur, this.rotDir);
      if (ghost) {
        this.preview.showGhost(ghost.geo, cur.x, cur.z, ghost.size, ghost.rot, r.ok);
      } else {
        this.preview.hideGhost();
      }
      const rotHint = IS_TOUCH ? ` · ${tr('Drag the building to move it, drag elsewhere to move the map')}` : ` · [R] ${tr('Rotate')}`;
      this.host.showHint(r.ok ? `${cost(r)}${rotHint}` : r.reason ?? null);
      return;
    }
    this.preview.hideGhost();
    this.path = isZone(tool) ? rectTiles(this.start!, cur) : isPathKind(tool) ? diagPath(this.start!, cur) : lPath(this.start!, cur);
    if (isLine(tool)) {
      const r = this.host.checkLine(tool, this.path);
      this.preview.show(this.path, r.ok ? OK : BAD);
      const bridge = r.bridges ? ` · ${tr('{n} bridge tiles', { n: r.bridges })}` : '';
      this.host.showHint(r.ok ? `${tr('{n} tiles', { n: this.path.length })}${bridge} · ${cost(r)}` : r.reason ?? null);
    } else {
      this.preview.show(this.path, REMOVE);
    }
  }
}

/** Every tile of the rectangle between two corners (zoning paints areas). */
function rectTiles(a: Tile, b: Tile): Tile[] {
  const out: Tile[] = [];
  for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) if (inBounds(x, z)) out.push({ x, z });
  return out;
}

function cost(r: CheckResult) {
  const parts = [];
  if (r.money) parts.push(`$${r.money}`);
  if (r.stone) parts.push(tr('{n} stone', { n: r.stone }));
  if (r.wood) parts.push(tr('{n} wood', { n: r.wood }));
  if (r.iron) parts.push(tr('{n} iron', { n: r.iron }));
  return parts.length ? parts.join(' + ') : tr('Free');
}

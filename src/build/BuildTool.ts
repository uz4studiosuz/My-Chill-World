import * as THREE from 'three';
import { Tile, clampTile, inBounds, lPath } from '../world/grid';
import { Preview } from './Preview';

export type PlaceKind =
  | 'house' | 'office' | 'school' | 'parking' | 'quarry'
  | 'woodcutter' | 'powerplant' | 'farm' | 'orchard' | 'ranch' | 'roundabout';
export type LineKind = 'road' | 'path';
export type ToolId = 'pan' | 'bulldoze' | LineKind | PlaceKind;

export interface CheckResult { ok: boolean; reason?: string; money?: number; stone?: number; bridges?: number }

/** What the tool needs from the game. Every action re-validates and reports its own errors. */
export interface ToolHost {
  checkLine(kind: LineKind, path: Tile[]): CheckResult;
  buildLine(kind: LineKind, path: Tile[]): void;
  checkPlace(kind: PlaceKind, t: Tile): CheckResult;
  place(kind: PlaceKind, t: Tile): void;
  footprint(kind: PlaceKind, t: Tile): Tile[];
  bulldoze(path: Tile[]): void;
  showHint(text: string | null): void;
}

const OK = new THREE.Color('#5fe08a');
const BAD = new THREE.Color('#ff5a4f');
const REMOVE = new THREE.Color('#ff8a3d');

const isLine = (t: ToolId): t is LineKind => t === 'road' || t === 'path';
const isPlace = (t: ToolId): t is PlaceKind => t !== 'pan' && t !== 'bulldoze' && !isLine(t);

export class BuildTool {
  tool: ToolId = 'pan';
  private start: Tile | null = null;
  private current: Tile | null = null;
  private path: Tile[] = [];

  constructor(private host: ToolHost, private preview: Preview) {}

  get active() { return this.tool !== 'pan'; }

  setTool(t: ToolId) {
    this.cancel();
    this.tool = t;
  }

  begin(t: Tile) {
    this.start = clampTile(t);
    this.update(this.start);
  }

  drag(t: Tile) {
    if (this.start) this.update(t);
  }

  hover(t: Tile | null) {
    if (this.start || !this.active) return;
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
    this.cancel();
    if (isLine(tool)) this.host.buildLine(tool, path);
    else if (isPlace(tool)) this.host.place(tool, cur);
    else if (tool === 'bulldoze') this.host.bulldoze(path);
  }

  cancel() {
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
      const r = this.host.checkPlace(tool, cur);
      this.preview.show(this.host.footprint(tool, cur), r.ok ? OK : BAD);
      this.host.showHint(r.ok ? cost(r) : r.reason ?? null);
      return;
    }
    this.path = lPath(this.start!, cur);
    if (isLine(tool)) {
      const r = this.host.checkLine(tool, this.path);
      this.preview.show(this.path, r.ok ? OK : BAD);
      const bridge = r.bridges ? ` · ${r.bridges} bridge tiles` : '';
      this.host.showHint(r.ok ? `${this.path.length} tiles${bridge} · ${cost(r)}` : r.reason ?? null);
    } else {
      this.preview.show(this.path, REMOVE);
    }
  }
}

function cost(r: CheckResult) {
  const parts = [];
  if (r.money) parts.push(`$${r.money}`);
  if (r.stone) parts.push(`${r.stone} stone`);
  return parts.length ? parts.join(' + ') : 'Free';
}

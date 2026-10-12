import * as THREE from 'three';
import { Tile, clampTile, diagPath, inBounds, lPath } from '../world/grid';

import { Preview } from './Preview';
import { t as tr } from '../i18n/i18n';

export type PlaceKind =
  | 'townhall' | 'house' | 'office' | 'school' | 'parking' | 'weddinghall' | 'watertower' | 'quarry'
  | 'woodcutter' | 'powerplant' | 'farm' | 'orchard' | 'ranch' | 'cemetery' | 'roundabout'
  | 'park' | 'hospital' | 'university' | 'market' | 'carmarket' | 'bank' | 'gasstation' | 'factory' | 'carfactory' | 'construction';

export type LineKind = 'road' | 'path' | 'canal';
/** God powers are brushes: they act on every tile the pointer passes. */
export type GodKind = 'rain' | 'lightning' | 'raise' | 'lower';
export type ToolId = 'pan' | 'bulldoze' | LineKind | PlaceKind | GodKind;

export interface CheckResult { ok: boolean; reason?: string; money?: number; stone?: number; wood?: number; bridges?: number }

/** What the tool needs from the game. Every action re-validates and reports its own errors. */
export interface ToolHost {
  checkLine(kind: LineKind, path: Tile[]): CheckResult;
  buildLine(kind: LineKind, path: Tile[]): void;
  checkPlace(kind: PlaceKind, t: Tile): CheckResult;
  place(kind: PlaceKind, t: Tile): void;
  footprint(kind: PlaceKind, t: Tile): Tile[];
  bulldoze(path: Tile[]): void;
  brush(kind: GodKind, t: Tile, first: boolean): void;
  brushArea(kind: GodKind, t: Tile): Tile[];
  showHint(text: string | null): void;
  /** A build is waiting for the player's confirmation (null = nothing pending). */
  pending(info: { text: string; ok: boolean } | null): void;
}

const OK = new THREE.Color('#5fe08a');
const BAD = new THREE.Color('#ff5a4f');
const REMOVE = new THREE.Color('#ff8a3d');

const GOD = new THREE.Color('#ffd166');
const isLine = (t: ToolId): t is LineKind => t === 'road' || t === 'path' || t === 'canal';
export const isGod = (t: ToolId): t is GodKind => t === 'rain' || t === 'lightning' || t === 'raise' || t === 'lower';
const isPlace = (t: ToolId): t is PlaceKind => t !== 'pan' && t !== 'bulldoze' && !isLine(t) && !isGod(t);

export class BuildTool {
  tool: ToolId = 'pan';
  private start: Tile | null = null;
  private current: Tile | null = null;
  private path: Tile[] = [];
  private waiting: { tool: ToolId; path: Tile[]; cur: Tile } | null = null;

  constructor(private host: ToolHost, private preview: Preview) {}

  get active() { return this.tool !== 'pan'; }
  get hasPending() { return this.waiting !== null; }

  setTool(t: ToolId) {
    this.cancel();
    this.tool = t;
  }

  private lastBrush = '';

  begin(t: Tile) {
    if (this.waiting) { this.waiting = null; this.host.pending(null); }
    this.start = clampTile(t);
    if (isGod(this.tool)) {
      this.lastBrush = `${this.start.x},${this.start.z}`;
      this.current = this.start;
      this.host.brush(this.tool, this.start, true);
      this.preview.show(this.host.brushArea(this.tool, this.start), GOD);
      return;
    }
    this.update(this.start);
  }

  drag(t: Tile) {
    if (!this.start) return;
    if (isGod(this.tool)) {
      const c = clampTile(t);
      const key = `${c.x},${c.z}`;
      this.preview.show(this.host.brushArea(this.tool, c), GOD);
      if (key === this.lastBrush || this.tool === 'lightning') return;
      this.lastBrush = key;
      this.host.brush(this.tool, c, false);
      return;
    }
    this.update(t);
  }

  hover(t: Tile | null) {
    if (this.start || !this.active || this.waiting) return;
    if (!t || !inBounds(t.x, t.z)) {
      this.preview.hide();
      this.host.showHint(null);
      return;
    }
    if (isGod(this.tool)) {
      this.preview.show(this.host.brushArea(this.tool, t), GOD);
      return;
    }
    this.start = t;
    this.update(t);
    this.start = null;
  }

  commit() {
    if (!this.start || !this.current) return;
    const path = this.path, cur = this.current, tool = this.tool;
    if (isGod(tool)) { this.cancel(); return; }
    if (tool === 'bulldoze') { this.cancel(); this.host.bulldoze(path); return; }
    // buildings and lines wait for a confirmation (the preview stays on the map)
    const r = isLine(tool) ? this.host.checkLine(tool, path) : isPlace(tool) ? this.host.checkPlace(tool, cur) : { ok: false };
    this.start = null;
    this.current = null;
    if (!r.ok) {
      this.cancel();
      if (isLine(tool)) this.host.buildLine(tool, path);
      else if (isPlace(tool)) this.host.place(tool, cur);
      return;
    }
    this.waiting = { tool, path, cur };
    const tiles = isLine(tool) ? `${tr('{n} tiles', { n: path.length })} · ` : '';
    this.host.pending({ text: `${tiles}${cost(r)}`, ok: true });
    this.host.showHint(null);
  }

  /** Build what is waiting for confirmation. */
  confirm() {
    const w = this.waiting;
    if (!w) return;
    this.cancel();
    if (isLine(w.tool)) this.host.buildLine(w.tool, w.path);
    else if (isPlace(w.tool)) this.host.place(w.tool, w.cur);
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
      const r = this.host.checkPlace(tool, cur);
      this.preview.show(this.host.footprint(tool, cur), r.ok ? OK : BAD);
      this.host.showHint(r.ok ? cost(r) : r.reason ?? null);
      return;
    }
    this.path = tool === 'path' ? diagPath(this.start!, cur) : lPath(this.start!, cur);
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

function cost(r: CheckResult) {
  const parts = [];
  if (r.money) parts.push(`$${r.money}`);
  if (r.stone) parts.push(tr('{n} stone', { n: r.stone }));
  if (r.wood) parts.push(tr('{n} wood', { n: r.wood }));
  return parts.length ? parts.join(' + ') : tr('Free');
}

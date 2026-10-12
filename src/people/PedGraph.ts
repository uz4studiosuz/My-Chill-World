import { DIRS, N, tileToWorld } from '../world/grid';
import type { Point } from '../buildings/Buildings';

/**
 * Pedestrian network.
 * Nodes: open tiles (grass, footpaths, canals), road junctions (with zebra crossings) and the two
 * sidewalks of every straight road tile. Crossing from one sidewalk to the other is only possible
 * through a junction — i.e. on a zebra crossing.
 */
export interface PedWorld {
  roadType(k: number): number;
  roadConn(k: number): number;
  /** Cost to step onto an off-road tile (Infinity = blocked). */
  groundCost(k: number): number;
}

const NN = N * N;
const SIDE = 0.43;

export const isSidewalk = (n: number) => n >= NN;
const sidewalk = (k: number, side: number) => NN + k * 2 + side;
const tileOf = (n: number) => (n >= NN ? (n - NN) >> 1 : n);
const sideOf = (n: number) => (n - NN) & 1;

/** 'x' = road runs east–west, 'z' = north–south, 'j' = junction / corner / ring. */
type Axis = 'x' | 'z' | 'j';

export class PedGraph {
  constructor(private w: PedWorld) {}

  private axis(k: number): Axis {
    const c = this.w.roadConn(k);
    if (this.w.roadType(k) === 3) return 'j';
    const ew = (c & (2 | 8)) !== 0, ns = (c & (1 | 4)) !== 0;
    if (ew && !ns) return 'x';
    if (ns && !ew) return 'z';
    return 'j';
  }

  /** Graph node for a tile; on a straight road, the sidewalk nearest `near`. */
  node(k: number, near?: Point): number {
    if (!this.w.roadType(k)) return k;
    const a = this.axis(k);
    if (a === 'j') return k;
    if (!near) return sidewalk(k, 0);
    const cx = tileToWorld(k % N), cz = tileToWorld((k / N) | 0);
    return sidewalk(k, (a === 'x' ? near.z > cz : near.x > cx) ? 1 : 0);
  }

  position(n: number): Point {
    const k = tileOf(n);
    const cx = tileToWorld(k % N), cz = tileToWorld((k / N) | 0);
    if (n < NN) return { x: cx, z: cz };
    const s = sideOf(n) ? SIDE : -SIDE;
    return this.axis(k) === 'x' ? { x: cx, z: cz + s } : { x: cx + s, z: cz };
  }

  heuristic(a: number, b: number) {
    const ka = tileOf(a), kb = tileOf(b);
    return (Math.abs((ka % N) - (kb % N)) + Math.abs(((ka / N) | 0) - ((kb / N) | 0))) * 0.7;
  }

  /** Calls `visit(node, cost)` for each neighbour. */
  neighbours(n: number, visit: (m: number, cost: number) => void) {
    const k = tileOf(n);
    const x = k % N, z = (k / N) | 0;
    const road = this.w.roadType(k) !== 0;
    const a: Axis = road ? this.axis(k) : 'j';

    for (const d of DIRS) {
      const nx = x + d.dx, nz = z + d.dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const nk = nz * N + nx;
      const along = (d.dx !== 0 && a === 'x') || (d.dz !== 0 && a === 'z');

      if (n >= NN) {
        // sidewalk: move along the road, or step off on its own side
        const side = sideOf(n);
        const towardSide = a === 'x' ? d.dz === (side ? 1 : -1) : d.dx === (side ? 1 : -1);
        if (!along && !towardSide) continue; // that would be crossing the road
        if (along) this.enterFrom(nk, d, visit, side);
        else this.enterFrom(nk, d, visit);
        continue;
      }
      // open tile or junction: step anywhere
      this.enterFrom(nk, d, visit);
    }
  }

  /** Step onto tile nk moving in direction d; `keepSide` keeps the same sidewalk when walking along a road. */
  private enterFrom(nk: number, d: { dx: number; dz: number }, visit: (m: number, cost: number) => void, keepSide?: number) {
    if (!this.w.roadType(nk)) {
      const c = this.w.groundCost(nk);
      if (isFinite(c)) visit(nk, c);
      return;
    }
    const a = this.axis(nk);
    if (a === 'j') { visit(nk, 1); return; }
    const along = (d.dx !== 0 && a === 'x') || (d.dz !== 0 && a === 'z');
    if (along) {
      // entering a road lengthwise: same sidewalk, or either side when coming from a junction/zebra
      if (keepSide !== undefined) visit(sidewalk(nk, keepSide), 1);
      else { visit(sidewalk(nk, 0), 1); visit(sidewalk(nk, 1), 1); }
    } else {
      // stepping onto a road from the side: only its near sidewalk
      const side = a === 'x' ? (d.dz > 0 ? 0 : 1) : (d.dx > 0 ? 0 : 1);
      visit(sidewalk(nk, side), 1);
    }
  }

  /**
   * World-space waypoints for a node path. Junctions are crossed corner to corner,
   * so pedestrians walk along the zebra crossings instead of through the middle.
   */
  points(path: number[], from: Point, to: Point): Point[] {
    const pos = path.map((n) => this.position(n));
    const out: Point[] = [from];
    for (let i = 0; i < path.length; i++) {
      const n = path[i];
      if (n >= NN || !this.w.roadType(n)) { out.push(pos[i]); continue; }
      const c = pos[i];
      const prev = i > 0 ? pos[i - 1] : from;
      const next = i < path.length - 1 ? pos[i + 1] : to;
      const corner = (p: Point) => ({ x: c.x + (p.x >= c.x ? SIDE : -SIDE), z: c.z + (p.z >= c.z ? SIDE : -SIDE) });
      const a = corner(prev), b = corner(next);
      out.push(a);
      if (a.x !== b.x && a.z !== b.z) {
        // diagonal: go round via the corner that keeps the walk shortest
        const m1 = { x: a.x, z: b.z }, m2 = { x: b.x, z: a.z };
        const d1 = Math.hypot(m1.x - next.x, m1.z - next.z) + Math.hypot(m1.x - prev.x, m1.z - prev.z);
        const d2 = Math.hypot(m2.x - next.x, m2.z - next.z) + Math.hypot(m2.x - prev.x, m2.z - prev.z);
        out.push(d1 < d2 ? m1 : m2);
      }
      out.push(b);
    }
    out.push(to);
    return out;
  }
}

// ---------- A* over the pedestrian graph ----------

const SIZE = NN * 3;
const g = new Float32Array(SIZE);
const prev = new Int32Array(SIZE);
const stamp = new Uint32Array(SIZE);
const closed = new Uint32Array(SIZE);
let current = 0;
let heapF = new Float32Array(8192);
let heapN = new Int32Array(8192);
let size = 0;

function push(f: number, n: number) {
  if (size >= heapF.length) {
    const nf = new Float32Array(heapF.length * 2); nf.set(heapF); heapF = nf;
    const nn = new Int32Array(heapN.length * 2); nn.set(heapN); heapN = nn;
  }
  let i = size++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p] <= f) break;
    heapF[i] = heapF[p]; heapN[i] = heapN[p];
    i = p;
  }
  heapF[i] = f; heapN[i] = n;
}

function pop() {
  const top = heapN[0];
  const lf = heapF[--size], ln = heapN[size];
  let i = 0;
  for (;;) {
    let c = i * 2 + 1;
    if (c >= size) break;
    if (c + 1 < size && heapF[c + 1] < heapF[c]) c++;
    if (heapF[c] >= lf) break;
    heapF[i] = heapF[c]; heapN[i] = heapN[c];
    i = c;
  }
  heapF[i] = lf; heapN[i] = ln;
  return top;
}

export function pedPath(graph: PedGraph, from: number, to: number, maxIter = 60000): number[] | null {
  if (from === to) return [from];
  current++;
  size = 0;
  g[from] = 0;
  stamp[from] = current;
  prev[from] = -1;
  push(graph.heuristic(from, to), from);
  let iter = 0;
  let cur = -1;
  const visit = (m: number, c: number) => {
    const ng = g[cur] + c;
    if (stamp[m] === current && ng >= g[m]) return;
    stamp[m] = current;
    g[m] = ng;
    prev[m] = cur;
    push(ng + graph.heuristic(m, to), m);
  };
  while (size > 0 && iter++ < maxIter) {
    cur = pop();
    if (closed[cur] === current) continue;
    closed[cur] = current;
    if (cur === to) break;
    graph.neighbours(cur, visit);
  }
  if (stamp[to] !== current || closed[to] !== current) return null;
  const path: number[] = [];
  for (let n = to; n !== -1; n = prev[n]) path.push(n);
  return path.reverse();
}

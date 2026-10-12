import { N, DIRS, Tile, dirBit, idx, inBounds, oppositeBit } from '../world/grid';

export const ROAD_NONE = 0;
export const ROAD_ONE_LANE = 1;
export const ROAD_TWO_LANE = 2;
/** Tile that is part of a roundabout ring (one-way, counter-clockwise). */
export const ROAD_RING = 3;
export type RoadType = 0 | 1 | 2 | 3;

/** Cost per tile. Roads over water become bridges and cost more. */
export const ROAD_COST: Record<1 | 2, { money: number; stone: number }> = {
  1: { money: 15, stone: 1 },
  2: { money: 25, stone: 2 },
};
export const BRIDGE_COST = { money: 70, stone: 6 };
export const ROUNDABOUT_COST = { money: 350, stone: 24 };

/** Ring offsets around the centre in driving order (counter-clockwise seen from above). */
export const RING = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]] as const;
/** Ring positions that may connect to an outside road (middle of each side). */
export const isRingMid = (dx: number, dz: number) => (dx === 0) !== (dz === 0);

interface Snapshot {
  type: Uint8Array; conn: Uint8Array; ringNext: Uint8Array; ringBits: Uint8Array; ringCenter: Int32Array;
  roundabouts: number[]; money: number; stone: number;
}

/**
 * Road data on the grid. Connections are stored explicitly (bitmask per tile),
 * so two parallel roads next to each other don't merge automatically.
 */
export class RoadNetwork {
  readonly type = new Uint8Array(N * N);
  readonly conn = new Uint8Array(N * N);
  /** Ring tiles: the only direction allowed along the ring. */
  readonly ringNext = new Uint8Array(N * N);
  /** Ring tiles: both ring-loop connection bits. */
  readonly ringBits = new Uint8Array(N * N);
  /** Centre tile of the roundabout for ring tiles and the island, else -1. */
  readonly ringCenter = new Int32Array(N * N).fill(-1);
  roundabouts: number[] = [];
  /** Incremented on every change — lets other systems cache path lookups. */
  version = 0;
  private undoStack: Snapshot[] = [];

  get canUndo() { return this.undoStack.length > 0; }

  hasRoad(t: Tile) { return this.type[idx(t.x, t.z)] !== ROAD_NONE; }

  isRing(k: number) { return this.type[k] === ROAD_RING; }

  /** Roundabout island (centre tile) — nothing can be built there. */
  isIsland(k: number) { return this.ringCenter[k] === k; }

  /** Directions a vehicle may leave tile k in (rings are one-way). */
  allowed(k: number) {
    const c = this.conn[k];
    return this.ringBits[k] ? (c & ~this.ringBits[k]) | this.ringNext[k] : c;
  }

  isIntersection(k: number) {
    if (this.ringBits[k]) return false;
    const c = this.conn[k];
    return ((c & 1) + ((c >> 1) & 1) + ((c >> 2) & 1) + ((c >> 3) & 1)) >= 3;
  }

  /** Counts per road kind (bridges = road tiles on water). */
  counts(water?: Uint8Array) {
    const out = { oneLane: 0, twoLane: 0, ring: 0, bridges: 0, total: 0 };
    for (let k = 0; k < this.type.length; k++) {
      const t = this.type[k];
      if (!t) continue;
      out.total++;
      if (t === ROAD_ONE_LANE) out.oneLane++;
      else if (t === ROAD_TWO_LANE) out.twoLane++;
      else out.ring++;
      if (water?.[k]) out.bridges++;
    }
    return out;
  }

  buildPath(path: Tile[], type: RoadType) {
    for (let i = 0; i < path.length; i++) {
      const k = idx(path[i].x, path[i].z);
      if (this.type[k] !== ROAD_RING) this.type[k] = type;
      if (i > 0) this.connect(path[i - 1], path[i]);
    }
    this.version++;
  }

  removePath(path: Tile[]) {
    for (const t of path) {
      const k = idx(t.x, t.z);
      const c = this.ringCenter[k];
      if (c >= 0) this.removeRoundabout(c);
      else this.remove(t);
    }
    this.version++;
  }

  addRoundabout(cx: number, cz: number) {
    // replace whatever roads were inside the 3x3 area
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.remove({ x: cx + dx, z: cz + dz });
    const center = idx(cx, cz);
    for (let i = 0; i < RING.length; i++) {
      const [ax, az] = RING[i], [bx, bz] = RING[(i + 1) % RING.length];
      const k = idx(cx + ax, cz + az), nk = idx(cx + bx, cz + bz);
      const bit = dirBit({ x: ax, z: az }, { x: bx, z: bz });
      this.type[k] = ROAD_RING;
      this.conn[k] |= bit;
      this.conn[nk] |= oppositeBit(bit);
    }
    this.markRing(center);
    // hook up existing roads that end at the middle of a side
    for (const [dx, dz] of RING) {
      if (!isRingMid(dx, dz)) continue;
      const ox = cx + dx * 2, oz = cz + dz * 2;
      if (inBounds(ox, oz) && this.type[idx(ox, oz)] && this.type[idx(ox, oz)] !== ROAD_RING) {
        this.connect({ x: cx + dx, z: cz + dz }, { x: ox, z: oz });
      }
    }
    this.roundabouts.push(center);
    this.version++;
  }

  private removeRoundabout(center: number) {
    const cx = center % N, cz = (center / N) | 0;
    for (const [dx, dz] of RING) {
      const k = idx(cx + dx, cz + dz);
      this.ringBits[k] = 0;
      this.ringNext[k] = 0;
      this.ringCenter[k] = -1;
      this.remove({ x: cx + dx, z: cz + dz });
    }
    this.ringCenter[center] = -1;
    this.roundabouts = this.roundabouts.filter((c) => c !== center);
  }

  /** Derive ring metadata for a roundabout whose tiles/conns already exist. */
  private markRing(center: number) {
    const cx = center % N, cz = (center / N) | 0;
    for (let i = 0; i < RING.length; i++) {
      const [ax, az] = RING[i], [bx, bz] = RING[(i + 1) % RING.length], [px, pz] = RING[(i + 7) % RING.length];
      const k = idx(cx + ax, cz + az);
      this.ringNext[k] = dirBit({ x: ax, z: az }, { x: bx, z: bz });
      this.ringBits[k] = this.ringNext[k] | dirBit({ x: ax, z: az }, { x: px, z: pz });
      this.ringCenter[k] = center;
    }
    this.ringCenter[center] = center;
  }

  private remove(t: Tile) {
    if (!inBounds(t.x, t.z)) return;
    const k = idx(t.x, t.z);
    if (this.type[k] === ROAD_NONE) return;
    for (const d of DIRS) {
      if (this.conn[k] & d.bit) this.conn[idx(t.x + d.dx, t.z + d.dz)] &= ~oppositeBit(d.bit);
    }
    this.type[k] = ROAD_NONE;
    this.conn[k] = 0;
  }

  private connect(a: Tile, b: Tile) {
    const bit = dirBit(a, b);
    if (!bit) return;
    this.conn[idx(a.x, a.z)] |= bit;
    this.conn[idx(b.x, b.z)] |= oppositeBit(bit);
  }

  /** Remember the current state; `money`/`stone` are refunded if this step is undone. */
  pushUndo(money = 0, stone = 0) {
    this.undoStack.push({
      type: this.type.slice(), conn: this.conn.slice(), ringNext: this.ringNext.slice(),
      ringBits: this.ringBits.slice(), ringCenter: this.ringCenter.slice(), roundabouts: [...this.roundabouts], money, stone,
    });
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  undo(): { money: number; stone: number } | null {
    const s = this.undoStack.pop();
    if (!s) return null;
    this.type.set(s.type);
    this.conn.set(s.conn);
    this.ringNext.set(s.ringNext);
    this.ringBits.set(s.ringBits);
    this.ringCenter.set(s.ringCenter);
    this.roundabouts = s.roundabouts;
    this.version++;
    return { money: s.money, stone: s.stone };
  }

  clearUndo() {
    this.undoStack = [];
  }

  /** Flat list: [tileIndex, type, conn, ...] — only road tiles. */
  serialize(): number[] {
    const out: number[] = [];
    for (let k = 0; k < this.type.length; k++) {
      if (this.type[k] !== ROAD_NONE) out.push(k, this.type[k], this.conn[k]);
    }
    return out;
  }

  deserialize(data: number[], roundabouts: number[] = []) {
    this.type.fill(0);
    this.conn.fill(0);
    this.ringNext.fill(0);
    this.ringBits.fill(0);
    this.ringCenter.fill(-1);
    this.undoStack = [];
    for (let i = 0; i + 2 < data.length; i += 3) {
      const k = data[i];
      if (k < 0 || k >= this.type.length) continue;
      this.type[k] = data[i + 1] === ROAD_ONE_LANE ? ROAD_TWO_LANE : data[i + 1]; // 1-lane roads were retired
      this.conn[k] = data[i + 2];
    }
    this.roundabouts = [...roundabouts];
    for (const c of roundabouts) this.markRing(c);
    this.version++;
  }
}

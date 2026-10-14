import * as THREE from 'three';
import { N, DIRS, tileToWorld } from '../world/grid';
import { WorldMap } from '../world/WorldMap';
import { WATER_BED } from '../config';
import { RoadNetwork, RING, ROAD_NONE, ROAD_RING, ROAD_TWO_LANE, isRingMid } from './RoadNetwork';
import { box, merge } from '../utils/voxel';

const COL_CURB = new THREE.Color('#cdc9bd');
const COL_ASPHALT_1 = new THREE.Color('#5d6168');
const COL_ASPHALT_2 = new THREE.Color('#4a4f57');
const COL_LINE = new THREE.Color('#f4f3ee');
const COL_ISLAND = new THREE.Color('#7fb04e');
const COL_FLOWERS = new THREE.Color('#e9c24a');

const Y_CURB = 0.02, Y_ASPHALT = 0.03, Y_LINE = 0.04;
export const HALF_WIDTH: Record<number, number> = { 1: 0.25, 2: 0.39, 3: 0.39 };
const CURB = 0.06;
/** Roundabout geometry (in tiles, from the centre). Vehicles drive at RING_RADIUS. */
export const RING_RADIUS = 1.0;
const RING_IN = 0.62, RING_OUT = 1.38;

type Dir = (typeof DIRS)[number];

/** Rebuilds merged meshes for all roads, roundabouts and bridges. Cheap enough to redo on every edit. */
export class RoadMesh {
  readonly group = new THREE.Group();
  private surface: THREE.Mesh;
  private bridges: THREE.Mesh;
  private pos: number[] = [];
  private col: number[] = [];

  constructor(private net: RoadNetwork, private map: WorldMap) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.surface = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.surface.receiveShadow = true;
    this.bridges = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.bridges.castShadow = true;
    this.bridges.receiveShadow = true;
    for (const m of [this.surface, this.bridges]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  rebuild() {
    this.pos = [];
    this.col = [];
    const { type, conn } = this.net;
    const bridgeParts: THREE.BufferGeometry[] = [];

    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const k = z * N + x;
        const t = type[k];
        if (t === ROAD_NONE) continue;
        const cx = tileToWorld(x), cz = tileToWorld(z);
        if (this.map.water[k]) bridgeParts.push(...this.bridge(cx, cz, conn[k], HALF_WIDTH[t], (x + z) % 2 === 0));
        if (t === ROAD_RING) continue;
        const c = conn[k];
        const h = HALF_WIDTH[t];
        const dirs = DIRS.filter((d) => c & d.bit);

        this.shape(cx, cz, dirs, h + CURB, Y_CURB, COL_CURB);
        this.shape(cx, cz, dirs, h, Y_ASPHALT, t === ROAD_TWO_LANE ? COL_ASPHALT_2 : COL_ASPHALT_1);

        if (t === ROAD_TWO_LANE) {
          if (dirs.length <= 2) {
            // dashed centre line, period 0.5 so it lines up across tiles
            for (const d of dirs) this.arm(cx, cz, d, 0.125, 0.375, -0.025, 0.025, Y_LINE, COL_LINE);
          } else {
            this.zebras(x, z, cx, cz, dirs, h);
          }
        }
      }
    }

    for (const center of this.net.roundabouts) this.roundabout(center);

    this.surface.geometry.dispose();
    this.surface.geometry = this.toGeometry();
    this.bridges.geometry.dispose();
    this.bridges.geometry = bridgeParts.length ? merge(bridgeParts) : new THREE.BufferGeometry();
    this.bridges.visible = bridgeParts.length > 0;
  }

  private zebras(x: number, z: number, cx: number, cz: number, dirs: Dir[], h: number) {
    const stripes = 5;
    const sw = (2 * h - 0.08) / (stripes * 2 - 1);
    const { type, conn } = this.net;
    for (const d of dirs) {
      // two junctions side by side (or a roundabout next door): no zebra between them, or the stripes overlap
      const nx = x + d.dx, nz = z + d.dz;
      if (nx >= 0 && nz >= 0 && nx < N && nz < N) {
        const nk = nz * N + nx;
        if (type[nk] === ROAD_RING) continue;
        let arms = 0;
        for (const dd of DIRS) if (conn[nk] & dd.bit) arms++;
        if (arms > 2) continue;
      }
      for (let i = 0; i < stripes; i++) {
        const a0 = -h + 0.04 + i * 2 * sw;
        this.arm(cx, cz, d, 0.41, 0.49, a0, a0 + sw, Y_LINE, COL_LINE);
      }
    }
  }

  private roundabout(center: number) {
    const ccx = tileToWorld(center % N), ccz = tileToWorld((center / N) | 0);
    const h = HALF_WIDTH[2];
    // approach arms on the sides that connect to outside roads
    for (const [dx, dz] of RING) {
      if (!isRingMid(dx, dz)) continue;
      const k = center + dz * N + dx;
      const outward = DIRS.find((d) => d.dx === dx && d.dz === dz)!;
      if (!(this.net.conn[k] & outward.bit)) continue;
      const mx = ccx + dx, mz = ccz + dz;
      this.arm(mx, mz, outward, RING_OUT - 1.08, 0.5, -(h + CURB), h + CURB, Y_CURB, COL_CURB);
      this.arm(mx, mz, outward, RING_OUT - 1.1, 0.5, -h, h, Y_ASPHALT, COL_ASPHALT_2);
      for (let i = 0; i < 4; i++) {
        const a0 = -h + 0.06 + i * 0.2;
        this.arm(mx, mz, outward, 0.42, 0.49, a0, a0 + 0.1, Y_LINE, COL_LINE);
      }
    }
    this.annulus(ccx, ccz, RING_IN - CURB, RING_OUT + CURB, Y_CURB, COL_CURB);
    this.annulus(ccx, ccz, RING_IN, RING_OUT, Y_ASPHALT, COL_ASPHALT_2);
    // dashed lane edge
    for (let i = 0; i < 24; i += 1) {
      const a0 = (i / 24) * Math.PI * 2, a1 = a0 + 0.12;
      this.arc(ccx, ccz, RING_OUT - 0.07, RING_OUT - 0.04, a0, a1, Y_LINE, COL_LINE);
    }
    this.annulus(ccx, ccz, 0, RING_IN - CURB, 0.06, COL_ISLAND);
    this.annulus(ccx, ccz, 0.22, 0.32, 0.065, COL_FLOWERS);
  }

  /** Bridge deck, railings and pillars for a road tile on water. */
  private bridge(cx: number, cz: number, c: number, h: number, pillars: boolean) {
    const parts: THREE.BufferGeometry[] = [];
    const alongX = (c & (2 | 8)) !== 0 && (c & (1 | 4)) === 0;
    const alongZ = (c & (1 | 4)) !== 0 && (c & (2 | 8)) === 0;
    const w = h * 2 + 0.24;
    const deckW = alongX ? 1 : w, deckD = alongZ ? 1 : w;
    parts.push(box(alongX || alongZ ? deckW : 1, 0.1, alongX || alongZ ? deckD : 1, cx, -0.035, cz, '#c9c4b8'));
    const rail = '#8c8f94';
    if (alongX) {
      parts.push(box(1, 0.08, 0.04, cx, 0.06, cz - h - 0.09, rail), box(1, 0.08, 0.04, cx, 0.06, cz + h + 0.09, rail));
    } else if (alongZ) {
      parts.push(box(0.04, 0.08, 1, cx - h - 0.09, 0.06, cz, rail), box(0.04, 0.08, 1, cx + h + 0.09, 0.06, cz, rail));
    }
    if (alongX || alongZ) {
      // a stone arch under every span, resting on piers at the tile edges
      const stone = '#b9b2a4', top = -0.09, foot = WATER_BED + 0.05;
      const rib = (a: number) => (alongX ? [cx + a, cz] : [cx, cz + a]);
      for (const side of [-1, 1]) {
        const off = side * (h + 0.04);
        for (let i = 0; i < 7; i++) {
          const a0 = -0.5 + i / 7, a1 = a0 + 1 / 7, am = (a0 + a1) / 2;
          // the underside of the arch: highest in the middle of the span
          const lift = Math.sin(((am + 0.5) / 1) * Math.PI);
          const bottom = foot + (top - 0.04 - foot) * (0.35 + 0.65 * lift);
          const hgt = top - bottom;
          const [px, pz] = rib(am);
          parts.push(alongX ? box(1 / 7 + 0.005, hgt, 0.06, px, bottom + hgt / 2, pz + off, stone) : box(0.06, hgt, 1 / 7 + 0.005, px + off, bottom + hgt / 2, pz, stone));
        }
      }
      if (pillars) {
        const ph = top - WATER_BED;
        const [px, pz] = rib(-0.5);
        parts.push(alongX ? box(0.12, ph, w, px, WATER_BED + ph / 2, pz, '#a9a294') : box(w, ph, 0.12, px, WATER_BED + ph / 2, pz, '#a9a294'));
      }
    } else if (pillars) {
      const ph = -0.085 - WATER_BED;
      const py = WATER_BED + ph / 2;
      parts.push(box(0.14, ph, 0.14, cx, py, cz));
    }
    return parts;
  }

  /** Centre square plus an arm towards every connected neighbour. */
  private shape(cx: number, cz: number, dirs: Dir[], h: number, y: number, c: THREE.Color) {
    this.rect(cx - h, cz - h, cx + h, cz + h, y, c);
    for (const d of dirs) this.arm(cx, cz, d, h, 0.5, -h, h, y, c);
  }

  /** Rectangle along direction d: r = distance from centre, a = across offset. */
  private arm(cx: number, cz: number, d: { dx: number; dz: number }, r0: number, r1: number, a0: number, a1: number, y: number, c: THREE.Color) {
    if (d.dx !== 0) this.rect(cx + d.dx * r0, cz + a0, cx + d.dx * r1, cz + a1, y, c);
    else this.rect(cx + a0, cz + d.dz * r0, cx + a1, cz + d.dz * r1, y, c);
  }

  private rect(x0: number, z0: number, x1: number, z1: number, y: number, c: THREE.Color) {
    this.tri(x0, z0, x0, z1, x1, z1, y, c);
    this.tri(x0, z0, x1, z1, x1, z0, y, c);
  }

  private annulus(cx: number, cz: number, r0: number, r1: number, y: number, c: THREE.Color) {
    this.arc(cx, cz, r0, r1, 0, Math.PI * 2, y, c, 40);
  }

  private arc(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, y: number, c: THREE.Color, segs = 3) {
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segs, t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      this.tri(cx + c0 * r1, cz + s0 * r1, cx + c1 * r1, cz + s1 * r1, cx + c1 * r0, cz + s1 * r0, y, c);
      if (r0 > 0) this.tri(cx + c0 * r1, cz + s0 * r1, cx + c1 * r0, cz + s1 * r0, cx + c0 * r0, cz + s0 * r0, y, c);
    }
  }

  /** Upward-facing triangle; winding is fixed automatically. */
  private tri(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, y: number, c: THREE.Color) {
    const cross = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (cross < 0) [bx, bz, cx, cz] = [cx, cz, bx, bz];
    this.pos.push(ax, y, az, bx, y, bz, cx, y, cz);
    for (let i = 0; i < 3; i++) this.col.push(c.r, c.g, c.b);
  }

  private toGeometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const normals = new Float32Array(this.pos.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return geo;
  }
}

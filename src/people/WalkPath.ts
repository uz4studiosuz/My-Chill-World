import { DIRS, N } from '../world/grid';

const g = new Float32Array(N * N);
const prev = new Int32Array(N * N);
const stamp = new Uint32Array(N * N);
const closed = new Uint32Array(N * N);
let current = 0;

// binary heap of [f, k]
let heapF = new Float32Array(4096);
let heapK = new Int32Array(4096);
let size = 0;

function push(f: number, k: number) {
  if (size >= heapF.length) {
    const nf = new Float32Array(heapF.length * 2); nf.set(heapF); heapF = nf;
    const nk = new Int32Array(heapK.length * 2); nk.set(heapK); heapK = nk;
  }
  let i = size++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p] <= f) break;
    heapF[i] = heapF[p]; heapK[i] = heapK[p];
    i = p;
  }
  heapF[i] = f; heapK[i] = k;
}

function pop() {
  const top = heapK[0];
  const lf = heapF[--size], lk = heapK[size];
  let i = 0;
  for (;;) {
    let c = i * 2 + 1;
    if (c >= size) break;
    if (c + 1 < size && heapF[c + 1] < heapF[c]) c++;
    if (heapF[c] >= lf) break;
    heapF[i] = heapF[c]; heapK[i] = heapK[c];
    i = c;
  }
  heapF[i] = lf; heapK[i] = lk;
  return top;
}

/**
 * A* for pedestrians. `cost(k)` is the price of stepping onto tile k (Infinity = blocked).
 * Footpaths and sidewalks are cheap, open grass is walkable but slower.
 */
export function walkPath(cost: (k: number) => number, from: number, to: number, maxIter = 40000): number[] | null {
  if (from === to) return [from];
  current++;
  size = 0;
  const tx = to % N, tz = (to / N) | 0;
  const h = (k: number) => (Math.abs((k % N) - tx) + Math.abs(((k / N) | 0) - tz)) * 0.8;
  g[from] = 0;
  stamp[from] = current;
  prev[from] = -1;
  push(h(from), from);

  let iter = 0;
  while (size > 0 && iter++ < maxIter) {
    const k = pop();
    if (closed[k] === current) continue;
    closed[k] = current;
    if (k === to) break;
    const x = k % N, z = (k / N) | 0;
    for (const d of DIRS) {
      const nx = x + d.dx, nz = z + d.dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const nk = nz * N + nx;
      const c = nk === to ? 1 : cost(nk);
      if (!isFinite(c)) continue;
      const ng = g[k] + c;
      if (stamp[nk] === current && ng >= g[nk]) continue;
      stamp[nk] = current;
      g[nk] = ng;
      prev[nk] = k;
      push(ng + h(nk), nk);
    }
  }
  if (stamp[to] !== current || closed[to] !== current) return null;
  const path: number[] = [];
  for (let k = to; k !== -1; k = prev[k]) path.push(k);
  return path.reverse();
}

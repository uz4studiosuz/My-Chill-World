import { DIRS, N } from '../world/grid';
import { RoadNetwork } from '../roads/RoadNetwork';

const prev = new Int32Array(N * N);
const stamp = new Uint32Array(N * N);
const queue = new Int32Array(N * N);
let current = 0;

/** BFS over road connections (respecting one-way rings). Returns tile indices from `from` to `to`, or null. */
export function findPath(net: RoadNetwork, from: number, to: number): number[] | null {
  if (!net.type[from] || !net.type[to]) return null;
  if (from === to) return [from];
  current++;
  let head = 0, tail = 0;
  queue[tail++] = from;
  stamp[from] = current;
  prev[from] = -1;

  while (head < tail) {
    const k = queue[head++];
    if (k === to) break;
    const x = k % N, z = (k / N) | 0, c = net.allowed(k);
    for (const d of DIRS) {
      if (!(c & d.bit)) continue;
      const nk = (z + d.dz) * N + x + d.dx;
      if (stamp[nk] === current) continue;
      stamp[nk] = current;
      prev[nk] = k;
      queue[tail++] = nk;
    }
  }
  if (stamp[to] !== current) return null;

  const path: number[] = [];
  for (let k = to; k !== -1; k = prev[k]) path.push(k);
  return path.reverse();
}

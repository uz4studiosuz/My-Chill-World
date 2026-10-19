import { N } from '../world/grid';
import type { WorldMap } from '../world/WorldMap';
import { t } from '../i18n/i18n';

/** What the small map needs from the game. */
export interface MiniMapHost {
  map: WorldMap;
  roads: ArrayLike<number>;
  trees: Set<number>;
  /** Buildings: tile, size and colour. */
  buildings(): { x: number; z: number; size: number; color: string }[];
  /** Camera: where it looks (world x, z), how far it sees (half the view height) and how it is turned. */
  camera(): { x: number; z: number; view: number; yaw: number; aspect: number };
  /** Fly the camera to this place (world x, z). */
  go(x: number, z: number, glide: boolean): void;
}

const KEY = 'mcw_minimap';

/**
 * A round map of the whole land in the corner: water, hills, woods, roads and every building, turned the way the
 * camera looks, with the part on screen marked. Tap or drag on it to go there.
 */
export class MiniMap {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private base = document.createElement('canvas');
  private baseAt = -1e9;
  private open = true;
  private drag = false;

  constructor(parent: HTMLElement, private host: MiniMapHost) {
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.el.innerHTML = '<div class="mm-disc"><canvas width="320" height="320"></canvas><i class="mm-n">N</i></div><button class="mm-toggle"></button>';
    this.canvas = this.el.querySelector('canvas')!;
    this.base.width = this.base.height = N;
    const disc = this.el.querySelector('.mm-disc') as HTMLElement;
    const toggle = this.el.querySelector('.mm-toggle') as HTMLButtonElement;
    try { this.open = localStorage.getItem(KEY) !== '0'; } catch { /* private mode */ }
    const setOpen = (v: boolean) => {
      this.open = v;
      this.el.classList.toggle('closed', !v);
      toggle.textContent = v ? '–' : '🗺';
      toggle.title = v ? t('Hide the map') : t('Show the map');
      try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ }
    };
    setOpen(this.open);
    toggle.addEventListener('click', () => setOpen(!this.open));
    const at = (e: PointerEvent, glide: boolean) => {
      const r = disc.getBoundingClientRect();
      const { yaw } = this.host.camera();
      // undo the turn of the disc, then from the disc to tiles
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const c = Math.cos(-yaw), s = Math.sin(-yaw);
      const px = dx * c - dy * s, py = dx * s + dy * c;
      // the whole map fits in the disc when turned (its diagonal is the disc's width)
      const k = N / (r.width * Math.SQRT1_2);
      this.host.go(px * k, py * k, glide);
    };
    disc.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.drag = true; disc.setPointerCapture(e.pointerId); at(e, true); });
    disc.addEventListener('pointermove', (e) => { if (this.drag) at(e, false); });
    disc.addEventListener('pointerup', () => { this.drag = false; });
    disc.addEventListener('pointercancel', () => { this.drag = false; });
    disc.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    parent.appendChild(this.el);
  }

  /** Called every frame: the land is redrawn every few seconds, the view mark every frame. */
  update() {
    if (!this.open) return;
    const now = performance.now();
    if (now - this.baseAt > 2500) { this.baseAt = now; this.paintBase(); }
    const cam = this.host.camera();
    this.canvas.style.transform = `rotate(${cam.yaw}rad)`;
    (this.el.querySelector('.mm-n') as HTMLElement).style.transform = `rotate(${cam.yaw}rad) translateY(-${this.canvas.clientWidth * 0.6}px) rotate(${-cam.yaw}rad)`;
    const g = this.canvas.getContext('2d')!;
    const S = this.canvas.width, k = S / N;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.base, 0, 0, S, S);
    // the part of the land on screen (a rectangle on the screen, so turned back by the camera's turn)
    const w = cam.view * 2 * cam.aspect, h = (cam.view * 2) / Math.sin((50 * Math.PI) / 180);
    g.save();
    g.translate((cam.x + N / 2) * k, (cam.z + N / 2) * k);
    g.rotate(-cam.yaw);
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect((-w / 2) * k, (-h / 2) * k, w * k, h * k);
    g.strokeRect((-w / 2) * k, (-h / 2) * k, w * k, h * k);
    g.restore();
  }

  private paintBase() {
    const g = this.base.getContext('2d')!;
    const img = g.createImageData(N, N);
    const { map, roads, trees } = this.host;
    const d = img.data;
    for (let i = 0; i < N * N; i++) {
      let r: number, gg: number, b: number;
      if (map.water[i]) { r = 63; gg = 147; b = 196; }
      else if (roads[i]) { r = 70; gg = 74; b = 82; }
      else if (map.height[i]) { const v = map.height[i] >= 7 ? 236 : 150 - map.height[i] * 4; r = v; gg = v - 2; b = v - 8; }
      else if (trees.has(i)) { r = 74; gg = 122; b = 56; }
      else if (map.arid[i] > 0.6) { r = 222; gg = 200; b = 146; }
      else if (map.arid[i] > 0.52) { r = 184; gg = 176; b = 106; }
      else if (map.cold[i] > 0.5) { r = 150; gg = 168; b = 150; }
      else { r = 140; gg = 177; b = 86; }
      d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (const bl of this.host.buildings()) { g.fillStyle = bl.color; g.fillRect(bl.x, bl.z, bl.size, bl.size); }
  }

  dispose() { this.el.remove(); }
}

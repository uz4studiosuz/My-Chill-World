import * as THREE from 'three';
import { CameraRig } from '../camera/CameraRig';
import { BuildTool, ToolId } from '../build/BuildTool';
import { Tile, worldToTile } from '../world/grid';

type Mode = 'none' | 'tool' | 'pan' | 'rotate' | 'gesture';

export interface InputActions {
  setTool: (t: ToolId) => void;
  undo: () => void;
  tap: (t: Tile | null, p?: { x: number; z: number }) => void;
  togglePause: () => void;
}

const TOOL_KEYS: Record<string, ToolId> = {
  Digit1: 'pan', Digit2: 'road', Digit3: 'path', Digit4: 'canal', Digit5: 'house',
  Digit6: 'rain', Digit7: 'lightning', Digit8: 'raise', Digit9: 'lower', KeyX: 'bulldoze',
};
// CrazyGames requirement: these keys must not scroll the parent page
const BLOCKED_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);
const TAP_PX = 8;

/**
 * Mouse + touch input.
 * Mouse: left = tool (or pan with Move tool), right = pan, middle = rotate, wheel = zoom.
 * Touch: one finger = tool (or pan), two fingers = pan + pinch zoom + twist rotate.
 */
export class InputController {
  /** Off while a menu / gallery is open. */
  enabled = true;
  private pointers = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'none';
  private gesture = { dist: 0, angle: 0, mx: 0, my: 0 };
  private keys = new Set<string>();
  private tmp = new THREE.Vector3();
  private down = { x: 0, y: 0, moved: false };

  constructor(
    private canvas: HTMLCanvasElement,
    private cam: CameraRig,
    private tool: BuildTool,
    private actions: InputActions,
    signal: AbortSignal,
  ) {
    const opts = { signal };
    canvas.addEventListener('pointerdown', this.onDown, opts);
    canvas.addEventListener('pointermove', this.onMove, opts);
    canvas.addEventListener('pointerup', this.onUp, opts);
    canvas.addEventListener('pointercancel', this.onUp, opts);
    canvas.addEventListener('pointerleave', () => { if (this.mode === 'none') this.tool.hover(null); }, opts);
    canvas.addEventListener('wheel', this.onWheel, { passive: false, signal });
    window.addEventListener('keydown', this.onKeyDown, opts);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), opts);
    window.addEventListener('blur', () => this.keys.clear(), opts);
  }

  update(dt: number) {
    if (!this.enabled) return;
    const k = this.keys;
    const dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const dz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (dx || dz) this.cam.move(dx * dt, dz * dt);
  }

  private tileAt(x: number, y: number): Tile | null {
    if (!this.cam.groundAt(x, y, this.tmp)) return null;
    return { x: worldToTile(this.tmp.x), z: worldToTile(this.tmp.z) };
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.canvas.focus();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size >= 2) {
      if (this.mode === 'tool') this.tool.cancel();
      this.mode = 'gesture';
      this.initGesture();
      return;
    }
    this.down = { x: e.clientX, y: e.clientY, moved: false };
    if (e.pointerType === 'mouse' && e.button === 1) { this.mode = 'rotate'; return; }
    if (e.pointerType === 'mouse' && e.button === 2) { this.mode = 'pan'; return; }

    const t = this.tool.active ? this.tileAt(e.clientX, e.clientY) : null;
    if (t) {
      this.mode = 'tool';
      this.tool.begin(t);
    } else {
      this.mode = 'pan';
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.enabled) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse' && this.mode === 'none') this.tool.hover(this.tileAt(e.clientX, e.clientY));
      return;
    }
    const px = p.x, py = p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - this.down.x, p.y - this.down.y) > TAP_PX) this.down.moved = true;

    switch (this.mode) {
      case 'pan': this.cam.pan(px, py, p.x, p.y); break;
      case 'rotate': this.cam.rotate((p.x - px) * 0.008, false); break;
      case 'tool': {
        const t = this.tileAt(p.x, p.y);
        if (t) this.tool.drag(t);
        break;
      }
      case 'gesture': this.updateGesture(); break;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.mode === 'tool') {
      if (e.type === 'pointercancel') this.tool.cancel();
      else this.tool.commit();
      this.mode = 'none';
    } else if (this.mode === 'gesture') {
      if (this.pointers.size >= 2) this.initGesture();
      // after a pinch, the remaining finger only pans (prevents accidental building)
      else if (this.pointers.size === 1) this.mode = 'pan';
      this.down.moved = true;
    } else if (this.mode === 'pan' && !this.down.moved && e.type === 'pointerup' && (e.pointerType !== 'mouse' || e.button === 0)) {
      const tile = this.tileAt(e.clientX, e.clientY);
      this.actions.tap(tile, tile ? { x: this.tmp.x, z: this.tmp.z } : undefined);
    }
    if (this.pointers.size === 0) this.mode = 'none';
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 0.05 : 0.0015;
    this.cam.zoomAt(Math.exp(e.deltaY * scale), e.clientX, e.clientY);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled || e.target instanceof HTMLInputElement) return;
    if (BLOCKED_KEYS.has(e.key)) e.preventDefault();
    this.keys.add(e.code);

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      this.actions.undo();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyQ') this.cam.rotate(Math.PI / 2);
    else if (e.code === 'KeyE') this.cam.rotate(-Math.PI / 2);
    else if (e.code === 'Space') this.actions.togglePause();
    else if (e.code === 'Enter' && this.tool.hasPending) this.tool.confirm();
    else if (e.code === 'Escape') { if (this.tool.hasPending) this.tool.cancel(); else this.actions.setTool('pan'); }
    else if (TOOL_KEYS[e.code]) this.actions.setTool(TOOL_KEYS[e.code]);
  };

  private gestureState() {
    const [a, b] = [...this.pointers.values()];
    return {
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  private initGesture() {
    this.gesture = this.gestureState();
  }

  private updateGesture() {
    const g = this.gesture, n = this.gestureState();
    let da = n.angle - g.angle;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    this.cam.rotate(da, false);
    if (n.dist > 10 && g.dist > 10) this.cam.zoomAt(g.dist / n.dist, n.mx, n.my);
    this.cam.pan(g.mx, g.my, n.mx, n.my);
    this.gesture = n;
  }
}

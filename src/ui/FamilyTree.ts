import { el, icon } from './dom';
import { t } from '../i18n/i18n';

/** One person on the family tree (alive, or remembered in the town's records). */
export interface TreePerson {
  id: number;
  name: string;
  surname: string;
  sex: 'm' | 'f';
  age: number;
  alive: boolean;
  /** Moved away to another place (not dead). */
  left?: boolean;
  /** "Doctor", "Retired", "† 1998", "moved away"… */
  note: string;
  famous?: string;
}

export interface TreeHost {
  person(id: number): TreePerson | null;
  parents(id: number): number[];
  spouse(id: number): number | null;
  children(id: number): number[];
  show(id: number): void;
}

const NODE_W = 168, NODE_H = 58, GAP = 22, ROW_H = 120, COUPLE = NODE_W * 2 + 26;
/** How many generations above and below the person in the middle are drawn. */
const UP = 3, DOWN = 3;

interface Placed { id: number; x: number; y: number; gen: number }

/**
 * The family tree as a map you can drag and zoom (like the production chain map): great-grandparents at the top,
 * the person in the middle with their brothers, sisters and spouse, and children and grandchildren below.
 * Lines join couples (💍) and run from each couple down to their children. Tap a card for details; any card can
 * become the middle of the tree.
 */
export class FamilyTree {
  private root: HTMLDivElement;
  private stage!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private detail!: HTMLDivElement;
  private focus = -1;
  private picked = -1;
  private pan = { x: 0, y: 0, s: 1 };
  private placed = new Map<number, Placed>();
  private couples: [number, number][] = [];
  private links: { from: number[]; to: number }[] = [];

  constructor(parent: HTMLElement, private host: TreeHost) {
    this.root = el('div', 'chain-view fam-view');
    parent.appendChild(this.root);
  }

  get visible() { return this.root.classList.contains('show'); }

  open(id: number) {
    this.focus = id;
    this.picked = id;
    this.root.classList.add('show');
    this.render(true);
  }

  hide() { this.root.classList.remove('show'); }

  // ---------- layout ----------

  /** Width of a person's block: them (with a spouse) over their children's blocks. */
  private width(id: number, depth: number, seen: Set<number>): number {
    if (seen.has(id)) return 0;
    seen.add(id);
    const own = this.host.spouse(id) !== null ? COUPLE : NODE_W;
    if (depth <= 0) return own;
    const kids = this.host.children(id);
    let sum = 0;
    for (const k of kids) { const w = this.width(k, depth - 1, seen); if (w) sum += (sum ? GAP : 0) + w; }
    return Math.max(own, sum);
  }

  private put(id: number, x: number, gen: number) {
    if (!this.placed.has(id)) this.placed.set(id, { id, x, y: gen * ROW_H, gen });
  }

  /** Lay a person (and spouse) out over their descendants, from x (left edge of the block). */
  private down(id: number, x: number, gen: number, depth: number, seen: Set<number>) {
    if (seen.has(id)) return;
    const w = this.width(id, depth, new Set(seen));
    seen.add(id);
    const sp = this.host.spouse(id);
    const own = sp !== null ? COUPLE : NODE_W;
    const left = x + (w - own) / 2;
    this.put(id, left, gen);
    if (sp !== null) { this.put(sp, left + NODE_W + 26, gen); this.couples.push([id, sp]); seen.add(sp); }
    if (depth <= 0) return;
    const kids = this.host.children(id).filter((k) => !seen.has(k));
    let kw = 0;
    const ws = kids.map((k) => this.width(k, depth - 1, new Set(seen)));
    for (const v of ws) kw += (kw ? GAP : 0) + v;
    let cx = x + (w - kw) / 2;
    kids.forEach((k, i) => { this.down(k, cx, gen + 1, depth - 1, seen); cx += ws[i] + GAP; });
    if (kids.length) for (const k of kids) this.links.push({ from: sp !== null ? [id, sp] : [id], to: k });
  }

  /** Width the ancestors of a person need above them (level 1 = the parents of the person in the middle). */
  private ancW(id: number, level: number): number {
    const ps = level < UP ? this.host.parents(id) : [];
    if (!ps.length) return NODE_W;
    return Math.max(NODE_W, ps.reduce((a, q) => a + this.ancW(q, level + 1), 0) + GAP * (ps.length - 1));
  }

  /** The parents of a person laid out side by side over the strip [left, left + ancW] that belongs to that person. */
  private up(id: number, left: number, gen: number, level: number) {
    const ps = level < UP ? this.host.parents(id) : [];
    if (!ps.length) return;
    const total = ps.reduce((a, q) => a + this.ancW(q, level + 1), 0) + GAP * (ps.length - 1);
    let x = left + (this.ancW(id, level) - total) / 2;
    for (const q of ps) {
      const w = this.ancW(q, level + 1);
      this.put(q, x + (w - NODE_W) / 2, gen - 1);
      this.up(q, x, gen - 1, level + 1);
      x += w + GAP;
    }
    if (ps.length === 2) this.couples.push([ps[0], ps[1]]);
    this.links.push({ from: ps, to: id });
  }

  private layout() {
    this.placed.clear();
    this.couples = [];
    this.links = [];
    const h = this.host;
    const parents = h.parents(this.focus);
    // the person's generation: they and their brothers and sisters (each with spouse and children), oldest first
    const sibs = parents.length ? [...new Set(parents.flatMap((p) => h.children(p)))] : [this.focus];
    if (!sibs.includes(this.focus)) sibs.push(this.focus);
    sibs.sort((a, b) => (h.person(b)?.age ?? 0) - (h.person(a)?.age ?? 0));
    const seen = new Set<number>();
    let x = 0;
    for (const s of sibs) {
      const depth = s === this.focus ? DOWN : 1;
      const w = this.width(s, depth, new Set(seen));
      this.down(s, x, 0, depth, seen);
      x += w + GAP * 2;
    }
    if (parents.length) {
      // the parents centred over all their children
      const kids = sibs.map((s) => this.placed.get(s)!).filter(Boolean);
      const mid = (Math.min(...kids.map((k) => k.x)) + Math.max(...kids.map((k) => k.x)) + NODE_W) / 2;
      if (parents.length === 1) this.put(parents[0], mid - NODE_W / 2, -1);
      else { this.put(parents[0], mid - COUPLE / 2, -1); this.put(parents[1], mid - COUPLE / 2 + NODE_W + 26, -1); this.couples.push([parents[0], parents[1]]); }
      for (const s of sibs) this.links.push({ from: parents, to: s });
      // the father's ancestors to the left of the couple's middle, the mother's to the right
      if (parents.length === 1) { const pp = this.placed.get(parents[0])!; this.up(parents[0], pp.x + NODE_W / 2 - this.ancW(parents[0], 1) / 2, -1, 1); }
      else { this.up(parents[0], mid - GAP / 2 - this.ancW(parents[0], 1), -1, 1); this.up(parents[1], mid + GAP / 2, -1, 1); }
    }
    // shift everything so the top-left card sits at (0, 0)
    const all = [...this.placed.values()];
    const minX = Math.min(...all.map((p) => p.x)), minY = Math.min(...all.map((p) => p.y));
    for (const p of all) { p.x -= minX; p.y -= minY; }
  }

  // ---------- drawing ----------

  private render(center = false) {
    this.layout();
    this.root.replaceChildren();
    const me = this.host.person(this.focus);
    const head = el('div', 'cv-head');
    head.innerHTML = `<div><b></b><small></small></div><div class="cv-legend"><span class="ok">● </span><span class="dead">● </span><span class="left">● </span></div>`;
    (head.querySelector('b') as HTMLElement).textContent = `🌳 ${t('Family tree')}${me ? ` · ${me.name} ${me.surname}` : ''}`;
    (head.querySelector('small') as HTMLElement).textContent = t('Drag to move · scroll or pinch to zoom · tap a card for details, double-tap to put them in the middle');
    const lg = head.querySelectorAll('.cv-legend span');
    lg[0].append(t('alive')); lg[1].append(t('died')); lg[2].append(t('moved away'));
    const tools = el('div', 'cv-tools');
    const mk = (label: string, fn: () => void) => { const b = el('button', 'btn-mini ghost'); b.textContent = label; b.addEventListener('click', fn); tools.appendChild(b); };
    mk('−', () => this.zoom(0.85));
    mk('+', () => this.zoom(1.18));
    mk(t('Centre'), () => this.centre());
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(tools, x);
    const view = el('div', 'cv-view');
    this.stage = el('div', 'cv-stage');
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('cv-edges', 'fam-edges');
    const all = [...this.placed.values()];
    this.svg.setAttribute('width', `${Math.max(...all.map((p) => p.x)) + NODE_W + 40}`);
    this.svg.setAttribute('height', `${Math.max(...all.map((p) => p.y)) + NODE_H + 40}`);
    this.stage.appendChild(this.svg);
    for (const p of all) this.stage.appendChild(this.card(p));
    // generation labels on the left
    const gens = [...new Set(all.map((p) => p.gen))].sort((a, b) => a - b);
    for (const g of gens) {
      const lab = el('div', 'fam-gen');
      lab.textContent = this.genName(g);
      lab.style.top = `${all.find((p) => p.gen === g)!.y + NODE_H / 2 - 9}px`;
      this.stage.appendChild(lab);
    }
    view.appendChild(this.stage);
    this.detail = el('div', 'cv-detail');
    this.root.append(head, view, this.detail);
    this.wireView(view);
    this.edges();
    this.showDetail();
    if (center) requestAnimationFrame(() => this.centre(view));
    else this.apply();
  }

  private genName(g: number) {
    const fp = this.placed.get(this.focus);
    const rel = fp ? g - fp.gen : g;
    return rel === -3 ? t('Great-grandparents') : rel === -2 ? t('Grandparents') : rel === -1 ? t('Parents') : rel === 0 ? t('Brothers and sisters') : rel === 1 ? t('Children') : rel === 2 ? t('Grandchildren') : t('Great-grandchildren');
  }

  /** The person in the middle is brought to the centre of the screen. */
  private centre(view = this.root.querySelector('.cv-view') as HTMLElement | null) {
    const p = this.placed.get(this.focus);
    if (!p || !view) return;
    const r = view.getBoundingClientRect();
    this.pan.s = r.width < 600 ? 0.75 : 1;
    this.pan.x = r.width / 2 - (p.x + NODE_W / 2) * this.pan.s;
    this.pan.y = r.height / 2 - (p.y + NODE_H / 2) * this.pan.s;
    this.apply();
  }

  private zoom(f: number, cx?: number, cy?: number) {
    const s = Math.max(0.3, Math.min(1.8, this.pan.s * f));
    const k = s / this.pan.s;
    const ox = cx ?? 300, oy = cy ?? 200;
    this.pan.x = ox - (ox - this.pan.x) * k;
    this.pan.y = oy - (oy - this.pan.y) * k;
    this.pan.s = s;
    this.apply();
  }

  private apply() { this.stage.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.pan.s})`; }

  /** Dragging pans the map; the wheel and two fingers zoom. */
  private wireView(view: HTMLElement) {
    let drag: { x: number; y: number; px: number; py: number } | null = null;
    const touches = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    view.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.cv-node')) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y };
      view.setPointerCapture(e.pointerId);
    });
    view.addEventListener('pointermove', (e) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = view.getBoundingClientRect();
        this.zoom(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = d;
        return;
      }
      if (!drag) return;
      this.pan.x = drag.px + e.clientX - drag.x;
      this.pan.y = drag.py + e.clientY - drag.y;
      this.apply();
    });
    const up = (e: PointerEvent) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; drag = null; };
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect();
      this.zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }

  private face(p: TreePerson) {
    return p.age < 13 ? (p.sex === 'm' ? '👦' : '👧') : p.age >= 65 ? (p.sex === 'm' ? '👴' : '👵') : p.sex === 'm' ? '👨' : '👩';
  }

  private card(pl: Placed) {
    const p = this.host.person(pl.id);
    const state = !p ? 'none' : p.alive ? 'ok' : p.left ? 'left' : 'dead';
    const c = el('div', `cv-node fam-node ${state}${p?.sex === 'f' ? ' f' : ''}${pl.id === this.focus ? ' me' : ''}${pl.id === this.picked ? ' picked' : ''}`);
    c.style.left = `${pl.x}px`;
    c.style.top = `${pl.y}px`;
    c.innerHTML = '<span class="cv-emoji"></span><div><b></b><small></small></div><i class="cv-badge"></i>';
    if (p) {
      (c.querySelector('.cv-emoji') as HTMLElement).textContent = this.face(p);
      (c.querySelector('b') as HTMLElement).textContent = `${p.name} ${p.surname}`;
      (c.querySelector('small') as HTMLElement).textContent = p.alive ? `${t('{n} years', { n: p.age })}${p.note ? ` · ${p.note}` : ''}` : p.note;
      (c.querySelector('.cv-badge') as HTMLElement).textContent = p.famous ? '⭐' : pl.id === this.focus ? '●' : '';
    }
    let last = 0;
    c.addEventListener('click', () => {
      const now = performance.now();
      if (now - last < 350 && pl.id !== this.focus) { this.focus = pl.id; this.picked = pl.id; this.render(true); return; }
      last = now;
      this.picked = pl.id;
      this.stage.querySelectorAll('.fam-node.picked').forEach((n) => n.classList.remove('picked'));
      c.classList.add('picked');
      this.edges();
      this.showDetail();
    });
    return c;
  }

  /** Couples joined side by side (with a ring), and an elbow line from each couple down to every child. */
  private edges() {
    const P = (id: number) => this.placed.get(id);
    const out: string[] = [];
    const hot = (ids: number[]) => ids.includes(this.picked);
    for (const [a, b] of this.couples) {
      const pa = P(a), pb = P(b);
      if (!pa || !pb || pa.y !== pb.y) continue;
      const [l, r] = pa.x < pb.x ? [pa, pb] : [pb, pa];
      const y = l.y + NODE_H / 2;
      out.push(`<path d="M${l.x + NODE_W},${y} L${r.x},${y}" class="couple${hot([a, b]) ? ' hot' : ''}"/>`);
      out.push(`<text x="${(l.x + NODE_W + r.x) / 2}" y="${y + 5}" text-anchor="middle" class="ring">💍</text>`);
    }
    for (const { from, to } of this.links) {
      const ps = from.map(P).filter((p): p is Placed => !!p);
      const c = P(to);
      if (!ps.length || !c) continue;
      const top = ps[0];
      const sx = ps.length === 2 ? (Math.min(ps[0].x, ps[1].x) + NODE_W + Math.max(ps[0].x, ps[1].x)) / 2 : top.x + NODE_W / 2;
      const sy = ps.length === 2 ? top.y + NODE_H / 2 + 6 : top.y + NODE_H;
      const ex = c.x + NODE_W / 2, ey = c.y;
      const my = ey - 22;
      const person = this.host.person(to);
      out.push(`<path d="M${sx},${sy} L${sx},${my} L${ex},${my} L${ex},${ey}" class="${person?.alive ? 'live' : 'dead'}${hot([...from, to]) ? ' hot' : ''}"/>`);
    }
    this.svg.innerHTML = out.join('');
  }

  private showDetail() {
    const h = this.host;
    const p = h.person(this.picked);
    this.detail.classList.toggle('show', !!p);
    if (!p) return;
    this.detail.replaceChildren();
    const head = el('div', 'cv-d-head');
    head.innerHTML = '<span></span><div><b></b><small></small></div>';
    (head.querySelector('span') as HTMLElement).textContent = this.face(p);
    (head.querySelector('b') as HTMLElement).textContent = `${p.name} ${p.surname}${p.famous ? ` · ⭐ ${p.famous}` : ''}`;
    (head.querySelector('small') as HTMLElement).textContent = p.alive ? `${t('{n} years', { n: p.age })}${p.note ? ` · ${p.note}` : ''}` : p.note;
    this.detail.appendChild(head);
    const stats = el('div', 'cv-d-stats');
    const kids = h.children(p.id), grand = kids.flatMap((k) => h.children(k));
    const sibs = [...new Set(h.parents(p.id).flatMap((x) => h.children(x)))].filter((x) => x !== p.id);
    for (const [label, n] of [[t('Children'), kids.length], [t('Grandchildren'), grand.length], [t('Brothers and sisters'), sibs.length]] as [string, number][]) {
      const d = el('div', '');
      d.innerHTML = '<small></small><b></b>';
      (d.querySelector('small') as HTMLElement).textContent = label;
      (d.querySelector('b') as HTMLElement).textContent = `${n}`;
      stats.appendChild(d);
    }
    this.detail.appendChild(stats);
    const list = (title: string, ids: number[]) => {
      if (!ids.length) return;
      const d = el('div', 'cv-d-list');
      const tt = el('small', '');
      tt.textContent = title;
      d.appendChild(tt);
      for (const id of ids) {
        const q = h.person(id);
        if (!q) continue;
        const b = el('button', `cv-chip ${q.alive ? 'ok' : 'none'}`);
        b.textContent = `${this.face(q)} ${q.name}`;
        b.addEventListener('click', () => { this.picked = id; if (!this.placed.has(id)) this.focus = id; this.render(!this.placed.has(id)); });
        d.appendChild(b);
      }
      this.detail.appendChild(d);
    };
    const sp = h.spouse(p.id);
    list(t('Parents'), h.parents(p.id));
    if (sp !== null) list(t('Spouse'), [sp]);
    list(t('Children'), kids);
    const acts = el('div', 'fam-acts');
    if (p.id !== this.focus) {
      const b = el('button', 'btn-mini');
      b.textContent = t('Put in the middle');
      b.addEventListener('click', () => { this.focus = p.id; this.render(true); });
      acts.appendChild(b);
    }
    if (p.alive) {
      const b = el('button', 'btn-mini ghost');
      b.textContent = t('Show on the map');
      b.addEventListener('click', () => { this.hide(); h.show(p.id); });
      acts.appendChild(b);
    }
    this.detail.appendChild(acts);
  }
}

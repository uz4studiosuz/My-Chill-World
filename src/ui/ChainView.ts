import { el, icon } from './dom';
import { t } from '../i18n/i18n';

/** One link of the production chains as the game sees it now. */
export interface ChainNodeState {
  /** Buildings of this kind in the town, and how many have workers. */
  count?: number;
  working?: number;
  /** For a good: in the stores now, and made / used yesterday. */
  stock?: number;
  made?: number;
  used?: number;
}

interface Node {
  id: string;
  /** A building kind or a good (resource). */
  type: 'building' | 'good';
  label: string;
  emoji: string;
  col: number;
  row: number;
  /** What it is for (shown in the detail panel). */
  info: string;
}

/** The whole tree: raw land → raw goods → workshops → products → shops and homes. */
const NODES: Node[] = [
  // the land
  { id: 'farm', type: 'building', label: 'Crop Farm', emoji: '🌾', col: 0, row: 0, info: 'Sow wheat, corn, cotton, vegetables or melons. Needs water from a canal or a river.' },
  { id: 'ranch', type: 'building', label: 'Cattle Ranch', emoji: '🐄', col: 0, row: 3, info: 'Cows give meat (food) and milk. Corn feed makes them give 30% more. Upgrade for more cows.' },
  { id: 'orchard', type: 'building', label: 'Fruit Orchard', emoji: '🍎', col: 0, row: 5, info: 'Fruit in summer and autumn, straight to the stores as food.' },
  { id: 'fishery', type: 'building', label: 'Fishery', emoji: '🐟', col: 0, row: 6, info: 'Fish from the water, less in winter.' },
  { id: 'woodcutter', type: 'building', label: 'Woodcutter', emoji: '🪓', col: 0, row: 8, info: 'Fells trees nearby (they grow back). Moves on when the forest is gone.' },
  { id: 'quarry', type: 'building', label: 'Quarry', emoji: '⛏️', col: 0, row: 10, info: 'Breaks stone from a mountain beside it; the rock shrinks as it is dug.' },
  { id: 'ironmine', type: 'building', label: 'Iron Mine', emoji: '⚒️', col: 0, row: 11, info: 'Iron ore from a mountain.' },
  { id: 'coalmine', type: 'building', label: 'Coal Mine', emoji: '🪨', col: 0, row: 12, info: 'Coal from a mountain, for the coal power plant.' },
  // raw goods
  { id: 'grain', type: 'good', label: 'Grain', emoji: '🌾', col: 1, row: 0, info: 'Wheat from the fields. The mill grinds it.' },
  { id: 'feed', type: 'good', label: 'Corn feed', emoji: '🌽', col: 1, row: 1, info: 'Corn for the cattle: +30% milk and meat.' },
  { id: 'cotton', type: 'good', label: 'Cotton', emoji: '☁️', col: 1, row: 2, info: 'For the factory (clothes) or sold raw in clothing stores.' },
  { id: 'milk', type: 'good', label: 'Milk', emoji: '🥛', col: 1, row: 3, info: 'From the ranches: the dairy makes cheese, the dairy shop sells it to families.' },
  { id: 'wood', type: 'good', label: 'Wood', emoji: '🪵', col: 1, row: 8, info: 'Building material, fuel for the wood power plant and logs for the sawmill.' },
  { id: 'stone', type: 'good', label: 'Stone', emoji: '🧱', col: 1, row: 10, info: 'Building material and clay for the brickworks.' },
  { id: 'iron', type: 'good', label: 'Iron', emoji: '🔩', col: 1, row: 11, info: 'For big buildings, the car factory and the steel mill.' },
  { id: 'coal', type: 'good', label: 'Coal', emoji: '⚫', col: 1, row: 12, info: 'Fuel for the coal power plant.' },
  // workshops
  { id: 'mill', type: 'building', label: 'Flour Mill', emoji: '🏭', col: 2, row: 0, info: 'Grinds grain into flour.' },
  { id: 'dairy', type: 'building', label: 'Dairy', emoji: '🧀', col: 2, row: 3, info: 'Milk into cheese and ice cream (food for the shops).' },
  { id: 'dairyshop', type: 'building', label: 'Dairy Shop', emoji: '🥛', col: 2, row: 4, info: 'Sells milk, yogurt and cheese to families: they eat it as food.' },
  { id: 'factory', type: 'building', label: 'Factory', emoji: '🏭', col: 2, row: 2, info: 'Cotton into clothes, planks into furniture.' },
  { id: 'sawmill', type: 'building', label: 'Sawmill', emoji: '🪚', col: 2, row: 8, info: 'Logs into planks: building sites with planks go 40% faster.' },
  { id: 'powerplant', type: 'building', label: 'Wood Power Plant', emoji: '⚡', col: 2, row: 9, info: 'Burns wood for electricity.' },
  { id: 'brickworks', type: 'building', label: 'Brickworks', emoji: '🧱', col: 2, row: 10, info: 'Stone into bricks: every home is built of bricks.' },
  { id: 'steelmill', type: 'building', label: 'Steel Mill', emoji: '🔥', col: 2, row: 11, info: 'Iron into steel beams (faster big buildings).' },
  { id: 'carfactory', type: 'building', label: 'Car Factory', emoji: '🚗', col: 2, row: 12, info: 'Iron into cars for the car market.' },
  { id: 'coalplant', type: 'building', label: 'Coal Power Plant', emoji: '🏭', col: 2, row: 13, info: 'Burns coal for a lot of electricity (and smoke).' },
  // products
  { id: 'flour', type: 'good', label: 'Flour', emoji: '🥡', col: 3, row: 0, info: 'For the bakery.' },
  { id: 'garments', type: 'good', label: 'Clothes', emoji: '👕', col: 3, row: 2, info: 'Sold in the clothing stores (80% dearer than cloth).' },
  { id: 'food', type: 'good', label: 'Food', emoji: '🍞', col: 3, row: 4, info: 'Everyone eats one portion a day. Bought in grocery stores, markets and supermarkets.' },
  { id: 'planks', type: 'good', label: 'Planks', emoji: '🪵', col: 3, row: 7, info: 'Faster building sites; furniture at the factory.' },
  { id: 'furniture', type: 'good', label: 'Furniture', emoji: '🛋️', col: 3, row: 6, info: 'Sold in the markets and the supermarket.' },
  { id: 'power', type: 'good', label: 'Electricity', emoji: '💡', col: 3, row: 9, info: 'Through the power cables to every building and street lamp.' },
  { id: 'bricks', type: 'good', label: 'Bricks', emoji: '🧱', col: 3, row: 10, info: 'Every new home needs them.' },
  { id: 'steel', type: 'good', label: 'Steel', emoji: '🔩', col: 3, row: 11, info: 'Beams for big buildings: they go up faster.' },
  { id: 'cars', type: 'good', label: 'Cars', emoji: '🚙', col: 3, row: 12, info: 'Families buy them at the car market.' },
  // second workshop and the shops
  { id: 'bakery', type: 'building', label: 'Bakery', emoji: '🥖', col: 4, row: 0, info: 'Flour into bread (food).' },
  { id: 'grocery', type: 'building', label: 'Grocery Store', emoji: '🛒', col: 5, row: 3, info: 'Families buy food here.' },
  { id: 'supermarket', type: 'building', label: 'Supermarket', emoji: '🏬', col: 5, row: 4, info: 'Food and furniture for families.' },
  { id: 'market', type: 'building', label: 'Market', emoji: '🧺', col: 5, row: 5, info: 'Food and furniture.' },
  { id: 'clothes', type: 'building', label: 'Clothing Store', emoji: '👗', col: 5, row: 2, info: 'Clothes for families.' },
  { id: 'construction', type: 'building', label: 'Construction Company', emoji: '🏗️', col: 5, row: 8, info: 'The builders: every building, road, pipe and cable is laid by them.' },
  { id: 'house', type: 'building', label: 'House', emoji: '🏠', col: 5, row: 10, info: 'Homes for the families: bricks, stone and wood.' },
  { id: 'carmarket', type: 'building', label: 'Car Market', emoji: '🚘', col: 5, row: 12, info: 'Sells cars to the families.' },
  { id: 'homes', type: 'good', label: 'Families', emoji: '👪', col: 6, row: 5, info: 'Everything ends here: people eat, dress, furnish their homes and drive.' },
];

/** Who feeds whom. */
const EDGES: [string, string][] = [
  ['farm', 'grain'], ['farm', 'feed'], ['farm', 'cotton'], ['farm', 'food'], ['ranch', 'milk'], ['ranch', 'food'], ['feed', 'ranch'], ['orchard', 'food'], ['fishery', 'food'],
  ['woodcutter', 'wood'], ['quarry', 'stone'], ['ironmine', 'iron'], ['coalmine', 'coal'],
  ['grain', 'mill'], ['mill', 'flour'], ['flour', 'bakery'], ['bakery', 'food'],
  ['milk', 'dairy'], ['dairy', 'food'], ['milk', 'dairyshop'], ['dairyshop', 'homes'],
  ['cotton', 'factory'], ['factory', 'garments'], ['cotton', 'clothes'], ['garments', 'clothes'], ['clothes', 'homes'],
  ['wood', 'sawmill'], ['sawmill', 'planks'], ['planks', 'factory'], ['factory', 'furniture'], ['furniture', 'market'], ['furniture', 'supermarket'], ['planks', 'construction'],
  ['wood', 'powerplant'], ['powerplant', 'power'], ['coal', 'coalplant'], ['coalplant', 'power'], ['power', 'homes'],
  ['stone', 'brickworks'], ['brickworks', 'bricks'], ['bricks', 'house'], ['stone', 'house'], ['wood', 'house'], ['construction', 'house'],
  ['iron', 'steelmill'], ['steelmill', 'steel'], ['steel', 'construction'], ['iron', 'carfactory'], ['carfactory', 'cars'], ['cars', 'carmarket'], ['carmarket', 'homes'],
  ['food', 'grocery'], ['food', 'supermarket'], ['food', 'market'], ['grocery', 'homes'], ['supermarket', 'homes'], ['market', 'homes'], ['house', 'homes'],
];

const COL_W = 210, ROW_H = 74, NODE_W = 168, NODE_H = 58;

/**
 * The chain map: every production chain as a tree you can drag around (like a skill tree). Green links work,
 * amber ones stand without workers, grey ones are missing. Tap a node for what it needs and gives.
 */
export class ChainView {
  private root: HTMLDivElement;
  private stage!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private detail!: HTMLDivElement;
  visible = false;
  private pan = { x: 40, y: 30, s: 1 };
  /** Nodes the player dragged somewhere else (kept while the game runs). */
  private moved = new Map<string, { x: number; y: number }>();
  private picked: string | null = null;
  private timer = 0;

  constructor(parent: HTMLElement, private state: () => Record<string, ChainNodeState>, private build: (kind: string) => void) {
    this.root = el('div', 'chain-view');
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else this.open(); }

  open(focus?: string) {
    this.visible = true;
    this.root.classList.add('show');
    if (focus) this.picked = focus;
    this.render();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => { if (this.visible) this.refresh(); }, 1500);
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
    clearInterval(this.timer);
  }

  private pos(n: Node) { return this.moved.get(n.id) ?? { x: n.col * COL_W, y: n.row * ROW_H }; }

  private render() {
    this.root.replaceChildren();
    const head = el('div', 'cv-head');
    head.innerHTML = `<div><b></b><small></small></div><div class="cv-legend"><span class="ok">● </span><span class="idle">● </span><span class="none">● </span></div>`;
    (head.querySelector('b') as HTMLElement).textContent = t('Production chains');
    (head.querySelector('small') as HTMLElement).textContent = t('Drag to move the map or a card · scroll or pinch to zoom · tap a card for details');
    const lg = head.querySelectorAll('.cv-legend span');
    lg[0].append(t('working')); lg[1].append(t('no workers')); lg[2].append(t('missing'));
    const tools = el('div', 'cv-tools');
    const mk = (label: string, fn: () => void) => { const b = el('button', 'btn-mini ghost'); b.textContent = label; b.addEventListener('click', fn); tools.appendChild(b); };
    mk('−', () => this.zoom(0.85));
    mk('+', () => this.zoom(1.18));
    mk(t('Reset'), () => { this.moved.clear(); this.pan = { x: 40, y: 30, s: 1 }; this.render(); });
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(tools, x);
    const view = el('div', 'cv-view');
    this.stage = el('div', 'cv-stage');
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('cv-edges');
    this.svg.setAttribute('width', `${COL_W * 7 + 40}`);
    this.svg.setAttribute('height', `${ROW_H * 14 + 40}`);
    this.stage.appendChild(this.svg);
    for (const n of NODES) this.stage.appendChild(this.card(n));
    view.appendChild(this.stage);
    this.detail = el('div', 'cv-detail');
    this.root.append(head, view, this.detail);
    this.wireView(view);
    this.apply();
    this.refresh();
  }

  private zoom(f: number, cx?: number, cy?: number) {
    const s = Math.max(0.4, Math.min(1.8, this.pan.s * f));
    const k = s / this.pan.s;
    const ox = cx ?? 300, oy = cy ?? 200;
    this.pan.x = ox - (ox - this.pan.x) * k;
    this.pan.y = oy - (oy - this.pan.y) * k;
    this.pan.s = s;
    this.apply();
  }

  private apply() { this.stage.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.pan.s})`; }

  /** Dragging the empty map pans it; the wheel and two fingers zoom. */
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

  /** A card on the map: drag it to move it, tap it for its details. */
  private card(n: Node) {
    const c = el('div', `cv-node ${n.type}`);
    c.dataset.id = n.id;
    c.innerHTML = `<span class="cv-emoji"></span><div><b></b><small></small></div><i class="cv-badge"></i>`;
    (c.querySelector('.cv-emoji') as HTMLElement).textContent = n.emoji;
    (c.querySelector('b') as HTMLElement).textContent = t(n.label);
    const p = this.pos(n);
    c.style.left = `${p.x}px`;
    c.style.top = `${p.y}px`;
    let start: { x: number; y: number; nx: number; ny: number; moved: boolean } | null = null;
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const q = this.pos(n);
      start = { x: e.clientX, y: e.clientY, nx: q.x, ny: q.y, moved: false };
      c.setPointerCapture(e.pointerId);
      c.classList.add('drag');
    });
    c.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = (e.clientX - start.x) / this.pan.s, dy = (e.clientY - start.y) / this.pan.s;
      if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
      if (!start.moved) return;
      const q = { x: start.nx + dx, y: start.ny + dy };
      this.moved.set(n.id, q);
      c.style.left = `${q.x}px`;
      c.style.top = `${q.y}px`;
      this.edges();
    });
    const end = () => {
      c.classList.remove('drag');
      if (start && !start.moved) { this.picked = this.picked === n.id ? null : n.id; this.refresh(); }
      start = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { c.classList.remove('drag'); start = null; });
    return c;
  }

  private status(n: Node, st: Record<string, ChainNodeState>): 'ok' | 'idle' | 'none' {
    const s = st[n.id];
    if (!s) return 'none';
    if (n.type === 'building') return !s.count ? 'none' : s.working ? 'ok' : 'idle';
    return (s.made ?? 0) > 0.5 || (s.stock ?? 0) >= 1 ? ((s.made ?? 0) > 0.5 ? 'ok' : 'idle') : 'none';
  }

  /** Colours, numbers and links from the town as it is now. */
  private refresh() {
    if (!this.visible) return;
    const st = this.state();
    const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
    for (const n of NODES) {
      const c = this.stage.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null;
      if (!c) continue;
      const s = st[n.id] ?? {};
      const status = this.status(n, st);
      c.classList.remove('ok', 'idle', 'none');
      c.classList.add(status);
      c.classList.toggle('picked', this.picked === n.id);
      const sub = c.querySelector('small') as HTMLElement;
      const badge = c.querySelector('.cv-badge') as HTMLElement;
      if (n.type === 'building') {
        sub.textContent = s.count ? t('{a}/{b} working', { a: s.working ?? 0, b: s.count }) : t('not built');
        badge.textContent = s.count ? `×${s.count}` : '';
      } else {
        sub.textContent = s.stock !== undefined ? `${n0(s.stock)} · +${n0(s.made ?? 0)} / −${n0(s.used ?? 0)}` : s.made ? `+${n0(s.made)}` : '—';
        badge.textContent = '';
      }
    }
    this.edges(st);
    this.showDetail(st);
  }

  private edges(st = this.state()) {
    const byId = new Map(NODES.map((n) => [n.id, n]));
    const paths: string[] = [];
    for (const [a, b] of EDGES) {
      const na = byId.get(a), nb = byId.get(b);
      if (!na || !nb) continue;
      const pa = this.pos(na), pb = this.pos(nb);
      const x1 = pa.x + NODE_W, y1 = pa.y + NODE_H / 2, x2 = pb.x, y2 = pb.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      const live = this.status(na, st) === 'ok' && this.status(nb, st) !== 'none';
      const hot = this.picked === a || this.picked === b;
      paths.push(`<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" class="${live ? 'live' : 'dead'}${hot ? ' hot' : ''}" marker-end="url(#cv-arrow${live ? '' : '-d'})"/>`);
    }
    this.svg.innerHTML = `<defs><marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7be08f"/></marker>
      <marker id="cv-arrow-d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#59616b"/></marker></defs>${paths.join('')}`;
  }

  private showDetail(st: Record<string, ChainNodeState>) {
    const n = NODES.find((x) => x.id === this.picked);
    this.detail.classList.toggle('show', !!n);
    if (!n) return;
    const s = st[n.id] ?? {};
    const from = EDGES.filter(([, b]) => b === n.id).map(([a]) => NODES.find((x) => x.id === a)!).filter(Boolean);
    const to = EDGES.filter(([a]) => a === n.id).map(([, b]) => NODES.find((x) => x.id === b)!).filter(Boolean);
    const key = `${n.id}|${JSON.stringify(s)}`;
    if (this.detail.dataset.key === key) return;
    this.detail.dataset.key = key;
    this.detail.replaceChildren();
    const h = el('div', 'cv-d-head');
    h.innerHTML = '<span></span><div><b></b><small></small></div>';
    (h.querySelector('span') as HTMLElement).textContent = n.emoji;
    (h.querySelector('b') as HTMLElement).textContent = t(n.label);
    const status = this.status(n, st);
    (h.querySelector('small') as HTMLElement).textContent = status === 'ok' ? t('working') : status === 'idle' ? (n.type === 'building' ? t('no workers') : t('in stock, nothing made')) : n.type === 'building' ? t('not built') : t('missing');
    const p = el('p', '');
    p.textContent = t(n.info);
    const list = (title: string, items: Node[]) => {
      if (!items.length) return;
      const d = el('div', 'cv-d-list');
      const tt = el('small', '');
      tt.textContent = title;
      d.appendChild(tt);
      for (const it of items) {
        const b = el('button', `cv-chip ${this.status(it, st)}`);
        b.textContent = `${it.emoji} ${t(it.label)}`;
        b.addEventListener('click', () => { this.picked = it.id; this.refresh(); });
        d.appendChild(b);
      }
      this.detail.appendChild(d);
    };
    this.detail.append(h, p);
    if (n.type === 'building') {
      const r = el('div', 'cv-d-stats');
      r.innerHTML = `<div><small></small><b>${s.count ?? 0}</b></div><div><small></small><b>${s.working ?? 0}</b></div>`;
      const sm = r.querySelectorAll('small');
      sm[0].textContent = t('Built');
      sm[1].textContent = t('Working');
      this.detail.appendChild(r);
    } else if (s.stock !== undefined) {
      const r = el('div', 'cv-d-stats');
      r.innerHTML = `<div><small></small><b>${Math.round(s.stock)}</b></div><div><small></small><b>+${Math.round(s.made ?? 0)}</b></div><div><small></small><b>−${Math.round(s.used ?? 0)}</b></div>`;
      const sm = r.querySelectorAll('small');
      sm[0].textContent = t('In stock');
      sm[1].textContent = t('Made yesterday');
      sm[2].textContent = t('Used yesterday');
      this.detail.appendChild(r);
    }
    list(t('Needs'), from);
    list(t('Gives to'), to);
    if (n.type === 'building' && n.id !== 'house') {
      const b = el('button', 'btn-mini');
      b.textContent = t('Build one');
      b.addEventListener('click', () => { this.hide(); this.build(n.id); });
      this.detail.appendChild(b);
    }
  }
}

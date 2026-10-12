import { ToolId } from '../build/BuildTool';
import { IS_TOUCH } from '../config';
import { BUILDINGS, BuildingKind } from '../buildings/BuildingTypes';
import { BRIDGE_COST, ROAD_COST, ROUNDABOUT_COST } from '../roads/RoadNetwork';
import { el, icon, IconName } from './dom';

type Category = 'roads' | 'buildings' | 'production';

interface ToolItem {
  tool: ToolId;
  cat: Category;
  name: string;
  desc: string;
  money: number;
  stone: number;
  perTile?: boolean;
  tag: string;
  icon: IconName;
}

const b = (tool: BuildingKind & ToolId, cat: Category, tag: string, desc: string, ic: IconName): ToolItem =>
  ({ tool, cat, name: BUILDINGS[tool].name, desc, money: BUILDINGS[tool].money, stone: BUILDINGS[tool].stone, tag, icon: ic });

const ITEMS: ToolItem[] = [
  { tool: 'road', cat: 'roads', name: 'Road', desc: `Two-lane road with sidewalks. Over water it becomes a bridge ($${BRIDGE_COST.money} + ${BRIDGE_COST.stone} stone per tile).`, ...ROAD_COST[2], perTile: true, tag: 'Cars & trucks', icon: 'road' },
  { tool: 'roundabout', cat: 'roads', name: 'Roundabout', desc: 'Place it on a junction — roads connect to the middle of each side. No traffic lights needed.', ...ROUNDABOUT_COST, tag: '3×3 · smooth flow', icon: 'roundabout' },
  { tool: 'path', cat: 'roads', name: 'Footpath', desc: 'Free walking path. People walk faster on paths than across grass.', money: 0, stone: 0, perTile: true, tag: 'Free · pedestrians', icon: 'path' },
  b('house', 'buildings', 'One family', 'Home for one family (up to 10 people). Needs a road.', 'house'),
  b('school', 'buildings', '40 pupils · 4 jobs', 'Children aged 6–17 study here. Educated adults earn 50% more.', 'school'),
  b('office', 'buildings', '24 jobs · good pay', 'Workplace with parking spaces in front.', 'office'),
  b('parking', 'buildings', '8 spaces', 'Commuters park here when their workplace is nearby.', 'parking'),
  b('woodcutter', 'production', '3 jobs · wood', 'Must be near a forest. Workers fell trees and carry logs to the power plant. Trees grow back.', 'woodcutter'),
  b('powerplant', 'production', `+${BUILDINGS.powerplant.power} energy/day`, 'Burns wood to power the town. Without energy, workplaces slow down and nobody moves in.', 'powerplant'),
  b('farm', 'production', `+${BUILDINGS.farm.food} food/day`, 'Crop field (3×3). Farmers work the land; crops ripen from green to gold.', 'farm'),
  b('orchard', 'production', `+${BUILDINGS.orchard.food} food/day`, 'Fruit trees. Small and cheap.', 'orchard'),
  b('ranch', 'production', `+${BUILDINGS.ranch.food} food/day`, 'Fenced pasture with cattle (3×3).', 'ranch'),
  b('quarry', 'production', '8 jobs · stone', 'Must touch mountains. Trucks bring stone to the Town Hall.', 'quarry'),
];

const CATS: { id: Category; label: string; icon: IconName }[] = [
  { id: 'roads', label: 'Roads', icon: 'roads' },
  { id: 'buildings', label: 'Town', icon: 'buildings' },
  { id: 'production', label: 'Production', icon: 'production' },
];

const BASE_HINTS: Partial<Record<ToolId, string>> = {
  pan: IS_TOUCH ? 'Drag to move · Pinch to zoom · Tap a house to meet the family' : 'Drag to move · Scroll to zoom · Q/E rotate · Click a house to meet the family',
  bulldoze: 'Drag over roads, paths and buildings to remove them (50% refund for buildings)',
};

export interface HudStats {
  money: number; daily: number; stone: number; wood: number; food: number; foodDaily: number;
  powered: number; population: number; workers: number; workforce: number;
  day: number; timeOfDay: number;
}

export interface HudHandlers {
  setTool: (t: ToolId) => void;
  undo: () => void;
  rotate: (dir: number) => void;
  setSpeed: (s: number) => void;
  openMenu: () => void;
  openStats: () => void;
}

export interface InfoPerson { icon: string; name: string; detail: string }

export class Hud {
  readonly root: HTMLDivElement;
  private tool: ToolId = 'pan';
  private speedBtns: HTMLButtonElement[] = [];
  private undoBtn: HTMLButtonElement;
  private moveBtn: HTMLButtonElement;
  private removeBtn: HTMLButtonElement;
  private catBtns = new Map<Category, HTMLButtonElement>();
  private cards = new Map<ToolId, HTMLButtonElement>();
  private drawer: HTMLDivElement;
  private drawerCat: Category | null = null;
  private hint: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private info: HTMLDivElement;
  private stat: Record<string, HTMLSpanElement> = {};
  private chip: Record<string, HTMLButtonElement> = {};
  private dayBar = el('div', 'daybar');
  private toastTimer = 0;
  private lastMoney = 0;
  private lastStone = 0;

  constructor(parent: HTMLElement, private h: HudHandlers, private thumbs: Map<string, string>) {
    this.root = el('div', 'hud');

    const top = el('div', 'topbar');
    top.append(this.iconButton('menu', 'Menu', h.openMenu), this.iconButton('stats', 'Statistics', h.openStats));
    const chips = el('div', 'chips');
    for (const [key, ic, title] of [
      ['money', 'coin', 'Town money (balance per day)'],
      ['stone', 'stone', 'Stone'],
      ['wood', 'wood', 'Wood (fuel for the power plant)'],
      ['food', 'food', 'Food (everyone eats 1 per day)'],
      ['energy', 'energy', 'Energy supplied'],
      ['pop', 'people', 'Population'],
      ['jobs', 'jobs', 'Employed / workforce'],
      ['day', 'calendar', 'Day and time'],
    ] as const) {
      const chip = el('button', 'chip');
      chip.title = title;
      chip.innerHTML = icon(ic);
      chip.addEventListener('click', h.openStats);
      const v = el('span', 'v');
      chip.appendChild(v);
      this.stat[key] = v;
      this.chip[key] = chip;
      if (key === 'day') chip.appendChild(this.dayBar);
      chips.appendChild(chip);
    }
    top.appendChild(chips);

    const corner = el('div', 'corner');
    const speeds = el('div', 'speeds');
    [0, 1, 2, 3].forEach((s) => {
      const btn = el('button', 'sbtn');
      btn.innerHTML = s === 0 ? icon('pause') : `${s}×`;
      btn.setAttribute('aria-label', s === 0 ? 'Pause' : `Speed ${s}`);
      btn.addEventListener('click', () => h.setSpeed(s));
      this.speedBtns.push(btn);
      speeds.appendChild(btn);
    });
    const rot = el('div', 'speeds');
    for (const dir of [1, -1]) {
      const btn = el('button', 'sbtn');
      btn.innerHTML = icon(dir > 0 ? 'rotL' : 'rotR');
      btn.setAttribute('aria-label', dir > 0 ? 'Rotate left' : 'Rotate right');
      btn.addEventListener('click', () => h.rotate(dir));
      rot.appendChild(btn);
    }
    corner.append(speeds, rot);

    this.drawer = el('div', 'drawer');

    const bar = el('div', 'toolbar');
    this.moveBtn = this.toolButton('pan', 'Move');
    this.moveBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('pan'); });
    bar.append(this.moveBtn, el('div', 'sep'));
    for (const c of CATS) {
      const btn = this.toolButton(c.icon, c.label);
      btn.classList.add('cat');
      btn.addEventListener('click', () => this.toggleDrawer(c.id));
      this.catBtns.set(c.id, btn);
      bar.appendChild(btn);
    }
    bar.appendChild(el('div', 'sep'));
    this.removeBtn = this.toolButton('bulldoze', 'Remove');
    this.removeBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('bulldoze'); });
    this.undoBtn = this.toolButton('undo', 'Undo');
    this.undoBtn.addEventListener('click', h.undo);
    bar.append(this.removeBtn, this.undoBtn);

    this.hint = el('div', 'hint');
    this.toastEl = el('div', 'toast');
    this.info = el('div', 'info');

    this.root.append(top, corner, this.info, this.hint, this.toastEl, this.drawer, bar);
    parent.appendChild(this.root);
  }

  private iconButton(name: IconName, label: string, onClick: () => void) {
    const btn = el('button', 'rbtn');
    btn.innerHTML = icon(name);
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private toolButton(name: IconName, label: string) {
    const btn = el('button', 'tbtn');
    btn.innerHTML = icon(name) + `<span>${label}</span>`;
    return btn;
  }

  private toggleDrawer(cat: Category) {
    if (this.drawerCat === cat) return this.closeDrawer();
    this.drawerCat = cat;
    this.drawer.replaceChildren();
    const title = el('div', 'drawer-title');
    title.textContent = CATS.find((c) => c.id === cat)!.label;
    const row = el('div', 'cards');
    for (const it of ITEMS.filter((i) => i.cat === cat)) row.appendChild(this.card(it));
    this.drawer.append(title, row);
    this.drawer.classList.add('show');
    this.catBtns.forEach((btn, c) => btn.classList.toggle('open', c === cat));
    this.refreshCards();
  }

  private closeDrawer() {
    this.drawerCat = null;
    this.drawer.classList.remove('show');
    this.catBtns.forEach((btn) => btn.classList.remove('open'));
  }

  private card(it: ToolItem) {
    const btn = el('button', 'card');
    const img = el('div', 'card-img');
    const thumb = this.thumbs.get(it.tool);
    if (thumb) img.style.backgroundImage = `url(${thumb})`;
    else img.innerHTML = icon(it.icon);
    const name = el('b', '');
    name.textContent = it.name;
    const tag = el('small', 'tag');
    tag.textContent = it.tag;
    const cost = el('div', 'cost');
    cost.innerHTML = it.money || it.stone
      ? `${icon('coin')}${it.money}${it.stone ? ` ${icon('stone')}${it.stone}` : ''}${it.perTile ? '<i>/tile</i>' : ''}`
      : 'Free';
    btn.title = it.desc;
    btn.append(img, name, tag, cost);
    btn.addEventListener('click', () => {
      this.h.setTool(it.tool);
      this.closeDrawer();
    });
    this.cards.set(it.tool, btn);
    return btn;
  }

  private refreshCards() {
    for (const it of ITEMS) {
      const c = this.cards.get(it.tool);
      if (!c) continue;
      c.classList.toggle('poor', this.lastMoney < it.money || this.lastStone < it.stone);
      c.classList.toggle('active', this.tool === it.tool);
    }
  }

  setActive(tool: ToolId) {
    this.tool = tool;
    this.closeDrawer();
    this.moveBtn.classList.toggle('active', tool === 'pan');
    this.removeBtn.classList.toggle('active', tool === 'bulldoze');
    const item = ITEMS.find((i) => i.tool === tool);
    this.catBtns.forEach((btn, cat) => {
      const on = item?.cat === cat;
      const c = CATS.find((x) => x.id === cat)!;
      btn.classList.toggle('active', on);
      btn.innerHTML = icon(on ? item!.icon : c.icon) + `<span>${on ? short(item!.name) : c.label}</span>`;
    });
    this.refreshCards();
    this.setHint(null);
  }

  setSpeed(s: number) {
    this.speedBtns.forEach((btn, i) => btn.classList.toggle('active', i === s));
  }

  setUndoEnabled(on: boolean) {
    this.undoBtn.disabled = !on;
  }

  setHint(text: string | null) {
    const item = ITEMS.find((i) => i.tool === this.tool);
    this.hint.textContent = text ?? BASE_HINTS[this.tool] ?? item?.desc ?? '';
  }

  setStats(s: HudStats) {
    const sign = s.daily >= 0 ? '+' : '';
    this.stat.money.innerHTML = `$${fmt(s.money)} <small class="${s.daily >= 0 ? 'pos' : 'neg'}">${sign}${fmt(s.daily)}</small>`;
    this.stat.stone.textContent = fmt(s.stone);
    this.stat.wood.textContent = fmt(s.wood);
    this.stat.food.innerHTML = `${fmt(s.food)} <small class="${s.foodDaily >= 0 ? 'pos' : 'neg'}">${s.foodDaily >= 0 ? '+' : ''}${fmt(s.foodDaily)}</small>`;
    this.stat.energy.textContent = `${Math.round(s.powered * 100)}%`;
    this.chip.energy.classList.toggle('warn', s.powered < 0.8);
    this.chip.food.classList.toggle('warn', s.food < s.population * 2);
    this.chip.wood.classList.toggle('warn', s.wood < 10);
    this.stat.pop.textContent = fmt(s.population);
    this.stat.jobs.textContent = `${s.workers}/${s.workforce}`;
    const mins = Math.floor(s.timeOfDay * 24 * 60);
    this.stat.day.textContent = `Day ${s.day} · ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.dayBar.style.width = `${Math.round(s.timeOfDay * 100)}%`;
    this.lastMoney = s.money;
    this.lastStone = s.stone;
    if (this.drawerCat) this.refreshCards();
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }

  showInfo(title: string, rows: [string, string][], onClose: () => void, people: InfoPerson[] = []) {
    const scroll = this.info.querySelector('.info-people')?.scrollTop ?? 0;
    this.info.replaceChildren();
    const head = el('div', 'info-head');
    const t = el('b', '');
    t.textContent = title;
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', onClose);
    head.append(t, x);
    this.info.appendChild(head);
    for (const [k, v] of rows) {
      const row = el('div', 'info-row');
      const a = el('span', '');
      const bb = el('span', '');
      a.textContent = k;
      bb.textContent = v;
      row.append(a, bb);
      this.info.appendChild(row);
    }
    if (people.length) {
      const list = el('div', 'info-people');
      for (const p of people) {
        const row = el('div', 'person');
        const ic = el('span', 'pic');
        ic.textContent = p.icon;
        const txt = el('div', '');
        const n = el('b', '');
        n.textContent = p.name;
        const d = el('small', '');
        d.textContent = p.detail;
        txt.append(n, d);
        row.append(ic, txt);
        list.appendChild(row);
      }
      this.info.appendChild(list);
      list.scrollTop = scroll;
    }
    this.info.classList.add('show');
  }

  hideInfo() {
    this.info.classList.remove('show');
  }

  dispose() {
    clearTimeout(this.toastTimer);
    this.root.remove();
  }
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
const short = (name: string) => name.replace('Stone ', '').replace('Wood Power Plant', 'Power').replace('Crop ', '').replace('Fruit ', '').replace('Cattle ', '').replace(' Lot', '');

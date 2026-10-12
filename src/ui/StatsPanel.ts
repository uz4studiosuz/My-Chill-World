import { Sample } from '../sim/History';
import { drawChart, Series } from './Chart';
import { el, icon, IconName } from './dom';
import { t } from '../i18n/i18n';

export interface StatsSnapshot {
  cityName: string;
  cities: number;
  money: number;
  stone: number;
  wood: number;
  food: number;
  foodRate: number;
  energyDemand: number;
  energyCapacity: number;
  powered: number;
  water: number;
  population: number;
  families: number;
  carsOwned: number;
  people: { men: number; women: number; boys: number; girls: number; babies: number; elders: number; students: number; workers: number; workforce: number; hungry: number; sick: number };
  jobs: number;
  schoolSeats: number;
  freeHomes: number;
  balance: { incomeTax: number; foodSales: number; propertyTax: number; publicWages: number; upkeep: number; net: number };
  buildings: Record<string, number>;
  roads: { total: number; bridges: number; roundabouts: number; signals: number; footpaths: number; canals: number };
  traffic: { cars: number; trucks: number; walkers: number; parked: number };
  animals: { cows: number; sheep: number; herds: number };
  trees: number;
  hasHall: boolean;
  deathsYesterday: number;
  history: Sample[];
}

type Tab = 'overview' | 'people' | 'economy' | 'traffic' | 'nature';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'stats' },
  { id: 'people', label: 'People', icon: 'people' },
  { id: 'economy', label: 'Economy', icon: 'coin' },
  { id: 'traffic', label: 'Traffic', icon: 'roads' },
  { id: 'nature', label: 'Nature', icon: 'cow' },
];

const C = { blue: '#6fb6ff', green: '#7be08f', amber: '#f2b33d', red: '#ff7a6e', violet: '#b9a3e0', gray: '#aab4be', pink: '#f28cb8', brown: '#c98a5a' };

/** Statistics drawer: KPIs, warnings, budget and history charts. */
export class StatsPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private tabBtns = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'overview';
  visible = false;
  private title!: HTMLElement;

  constructor(parent: HTMLElement, private get: () => StatsSnapshot) {
    this.root = el('div', 'stats');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    this.title = title;
    title.textContent = t('Statistics');
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    const tabs = el('div', 'stats-tabs');
    for (const tb of TABS) {
      const b = el('button', 'stab');
      b.innerHTML = icon(tb.icon) + `<span>${t(tb.label)}</span>`;
      b.addEventListener('click', () => { this.tab = tb.id; this.render(); });
      this.tabBtns.set(tb.id, b);
      tabs.appendChild(b);
    }
    this.body = el('div', 'stats-body');
    this.root.append(head, tabs, this.body);
    parent.appendChild(this.root);
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    this.root.classList.add('show');
    this.render();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  render() {
    if (!this.visible) return;
    this.tabBtns.forEach((b, id) => b.classList.toggle('active', id === this.tab));
    const s = this.get();
    this.title.textContent = `${t('Statistics')} · ${s.cityName}`;
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    const charts: [HTMLCanvasElement, Series[], (n: number) => string][] = [];
    const chart = (title: string, series: Series[], format: (n: number) => string = num) => {
      const box = el('div', 'chart');
      const head = el('div', 'chart-head');
      const tt = el('span', '');
      tt.textContent = title;
      const legend = el('span', 'legend');
      legend.innerHTML = series.map((x) => `<i style="background:${x.color}"></i>${x.label}`).join(' ');
      head.append(tt, legend);
      const c = el('canvas', '');
      box.append(head, c);
      this.body.appendChild(box);
      charts.push([c, series, format]);
    };
    const series = (key: keyof Sample) => s.history.map((x) => (x[key] as number) ?? 0);
    const p = s.people;
    const daysOfFood = s.population ? s.food / s.population : 99;

    switch (this.tab) {
      case 'overview': {
        this.kpis([
          [t('People'), num(s.population), t('{a} families · {b} free homes', { a: s.families, b: s.freeHomes })],
          [t('Employment'), pct(p.workforce ? p.workers / p.workforce : 1), t('{a}/{b} working', { a: p.workers, b: p.workforce })],
          [t('Money'), `$${num(s.money)}`, `${sign(s.balance.net)}$${num(Math.abs(s.balance.net))} ${t('yesterday')}`, s.balance.net >= 0],
          [t('Food'), num(s.food), t('{n} days of food', { n: daysOfFood.toFixed(1) }), daysOfFood > 3],
          [t('Energy'), pct(s.powered), t('{a} made / {b} needed', { a: num(s.energyCapacity), b: num(s.energyDemand) }), s.powered > 0.95],
          [t('Water'), pct(s.water), t('drinking water'), s.water > 0.99],
        ]);
        this.notes(s);
        chart(t('Population'), [{ label: t('People'), color: C.blue, values: series('pop') }]);
        chart(t('Money'), [{ label: t('Money'), color: C.amber, values: series('money') }], (n) => `$${short(n)}`);
        break;
      }
      case 'people': {
        this.kpis([
          [t('People'), num(s.population), t('{n} families', { n: s.families })],
          [t('Workers'), num(p.workers), t('of {a} able · {b} jobs', { a: p.workforce, b: s.jobs })],
          [t('Pupils'), num(p.students), t('{n} school places', { n: s.schoolSeats })],
          [t('Hungry / sick'), `${p.hungry} / ${p.sick}`, t('{n} died yesterday', { n: s.deathsYesterday }), p.hungry + p.sick === 0],
        ]);
        this.bars(t('Who lives here'), [
          [t('Men'), p.men, C.blue], [t('Women'), p.women, C.pink], [t('Boys'), p.boys, '#8fc8ff'],
          [t('Girls'), p.girls, '#f7b9d4'], [t('Babies'), p.babies, '#f2ede2'], [t('Elders'), p.elders, C.violet],
        ]);
        chart(t('People & workers'), [
          { label: t('People'), color: C.blue, values: series('pop') },
          { label: t('Working'), color: C.green, values: series('employed') },
        ]);
        break;
      }
      case 'economy': {
        const b = s.balance;
        this.rows(t("Yesterday's town budget"), [
          [t('Income tax (25%)'), `+$${num(b.incomeTax)}`, true],
          [t('Food sales'), `+$${num(b.foodSales)}`, true],
          [t('Property tax'), `+$${num(b.propertyTax)}`, true],
          [t('Public wages'), `−$${num(b.publicWages)}`, false],
          [t('Upkeep'), `−$${num(b.upkeep)}`, false],
          [t('Net'), `${sign(b.net)}$${num(Math.abs(b.net))}`, b.net >= 0],
        ]);
        chart(t('Money'), [{ label: t('Money'), color: C.amber, values: series('money') }], (n) => `$${short(n)}`);
        chart(t('Food & wood'), [{ label: t('Food'), color: C.green, values: series('food') }, { label: t('Wood'), color: C.brown, values: series('wood') }]);
        chart(t('Energy supplied'), [{ label: '%', color: '#ffe066', values: series('energy') }], (n) => `${Math.round(n)}%`);
        break;
      }
      case 'traffic': {
        this.kpis([
          [t('Cars driving'), num(s.traffic.cars), t('{n} parked', { n: s.traffic.parked })],
          [t('Pedestrians'), num(s.traffic.walkers), t('walking now')],
          [t('Trucks'), num(s.traffic.trucks), ''],
          [t('Traffic lights'), num(s.roads.signals), t('junctions')],
        ]);
        chart(t('On the move'), [
          { label: t('Cars'), color: C.blue, values: series('cars') },
          { label: t('Walkers'), color: C.green, values: series('walkers') },
        ]);
        this.rows(t('Network'), [
          [t('Road tiles'), num(s.roads.total)],
          [t('Bridges'), num(s.roads.bridges)],
          [t('Roundabouts'), num(s.roads.roundabouts)],
          [t('Footpaths'), num(s.roads.footpaths)],
          [t('Canals'), num(s.roads.canals)],
        ]);
        break;
      }
      case 'nature': {
        this.kpis([
          [t('Cows'), num(s.animals.cows), t('{n} herds', { n: s.animals.herds })],
          [t('Sheep'), num(s.animals.sheep), ''],
          [t('Trees'), num(s.trees), t('felled trees regrow')],
          [t('Ranches'), num(s.buildings.ranch ?? 0), t('cattle for food')],
        ]);
        this.bars(t('Wild animals'), [[t('Cows'), s.animals.cows, C.amber], [t('Sheep'), s.animals.sheep, '#e8e4da']]);
        chart(t('Animals'), [{ label: t('Animals'), color: C.green, values: series('animals') }]);
        break;
      }
    }
    this.body.scrollTop = scroll;
    requestAnimationFrame(() => charts.forEach(([c, ser, f]) => drawChart(c, ser, f)));
  }

  private notes(s: StatsSnapshot) {
    const out: [string, boolean][] = [];
    if (s.money < 0) out.push([t('The treasury is in debt — 8 months of debt means bankruptcy!'), false]);
    if (s.powered < 0.8) out.push([t('Power shortage — power plants need workers, wood and a road link'), false]);
    if (s.wood < 15) out.push([t('Wood is running out — build woodcutters near forests'), false]);
    if (s.food < s.population * 2) out.push([t('Food is low — people will starve. Build and irrigate farms'), false]);
    if (s.water < 0.99) out.push([t('Not enough drinking water — build a water tower'), false]);
    if (!s.freeHomes) out.push([t('No free homes — build houses so families can grow'), false]);
    if (!s.hasHall) out.push([t('No Wedding Hall — young people cannot marry'), false]);
    if (!s.schoolSeats && s.people.boys + s.people.girls > 0) out.push([t('Children have no school'), false]);
    if (!out.length) out.push([t('Everything runs smoothly — new families keep arriving'), true]);
    for (const [tx, good] of out) {
      const n = el('div', `snote ${good ? 'pos' : 'neg'}`);
      n.textContent = tx;
      this.body.appendChild(n);
    }
  }

  private kpis(items: [string, string, string, boolean?][]) {
    const grid = el('div', 'kpis');
    for (const [label, value, sub, good] of items) {
      const k = el('div', 'kpi');
      k.innerHTML = `<small>${label}</small><b>${value}</b>${sub ? `<span class="${good === false ? 'neg' : good ? 'pos' : ''}">${sub}</span>` : ''}`;
      grid.appendChild(k);
    }
    this.body.appendChild(grid);
  }

  private rows(title: string, rows: [string, string, boolean?][]) {
    const box = el('div', 'srows');
    const tt = el('div', 'srows-title');
    tt.textContent = title;
    box.appendChild(tt);
    for (const [k, v, good] of rows) {
      const r = el('div', 'info-row');
      r.innerHTML = `<span>${k}</span><span class="${good === undefined ? '' : good ? 'pos' : 'neg'}">${v}</span>`;
      box.appendChild(r);
    }
    this.body.appendChild(box);
  }

  private bars(title: string, items: [string, number, string][]) {
    const total = Math.max(1, items.reduce((a, b) => a + b[1], 0));
    const box = el('div', 'srows');
    const tt = el('div', 'srows-title');
    tt.textContent = title;
    const bar = el('div', 'stack');
    const legend = el('div', 'stack-legend');
    for (const [label, v, color] of items) {
      const seg = el('i', '');
      seg.style.width = `${(v / total) * 100}%`;
      seg.style.background = color;
      bar.appendChild(seg);
      const l = el('span', '');
      l.innerHTML = `<i style="background:${color}"></i>${label} <b>${num(v)}</b>`;
      legend.appendChild(l);
    }
    box.append(tt, bar, legend);
    this.body.appendChild(box);
  }
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${Math.round(n * 100)}%`;
const sign = (n: number) => (n >= 0 ? '+' : '−');
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

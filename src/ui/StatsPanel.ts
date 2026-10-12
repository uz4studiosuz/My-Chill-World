import { Sample } from '../sim/History';
import { drawChart, Series } from './Chart';
import { el, icon, IconName } from './dom';

export interface StatsSnapshot {
  money: number;
  stone: number;
  wood: number;
  food: number;
  foodRate: number;
  energyDemand: number;
  energyCapacity: number;
  powered: number;
  population: number;
  families: number;
  carsOwned: number;
  people: { men: number; women: number; boys: number; girls: number; babies: number; elders: number; students: number; workers: number; workforce: number };
  jobs: number;
  schoolSeats: number;
  freeHomes: number;
  balance: { incomeTax: number; foodSales: number; propertyTax: number; publicWages: number; upkeep: number; net: number };
  buildings: Record<string, number>;
  roads: { total: number; bridges: number; roundabouts: number; signals: number; footpaths: number };
  traffic: { cars: number; trucks: number; walkers: number; parked: number };
  animals: { cows: number; sheep: number; herds: number };
  trees: number;
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

/** Statistics drawer: KPIs, breakdowns and history charts. */
export class StatsPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private tabBtns = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'overview';
  visible = false;

  constructor(parent: HTMLElement, private get: () => StatsSnapshot) {
    this.root = el('div', 'stats');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = 'Statistics';
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', 'Close statistics');
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    const tabs = el('div', 'stats-tabs');
    for (const t of TABS) {
      const b = el('button', 'stab');
      b.innerHTML = icon(t.icon) + `<span>${t.label}</span>`;
      b.addEventListener('click', () => { this.tab = t.id; this.render(); });
      this.tabBtns.set(t.id, b);
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
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    const charts: [HTMLCanvasElement, Series[], (n: number) => string][] = [];
    const chart = (title: string, series: Series[], format: (n: number) => string = num) => {
      const box = el('div', 'chart');
      const head = el('div', 'chart-head');
      const t = el('span', '');
      t.textContent = title;
      const legend = el('span', 'legend');
      legend.innerHTML = series.map((x) => `<i style="background:${x.color}"></i>${x.label}`).join(' ');
      head.append(t, legend);
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
          ['People', num(s.population), `${s.families} families · ${s.freeHomes} free homes`],
          ['Employment', pct(p.workforce ? p.workers / p.workforce : 1), `${p.workers}/${p.workforce} working`],
          ['Money', `$${num(s.money)}`, `${sign(s.balance.net)}$${num(Math.abs(s.balance.net))} yesterday`, s.balance.net >= 0],
          ['Food', num(s.food), `${daysOfFood.toFixed(1)} days · ${sign(s.foodRate - s.population)}${num(Math.abs(s.foodRate - s.population))}/day`, s.foodRate >= s.population],
          ['Energy', pct(s.powered), `${num(s.energyCapacity)} made / ${num(s.energyDemand)} needed`, s.powered > 0.95],
          ['Wood', num(s.wood), 'fuel for power'],
        ]);
        this.notes(s);
        chart('Population', [{ label: 'People', color: C.blue, values: series('pop') }]);
        chart('Money', [{ label: 'Money', color: C.amber, values: series('money') }], (n) => `$${short(n)}`);
        break;
      }
      case 'people': {
        this.kpis([
          ['People', num(s.population), `${s.families} families`],
          ['Workers', num(p.workers), `of ${p.workforce} able to work · ${s.jobs} jobs`],
          ['Pupils', num(p.students), `${s.schoolSeats} school places`],
          ['Cars owned', num(s.carsOwned), `${pct(s.families ? s.carsOwned / s.families : 0)} of families`],
        ]);
        this.bars('Who lives here', [
          ['Men', p.men, C.blue], ['Women', p.women, C.pink], ['Boys', p.boys, '#8fc8ff'],
          ['Girls', p.girls, '#f7b9d4'], ['Babies', p.babies, '#f2ede2'], ['Elders', p.elders, C.violet],
        ]);
        chart('People & workers', [
          { label: 'People', color: C.blue, values: series('pop') },
          { label: 'Working', color: C.green, values: series('employed') },
        ]);
        break;
      }
      case 'economy': {
        const b = s.balance;
        this.rows('Yesterday\'s town budget', [
          ['Income tax (25%)', `+$${num(b.incomeTax)}`, true],
          ['Food sales', `+$${num(b.foodSales)}`, true],
          ['Property tax', `+$${num(b.propertyTax)}`, true],
          ['Public wages (hall, school, power)', `−$${num(b.publicWages)}`, false],
          ['Upkeep (roads, buildings)', `−$${num(b.upkeep)}`, false],
          ['Net', `${sign(b.net)}$${num(Math.abs(b.net))}`, b.net >= 0],
        ]);
        chart('Money', [{ label: 'Money', color: C.amber, values: series('money') }], (n) => `$${short(n)}`);
        chart('Food & wood', [{ label: 'Food', color: C.green, values: series('food') }, { label: 'Wood', color: C.brown, values: series('wood') }]);
        chart('Energy supplied', [{ label: '% powered', color: '#ffe066', values: series('energy') }], (n) => `${Math.round(n)}%`);
        break;
      }
      case 'traffic': {
        this.kpis([
          ['Cars driving', num(s.traffic.cars), `${s.traffic.parked} parked`],
          ['Pedestrians', num(s.traffic.walkers), 'walking now'],
          ['Trucks', num(s.traffic.trucks), ''],
          ['Traffic lights', num(s.roads.signals), 'junctions'],
        ]);
        chart('On the move', [
          { label: 'Cars', color: C.blue, values: series('cars') },
          { label: 'Walkers', color: C.green, values: series('walkers') },
        ]);
        this.rows('Network', [
          ['Road tiles', num(s.roads.total)],
          ['Bridges', `${s.roads.bridges} tiles`],
          ['Roundabouts', num(s.roads.roundabouts)],
          ['Footpaths', `${s.roads.footpaths} tiles`],
        ]);
        break;
      }
      case 'nature': {
        this.kpis([
          ['Cows', num(s.animals.cows), `${s.animals.herds} herds`],
          ['Sheep', num(s.animals.sheep), ''],
          ['Trees', num(s.trees), 'felled trees regrow in 6 days'],
          ['Ranches', num(s.buildings.ranch ?? 0), 'cattle for food'],
        ]);
        this.bars('Wild animals', [['Cows', s.animals.cows, C.amber], ['Sheep', s.animals.sheep, '#e8e4da']]);
        chart('Animals', [{ label: 'Animals', color: C.green, values: series('animals') }]);
        break;
      }
    }
    this.body.scrollTop = scroll;
    requestAnimationFrame(() => charts.forEach(([c, ser, f]) => drawChart(c, ser, f)));
  }

  private notes(s: StatsSnapshot) {
    const out: [string, boolean][] = [];
    if (s.powered < 0.8) out.push(['Power shortage — build a power plant and keep it supplied with wood', false]);
    if (s.wood < 10 && s.energyDemand > 0) out.push(['Wood is running out — build woodcutters near forests', false]);
    if (s.food < s.population * 2) out.push(['Food is low — build farms, orchards or ranches', false]);
    if (!s.freeHomes) out.push(['No free homes — build houses so new families can move in', false]);
    if (s.people.students < s.people.boys + s.people.girls - 5 && !s.schoolSeats) out.push(['Children have no school', false]);
    if (!out.length) out.push(['Everything runs smoothly — new families keep arriving', true]);
    for (const [t, good] of out) {
      const n = el('div', `snote ${good ? 'pos' : 'neg'}`);
      n.textContent = t;
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
    const t = el('div', 'srows-title');
    t.textContent = title;
    box.appendChild(t);
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
    const t = el('div', 'srows-title');
    t.textContent = title;
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
    box.append(t, bar, legend);
    this.body.appendChild(box);
  }
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${Math.round(n * 100)}%`;
const sign = (n: number) => (n >= 0 ? '+' : '−');
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { drawChart, Series } from './Chart';

/** A block of the city report. */
export interface ReportSection {
  title: string;
  /** Spans the whole width. */
  wide?: boolean;
  /** Key figures: label, value, small text, good (green) / bad (red). */
  kpis?: [string, string, string?, boolean?][];
  /** Horizontal bars: label, value, colour, text shown at the end. */
  bars?: [string, number, string, string][];
  /** A ring diagram of shares: label, value, colour. */
  donut?: [string, number, string][];
  /** Lines over time. */
  chart?: { series: Series[]; format?: 'money' | 'pct' | 'num' | 'kw' };
  rows?: [string, string, ('good' | 'bad')?][];
  note?: string;
}

export interface CityReportView { title: string; subtitle: string; tabs: { id: string; label: string; sections: ReportSection[] }[] }

const fmtOf = (f?: string) => (n: number) => f === 'money' ? `$${Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n)}` : f === 'pct' ? `${Math.round(n)}%` : f === 'kw' ? `${Math.round(n)} kW` : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

/** Draw a ring diagram with the shares in the middle. */
function drawDonut(c: HTMLCanvasElement, parts: [string, number, string][]) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const total = parts.reduce((a, [, v]) => a + Math.max(0, v), 0);
  const r = Math.min(w, h) / 2 - 4, cx = w / 2, cy = h / 2;
  let a = -Math.PI / 2;
  if (total <= 0) { g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = r * 0.38; g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.stroke(); return; }
  g.lineWidth = r * 0.38;
  for (const [, v, col] of parts) {
    if (v <= 0) continue;
    const da = (v / total) * Math.PI * 2;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(cx, cy, r * 0.8, a, a + da - 0.01);
    g.stroke();
    a += da;
  }
}

/** A big window with everything about one town: tabs of key figures, bars, ring diagrams and charts. */
export class CityReport {
  private root: HTMLDivElement;
  visible = false;
  private tab = '';
  private id = -1;
  private last = '';

  constructor(parent: HTMLElement, private get: (cityId: number) => CityReportView | null) {
    this.root = el('div', 'stats city-report');
    parent.appendChild(this.root);
  }

  open(cityId: number) { this.id = cityId; this.visible = true; this.root.classList.add('show'); this.render(); }
  hide() { this.visible = false; this.root.classList.remove('show'); }

  render() {
    if (!this.visible) return;
    const v = this.get(this.id);
    if (!v) return this.hide();
    const key = `${this.id}|${this.tab}|${JSON.stringify(v)}`;
    if (key === this.last) return;
    this.last = key;
    if (!v.tabs.some((x) => x.id === this.tab)) this.tab = v.tabs[0]?.id ?? '';
    const scroll = this.root.querySelector('.stats-body')?.scrollTop ?? 0;
    this.root.replaceChildren();
    const head = el('div', 'stats-head');
    const titles = el('div', 'cr-titles');
    const h = el('b', '');
    h.textContent = v.title;
    const s = el('small', '');
    s.textContent = v.subtitle;
    titles.append(h, s);
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(titles, x);
    const tabs = el('div', 'stats-tabs');
    for (const tb of v.tabs) {
      const b = el('button', `stab${tb.id === this.tab ? ' active' : ''}`);
      b.textContent = tb.label;
      b.addEventListener('click', () => { this.tab = tb.id; this.render(); });
      tabs.appendChild(b);
    }
    const body = el('div', 'stats-body');
    const later: (() => void)[] = [];
    for (const sec of v.tabs.find((x2) => x2.id === this.tab)?.sections ?? []) {
      const box = el('div', 'srows cr-sec');
      if (sec.wide || sec.kpis) box.style.gridColumn = '1 / -1';
      const tt = el('div', 'srows-title');
      tt.textContent = sec.title;
      box.appendChild(tt);
      if (sec.kpis) {
        const grid = el('div', 'kpis');
        for (const [label, value, sub, good] of sec.kpis) {
          const k = el('div', 'kpi');
          k.innerHTML = `<small></small><b></b>${sub ? '<span></span>' : ''}`;
          (k.querySelector('small') as HTMLElement).textContent = label;
          (k.querySelector('b') as HTMLElement).textContent = value;
          if (sub) { const sp = k.querySelector('span') as HTMLElement; sp.textContent = sub; if (good !== undefined) sp.className = good ? 'pos' : 'neg'; }
          grid.appendChild(k);
        }
        box.appendChild(grid);
      }
      if (sec.donut) {
        const wrap = el('div', 'cr-donut');
        const c = el('canvas', '') as HTMLCanvasElement;
        const legend = el('div', 'cr-legend');
        const total = sec.donut.reduce((a, [, val]) => a + Math.max(0, val), 0) || 1;
        for (const [label, val, col] of sec.donut) {
          const row = el('div', '');
          row.innerHTML = `<i></i><span></span><b></b>`;
          (row.querySelector('i') as HTMLElement).style.background = col;
          (row.querySelector('span') as HTMLElement).textContent = label;
          (row.querySelector('b') as HTMLElement).textContent = `${Math.round((Math.max(0, val) / total) * 100)}%`;
          legend.appendChild(row);
        }
        wrap.append(c, legend);
        box.appendChild(wrap);
        later.push(() => drawDonut(c, sec.donut!));
      }
      if (sec.bars) {
        const max = Math.max(1e-9, ...sec.bars.map(([, val]) => Math.abs(val)));
        for (const [label, val, col, text] of sec.bars) {
          const row = el('div', 'wt-bar');
          row.innerHTML = `<span></span><div><i></i></div><b></b>`;
          (row.querySelector('span') as HTMLElement).textContent = label;
          const bar = row.querySelector('i') as HTMLElement;
          bar.style.width = `${Math.max(1, (Math.abs(val) / max) * 100)}%`;
          bar.style.background = col;
          (row.querySelector('b') as HTMLElement).textContent = text;
          box.appendChild(row);
        }
      }
      if (sec.chart) {
        const legend = el('div', 'chart-head');
        legend.innerHTML = `<span class="legend">${sec.chart.series.map((se) => `<i style="background:${se.color}"></i>${se.label}`).join(' ')}</span>`;
        const c = el('canvas', 'cr-chart') as HTMLCanvasElement;
        box.append(legend, c);
        const ch = sec.chart;
        later.push(() => drawChart(c, ch.series, fmtOf(ch.format)));
      }
      for (const [k, val, tone] of sec.rows ?? []) {
        const r = el('div', 'info-row');
        r.innerHTML = '<span></span><span></span>';
        (r.children[0] as HTMLElement).textContent = k;
        (r.children[1] as HTMLElement).textContent = val;
        if (tone) (r.children[1] as HTMLElement).className = tone === 'good' ? 'pos' : 'neg';
        box.appendChild(r);
      }
      if (sec.note) { const n = el('div', 'rp-note'); n.textContent = sec.note; box.appendChild(n); }
      body.appendChild(box);
    }
    this.root.append(head, tabs, body);
    body.scrollTop = scroll;
    later.forEach((f) => f());
  }
}

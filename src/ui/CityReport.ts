import { el, icon, hoverBusy } from './dom';
import { t } from '../i18n/i18n';
import { drawChart, Series } from './Chart';
import type { InspectorView } from './Inspector';

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
  /** label, value, tone, and an optional 'Show' action (a family or a person on the map). */
  rows?: [string, string, ('good' | 'bad')?, (() => void)?][];
  /** Buttons (for example raising or lowering the tax). */
  actions?: { label: string; onClick: () => void; off?: boolean }[];
  note?: string;
}

/**
 * A tab: report sections, the town hall itself (figures and buttons), and/or another window shown inside —
 * 'trade' (the whole trade window) or 'stats:<page>' (one statistics page under the sections).
 */
export interface ReportTab { id: string; label: string; sections?: ReportSection[]; hall?: InspectorView; embed?: string }
export interface CityReportView { title: string; subtitle: string; tabs: ReportTab[] }
/** A window that can live inside the town hall window (trade). */
export interface Embed { el: () => HTMLElement; open: (page?: string) => void; close: () => void }

const PAGE = 10;

/** Page buttons under a long list: ‹ 2 / 5 (43) › */
export function pager(page: number, pages: number, total: number, go: (p: number) => void) {
  const nav = el('div', 'pager');
  const prev = el('button', 'btn-mini ghost');
  prev.textContent = '‹';
  prev.disabled = page <= 0;
  prev.addEventListener('click', (e) => { e.stopPropagation(); go(page - 1); });
  const label = el('small', '');
  label.textContent = `${page + 1} / ${pages} · ${total}`;
  const next = el('button', 'btn-mini ghost');
  next.textContent = '›';
  next.disabled = page >= pages - 1;
  next.addEventListener('click', (e) => { e.stopPropagation(); go(page + 1); });
  nav.append(prev, label, next);
  return nav;
}

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
  private head: HTMLDivElement;
  private titles: HTMLDivElement;
  private headTitle: HTMLElement;
  private headSubtitle: HTMLElement;
  private tabsEl: HTMLDivElement;
  private body: HTMLDivElement;
  private tabScroll = new Map<string, number>();
  visible = false;
  private tab = '';
  id = -1;
  /** Called when the player closes the window. */
  onClose?: () => void;
  private last = '';
  private shownTab = '';
  /** Page of each long list (by tab and section). */
  private pages = new Map<string, number>();

  /** Embedded window currently shown, and where it came from. */
  private embedded: { key: string; page?: string; el: HTMLElement; home: HTMLElement | null } | null = null;

  constructor(parent: HTMLElement, private get: (cityId: number) => CityReportView | null, private embeds: Record<string, Embed> = {}) {
    this.root = el('div', 'stats city-report');
    this.head = el('div', 'stats-head');
    this.titles = el('div', 'cr-titles');
    this.headTitle = el('b', '');
    this.headSubtitle = el('small', '');
    this.titles.append(this.headTitle, this.headSubtitle);
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => { this.hide(); this.onClose?.(); });
    this.head.append(this.titles, x);

    this.tabsEl = el('div', 'stats-tabs');
    this.body = el('div', 'stats-body');

    this.body.addEventListener('scroll', () => {
      if (this.visible && this.shownTab === this.tab) this.tabScroll.set(this.tab, this.body.scrollTop);
    }, { passive: true });

    this.root.append(this.head, this.tabsEl, this.body);
    parent.appendChild(this.root);
  }

  open(cityId: number, tab?: string) { if (tab) { this.tab = tab; this.last = ''; } this.id = cityId; this.visible = true; this.root.classList.add('show'); this.render(); }
  hide() { this.release(); this.visible = false; this.root.classList.remove('show'); }

  /** Give an embedded window back to its place. */
  private release() {
    const e = this.embedded;
    if (!e) return;
    this.embedded = null;
    this.embeds[e.key]?.close();
    e.el.classList.remove('embedded', 'embedded-page');
    if (e.home) e.home.appendChild(e.el);
  }

  render() {
    if (!this.visible) return;
    if (hoverBusy(this.root)) return;
    // the player is typing (a wage…): don't rebuild the window under the cursor
    const typing = document.activeElement;
    if (typing instanceof HTMLInputElement && this.root.contains(typing)) return;
    const v = this.get(this.id);
    if (!v) return this.hide();
    const key = `${this.id}|${this.tab}|${JSON.stringify(v)}`;
    if (key === this.last) return;
    this.last = key;
    if (!v.tabs.some((x) => x.id === this.tab)) this.tab = v.tabs[0]?.id ?? '';

    // the same tab keeps exactly its place while the figures update (realtime); another tab returns to where it was
    const sameTab = this.shownTab === this.tab;
    if (sameTab) this.tabScroll.set(this.tab, this.body.scrollTop);
    const targetScroll = this.tabScroll.get(this.tab) ?? 0;
    this.shownTab = this.tab;

    this.headTitle.textContent = v.title;
    this.headSubtitle.textContent = v.subtitle;

    this.tabsEl.replaceChildren();
    for (const tb of v.tabs) {
      const b = el('button', `stab${tb.id === this.tab ? ' active' : ''}`);
      b.textContent = tb.label;
      b.addEventListener('click', () => {
        if (this.tab !== tb.id) {
          if (this.body.scrollTop > 0) this.tabScroll.set(this.tab, this.body.scrollTop);
          this.tab = tb.id;
          this.last = '';
          this.render();
        }
      });
      this.tabsEl.appendChild(b);
    }

    const later: (() => void)[] = [];
    const cur = v.tabs.find((x2) => x2.id === this.tab);

    const [embKey, embPage] = (cur?.embed ?? '').split(':');
    const em = embKey ? this.embeds[embKey] : undefined;
    // a whole window shown inside (trade): it scrolls by itself
    if (em && !embPage && !cur?.sections?.length) {
      if (this.embedded?.key !== embKey) {
        this.release();
        const node = em.el();
        this.embedded = { key: embKey, el: node, home: node.parentElement };
        em.open();
        node.classList.add('embedded');
      }
      this.body.className = 'stats-body cr-embed';
      if (!this.body.contains(this.embedded!.el)) {
        this.body.replaceChildren(this.embedded!.el);
      }
    } else {
      if (!em || this.embedded?.key !== embKey) this.release();
      this.body.className = 'stats-body';
      this.body.replaceChildren();

      if (cur?.hall) this.renderHall(this.body, cur.hall);
      for (const sec of cur?.sections ?? []) {
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
        // long lists: 10 rows a page, with buttons to turn the pages
        const all = sec.rows ?? [];
        const pkey = `${this.tab}|${(cur?.sections ?? []).indexOf(sec)}`;
        const pagesN = Math.ceil(all.length / PAGE);
        const page = Math.min(this.pages.get(pkey) ?? 0, Math.max(0, pagesN - 1));
        for (const [k, val, tone, show] of all.slice(page * PAGE, page * PAGE + PAGE)) {
          const r = el('div', 'info-row');
          r.innerHTML = '<span></span><span></span>';
          (r.children[0] as HTMLElement).textContent = k;
          (r.children[1] as HTMLElement).textContent = val;
          if (tone) (r.children[1] as HTMLElement).className = tone === 'good' ? 'pos' : 'neg';
          if (show) {
            const b = el('button', 'btn-mini ghost cr-show');
            b.innerHTML = icon('eye');
            b.title = t('Show');
            b.setAttribute('aria-label', t('Show'));
            b.addEventListener('click', (e) => { e.stopPropagation(); show(); });
            r.appendChild(b);
          }
          box.appendChild(r);
        }
        if (pagesN > 1) box.appendChild(pager(page, pagesN, all.length, (p) => { this.pages.set(pkey, p); this.last = ''; this.render(); }));
        if (sec.actions?.length) {
          const acts = el('div', 'cr-actions');
          for (const a of sec.actions) {
            const btn = el('button', 'btn-mini');
            btn.textContent = a.label;
            btn.disabled = !!a.off;
            btn.addEventListener('click', () => { a.onClick(); this.last = ''; this.render(); });
            acts.appendChild(btn);
          }
          box.appendChild(acts);
        }
        if (sec.note) { const n = el('div', 'rp-note'); n.textContent = sec.note; box.appendChild(n); }
        this.body.appendChild(box);
      }
      // one statistics page under the sections (live charts and controls)
      if (em && embPage) {
        if (this.embedded?.key !== embKey || this.embedded.page !== embPage) {
          const node = this.embedded?.key === embKey ? this.embedded.el : em.el();
          const home = this.embedded?.key === embKey ? this.embedded.home : node.parentElement;
          this.embedded = { key: embKey, page: embPage, el: node, home };
          node.classList.add('embedded', 'embedded-page');
          em.open(embPage);
        }
        const head = el('div', 'cr-live');
        head.textContent = t('Live statistics');
        this.body.append(head, this.embedded.el);
      }
    }

    this.body.scrollTop = targetScroll;
    later.forEach((f) => f());
  }

  /** The town hall's own panel, wide: figures as bars, rows in blocks, and its buttons. */
  private renderHall(body: HTMLElement, h: InspectorView) {
    const top = el('div', 'srows cr-sec');
    top.style.gridColumn = '1 / -1';
    if (h.tags?.length) {
      const tags = el('div', 'cr-tags');
      for (const tg of h.tags) { const s = el('span', `tag ${tg.tone}`); s.textContent = tg.text; tags.appendChild(s); }
      top.appendChild(tags);
    }
    for (const b of h.bars ?? []) {
      const row = el('div', 'wt-bar');
      row.innerHTML = `<span></span><div><i></i></div><b></b>`;
      (row.querySelector('span') as HTMLElement).textContent = b.label;
      const bar = row.querySelector('i') as HTMLElement;
      bar.style.width = `${Math.max(1, Math.min(1, b.value) * 100)}%`;
      bar.style.background = b.color;
      (row.querySelector('b') as HTMLElement).textContent = b.text ?? `${Math.round(b.value * 100)}%`;
      top.appendChild(row);
    }
    if (h.actions?.length) {
      const acts = el('div', 'cr-actions');
      for (const a of h.actions) {
        const btn = el('button', `btn-mini${a.active ? ' active' : ''}`);
        btn.innerHTML = `${a.icon ? icon(a.icon) : ''}<span></span>`;
        (btn.querySelector('span') as HTMLElement).textContent = a.label;
        btn.addEventListener('click', () => { a.onClick(); this.last = ''; this.render(); });
        acts.appendChild(btn);
      }
      top.appendChild(acts);
    }
    body.appendChild(top);
    const block = (title: string, rows: [string, string, ('good' | 'bad')?][]) => {
      if (!rows.length) return;
      const box = el('div', 'srows cr-sec');
      const tt = el('div', 'srows-title');
      tt.textContent = title;
      box.appendChild(tt);
      for (const [k, val, tone] of rows) {
        const r = el('div', 'info-row');
        r.innerHTML = '<span></span><span></span>';
        (r.children[0] as HTMLElement).textContent = k;
        (r.children[1] as HTMLElement).textContent = val;
        if (tone) (r.children[1] as HTMLElement).className = tone === 'good' ? 'pos' : 'neg';
        box.appendChild(r);
      }
      body.appendChild(box);
    };
    block(h.subtitle || h.title, h.rows ?? []);
    for (const s of h.sections ?? []) block(s.title, s.rows);
    if (h.people?.length) block(h.listTitle ?? '', h.people.slice(0, 40).map((p) => [`${p.icon} ${p.name}`, p.detail] as [string, string]));
  }
}

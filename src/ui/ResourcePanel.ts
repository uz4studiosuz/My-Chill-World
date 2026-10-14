import { el, icon, IconName } from './dom';
import { t } from '../i18n/i18n';

export interface ResourceSection {
  title: string;
  /** label, value, tone */
  rows?: [string, string, ('good' | 'bad')?][];
  /** label, 0..1, text */
  bars?: [string, number, string][];
  /** Net per day, oldest first (a small bar chart). */
  chart?: { label: string; value: number }[];
  note?: string;
}

export interface ResourceView {
  key: string;
  icon: IconName;
  title: string;
  value: string;
  sub?: string;
  sections: ResourceSection[];
}

/** Drop-down that explains one top-bar readout: where it comes from, where it goes, and the trend. */
export class ResourcePanel {
  private root: HTMLDivElement;
  key: string | null = null;
  private savedScroll = 0;

  constructor(parent: HTMLElement, private build: (key: string) => ResourceView | null) {
    this.root = el('div', 'respanel');
    parent.appendChild(this.root);
    document.addEventListener('pointerdown', (e) => {
      const tg = e.target as HTMLElement;
      if (this.key && !this.root.contains(tg) && !tg.closest?.('.chip')) this.hide();
    }, true);
  }

  get visible() { return this.key !== null; }

  toggle(key: string) {
    if (this.key === key) return this.hide();
    this.key = key;
    this.render();
  }

  hide() {
    this.key = null;
    this.root.classList.remove('show');
  }

  render() {
    if (!this.key) return;
    const v = this.build(this.key);
    if (!v) return this.hide();
    const oldBody = this.root.querySelector('.rp-body') as HTMLElement | null;
    if (oldBody && oldBody.scrollTop > 0) this.savedScroll = oldBody.scrollTop;
    const scroll = this.savedScroll;
    this.root.replaceChildren();
    const head = el('div', 'rp-head');
    head.innerHTML = `<span class="rp-ic">${icon(v.icon)}</span>`;
    const titles = el('div', 'rp-titles');
    const h = el('b', '');
    h.textContent = v.title;
    const val = el('div', 'rp-value');
    val.textContent = v.value;
    titles.append(h, val);
    if (v.sub) { const s = el('small', ''); s.textContent = v.sub; titles.appendChild(s); }
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(titles, x);
    const body = el('div', 'rp-body');
    body.addEventListener('scroll', () => { if (body.scrollTop > 0) this.savedScroll = body.scrollTop; }, { passive: true });
    for (const sec of v.sections) {
      const st = el('div', 'rp-sec');
      st.textContent = sec.title;
      body.appendChild(st);
      if (sec.chart?.length) {
        const max = Math.max(1, ...sec.chart.map((c) => Math.abs(c.value)));
        const ch = el('div', 'rp-chart');
        for (const c of sec.chart) {
          const col = el('div', 'rp-col');
          const bar = el('i', c.value >= 0 ? 'pos' : 'neg');
          bar.style.height = `${Math.max(2, (Math.abs(c.value) / max) * 100)}%`;
          bar.title = `${c.label}: ${c.value >= 0 ? '+' : '−'}${Math.round(Math.abs(c.value)).toLocaleString('en-US')}`;
          const lb = el('small', '');
          lb.textContent = c.label;
          col.append(bar, lb);
          ch.appendChild(col);
        }
        body.appendChild(ch);
      }
      for (const [label, value, text] of sec.bars ?? []) {
        const row = el('div', 'rp-bar');
        row.innerHTML = `<div class="rp-bar-l"><span></span><span></span></div><div class="rp-track"><i></i></div>`;
        (row.querySelector('.rp-bar-l span') as HTMLElement).textContent = label;
        (row.querySelectorAll('.rp-bar-l span')[1] as HTMLElement).textContent = text;
        (row.querySelector('.rp-track i') as HTMLElement).style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
        body.appendChild(row);
      }
      if (sec.rows?.length) {
        const grid = el('div', 'rp-grid');
        for (const [k, val2, tone] of sec.rows) {
          const a = el('span', 'k');
          a.textContent = k;
          const b = el('span', `v ${tone ?? ''}`);
          b.textContent = val2;
          grid.append(a, b);
        }
        body.appendChild(grid);
      }
      if (sec.note) {
        const n = el('div', 'rp-note');
        n.textContent = sec.note;
        body.appendChild(n);
      }
    }
    this.root.append(head, body);
    this.root.classList.add('show');
    body.scrollTop = scroll;
    requestAnimationFrame(() => { if (this.visible && scroll > 0) body.scrollTop = scroll; });
  }
}

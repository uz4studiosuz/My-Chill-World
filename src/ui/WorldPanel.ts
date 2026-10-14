import { el, icon } from './dom';
import { t } from '../i18n/i18n';

/** One town as the World window shows it. */
export interface WorldTown {
  id: number;
  name: string;
  tint: string;
  mine: boolean;
  /** Mayor's character (autonomous towns), as an English key. */
  style?: string;
  mood: string;
  people: number;
  growth: number;
  money: number;
  happiness: number;
  tax: number;
  loan: number;
  buildings: number;
  jobs: string;
  millionaires: number;
  richest: { name: string; money: number }[];
  relation?: number;
  news: { day: number; text: string }[];
}

const MOOD: Record<string, [string, string]> = {
  boom: ['Boom', '#7be08f'], growing: ['Growing', '#a8d86a'], stable: ['Stable', '#aab4be'], shrinking: ['Shrinking', '#f2b33d'], crisis: ['Crisis', '#ff6b5e'],
};

/** The World window: every town on the map, what it is like, how it is doing and what happened there lately. */
export class WorldPanel {
  private root: HTMLDivElement;
  visible = false;
  private open = new Set<number>();

  constructor(parent: HTMLElement, private get: () => WorldTown[], private show: (id: number) => void, private trade: () => void) {
    this.root = el('div', 'respanel world-panel');
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else { this.visible = true; this.render(); } }
  hide() { this.visible = false; this.root.classList.remove('show'); }

  render() {
    if (!this.visible) return;
    const towns = this.get();
    const scroll = this.root.querySelector('.rp-body')?.scrollTop ?? 0;
    this.root.replaceChildren();
    const head = el('div', 'rp-head');
    head.innerHTML = `<span class="rp-ic">${icon('eye')}</span>`;
    const titles = el('div', 'rp-titles');
    const h = el('b', '');
    h.textContent = t('World');
    const v = el('div', 'rp-value');
    v.textContent = t('{n} towns', { n: towns.length });
    const sub = el('small', '');
    sub.textContent = t('{n} people in all', { n: towns.reduce((a, x) => a + x.people, 0) });
    titles.append(h, v, sub);
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(titles, x);
    const body = el('div', 'rp-body');
    for (const tw of towns) {
      const card = el('div', 'wt-card');
      const top = el('div', 'wt-top');
      const dot = el('i', 'nb-dot');
      dot.style.background = tw.tint;
      const name = el('div', 'wt-name');
      const b = el('b', '');
      b.textContent = tw.name;
      const who = el('small', '');
      who.textContent = tw.mine ? t('Your town') : t(tw.style ?? 'Autonomous town');
      name.append(b, who);
      const mood = MOOD[tw.mood] ?? MOOD.stable;
      const badge = el('span', 'wt-mood');
      badge.textContent = t(mood[0]);
      badge.style.background = mood[1];
      top.append(dot, name, badge);
      const grid = el('div', 'wt-grid');
      const stat = (label: string, value: string, tone?: 'good' | 'bad') => {
        const c = el('div', 'wt-stat');
        c.innerHTML = '<small></small><b></b>';
        (c.querySelector('small') as HTMLElement).textContent = label;
        const vb = c.querySelector('b') as HTMLElement;
        vb.textContent = value;
        if (tone) vb.className = tone === 'good' ? 'pos' : 'neg';
        grid.appendChild(c);
      };
      stat(t('People'), `${tw.people}`);
      stat(t('Last week'), `${tw.growth >= 0 ? '+' : ''}${tw.growth}`, tw.growth > 0 ? 'good' : tw.growth < 0 ? 'bad' : undefined);
      stat(t('Treasury'), `$${Math.round(tw.money).toLocaleString('en-US')}`, tw.money < 0 ? 'bad' : undefined);
      stat(t('Happiness'), `${Math.round(tw.happiness)}%`, tw.happiness >= 60 ? 'good' : tw.happiness < 45 ? 'bad' : undefined);
      stat(t('Tax'), `${Math.round(tw.tax * 100)}%`);
      stat(t('Loan'), tw.loan ? `$${tw.loan}` : '—', tw.loan ? 'bad' : undefined);
      stat(t('Buildings'), `${tw.buildings}`);
      stat(t('Jobs'), tw.jobs);
      stat(t('Millionaires'), `${tw.millionaires}`, tw.millionaires ? 'good' : undefined);
      if (tw.relation !== undefined) stat(t('Relations'), `${Math.round(tw.relation)}/100`, tw.relation >= 50 ? 'good' : tw.relation < 25 ? 'bad' : undefined);
      card.append(top, grid);
      if (tw.richest.length) {
        const r = el('div', 'wt-rich');
        r.textContent = `${t('Richest')}: ${tw.richest.map((f) => `${f.name} $${Math.round(f.money).toLocaleString('en-US')}`).join(' · ')}`;
        card.appendChild(r);
      }
      // the town's own news
      const newsBox = el('div', 'wt-news');
      const shown = this.open.has(tw.id) ? tw.news : tw.news.slice(0, 3);
      for (const n of shown) {
        const line = el('div', '');
        line.innerHTML = '<small></small><span></span>';
        (line.querySelector('small') as HTMLElement).textContent = t('Day {n}', { n: n.day });
        (line.querySelector('span') as HTMLElement).textContent = n.text;
        newsBox.appendChild(line);
      }
      if (!tw.news.length) { const e = el('div', 'wt-empty'); e.textContent = tw.mine ? t('Your news is in the Chronicle') : t('Nothing has happened yet'); newsBox.appendChild(e); }
      card.appendChild(newsBox);
      const btns = el('div', 'wt-btns');
      const mk = (label: string, fn: () => void) => { const bt = el('button', 'btn-mini ghost'); bt.textContent = label; bt.addEventListener('click', fn); return bt; };
      btns.appendChild(mk(t('Show on the map'), () => this.show(tw.id)));
      if (tw.news.length > 3) btns.appendChild(mk(this.open.has(tw.id) ? t('Less news') : t('All news'), () => { if (this.open.has(tw.id)) this.open.delete(tw.id); else this.open.add(tw.id); this.render(); }));
      if (!tw.mine) btns.appendChild(mk(t('Trade'), this.trade));
      card.appendChild(btns);
      body.appendChild(card);
    }
    this.root.append(head, body);
    this.root.classList.add('show');
    body.scrollTop = scroll;
  }
}

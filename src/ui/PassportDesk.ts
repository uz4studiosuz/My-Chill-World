import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { passportCard, type InspectorView } from './Inspector';

/** One resident in the passport desk's register. */
export interface DeskPerson {
  id: number;
  name: string;
  surname: string;
  age: number;
  sex: 'm' | 'f';
  /** child, adult, elder */
  group: 'child' | 'adult' | 'elder';
  profession: string;
  working: boolean;
  student: boolean;
  /** Family savings. */
  money: number;
  number: string;
  street: string;
}

export interface DeskHost {
  people(): DeskPerson[];
  view(id: number): InspectorView | null;
  show(id: number): void;
  story(id: number): void;
}

type Filter = 'all' | 'm' | 'f' | 'child' | 'elder' | 'work' | 'jobless' | 'student' | 'rich';
const FILTERS: [Filter, string][] = [['all', 'Everyone'], ['m', 'Men'], ['f', 'Women'], ['child', 'Under 18'], ['elder', 'Elders'], ['work', 'Working'], ['jobless', 'Looking for work'], ['student', 'Pupils and students'], ['rich', 'Richest families']];
type Sort = 'name' | 'age' | 'money';

/**
 * The passport desk of the town hall: the register of every resident — search by name, profession or document
 * number, filter and sort, and open anyone's ID card with their details.
 */
export class PassportDesk {
  private root: HTMLDivElement;
  visible = false;
  private q = '';
  private filter: Filter = 'all';
  private sort: Sort = 'name';
  private picked = -1;
  /** The page of the list (15 residents a page). */
  private page = 0;
  private listEl?: HTMLDivElement;
  private cardEl?: HTMLDivElement;
  private wrapEl?: HTMLDivElement;
  private pagerEl?: HTMLDivElement;

  constructor(parent: HTMLElement, private host: DeskHost) {
    this.root = el('div', 'pdesk');
    parent.appendChild(this.root);
  }

  get element() { return this.root; }
  open() { this.visible = true; this.root.classList.add('show'); this.build(); }
  hide() { this.visible = false; this.root.classList.remove('show'); }

  /** The frame: search, filters, the list and the card (the list and card refresh on their own). */
  private build() {
    this.root.replaceChildren();
    const head = el('div', 'pd-head');
    head.innerHTML = `<span class="pd-ic">${icon('people')}</span><div><b></b><small></small></div>`;
    (head.querySelector('b') as HTMLElement).textContent = t('Passport desk');
    const count = head.querySelector('small') as HTMLElement;
    const search = el('input', 'pd-search') as HTMLInputElement;
    search.type = 'search';
    search.placeholder = t('Search: name, surname, profession or document No.');
    search.value = this.q;
    search.addEventListener('input', () => { this.q = search.value; this.page = 0; this.fill(count); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    const chips = el('div', 'pd-chips');
    for (const [f, label] of FILTERS) {
      const b = el('button', `pd-chip${this.filter === f ? ' active' : ''}`);
      b.textContent = t(label);
      b.addEventListener('click', () => { this.filter = f; this.page = 0; chips.querySelectorAll('.pd-chip').forEach((x) => x.classList.toggle('active', x === b)); this.fill(count); });
      chips.appendChild(b);
    }
    const sort = el('select', 'pd-sort') as HTMLSelectElement;
    for (const [v, label] of [['name', 'By name'], ['age', 'By age'], ['money', 'By savings']] as [Sort, string][]) {
      const o = el('option', '') as HTMLOptionElement;
      o.value = v;
      o.textContent = t(label);
      sort.appendChild(o);
    }
    sort.value = this.sort;
    sort.addEventListener('change', () => { this.sort = sort.value as Sort; this.page = 0; this.fill(count); });
    const bar = el('div', 'pd-bar');
    bar.append(search, sort);
    const wrap = el('div', 'pd-wrap');
    this.listEl = el('div', 'pd-list');
    this.pagerEl = el('div', 'pd-pager');
    this.cardEl = el('div', 'pd-card');
    const left = el('div', 'pd-left');
    left.append(this.listEl, this.pagerEl!);
    wrap.append(left, this.cardEl);
    this.wrapEl = wrap;
    wrap.classList.toggle('picked', this.picked >= 0);
    this.root.append(head, bar, chips, wrap);
    this.fill(count);
    this.showCard();
  }

  /** Refresh the list (called by the town hall window now and then, and on every search). */
  render() { if (this.visible && this.listEl) this.fill(this.root.querySelector('.pd-head small') as HTMLElement); }

  private fill(count: HTMLElement) {
    if (!this.listEl) return;
    const all = this.host.people();
    const q = this.q.trim().toLowerCase();
    let list = all.filter((p) => {
      if (q && !`${p.name} ${p.surname} ${p.profession} ${p.number} ${p.street}`.toLowerCase().includes(q)) return false;
      switch (this.filter) {
        case 'm': return p.sex === 'm' && p.group !== 'child';
        case 'f': return p.sex === 'f' && p.group !== 'child';
        case 'child': return p.group === 'child';
        case 'elder': return p.group === 'elder';
        case 'work': return p.working;
        case 'jobless': return p.group === 'adult' && !p.working && !p.student;
        case 'student': return p.student;
        default: return true;
      }
    });
    if (this.filter === 'rich') list = [...list].sort((a, b) => b.money - a.money).slice(0, 40);
    else list.sort((a, b) => (this.sort === 'age' ? b.age - a.age : this.sort === 'money' ? b.money - a.money : `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`)));
    count.textContent = t('{a} of {b} residents', { a: list.length, b: all.length });
    const scroll = this.listEl.scrollTop;
    this.listEl.replaceChildren();
    if (!list.length) { const e = el('div', 'rp-note'); e.textContent = t('Nobody found'); this.listEl.appendChild(e); }
    const PER = 15;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    this.page = Math.min(this.page, pages - 1);
    for (const p of list.slice(this.page * PER, this.page * PER + PER)) {
      const r = el('button', `pd-row${p.id === this.picked ? ' active' : ''}`);
      r.innerHTML = '<span class="pd-av"></span><div><b></b><small></small></div><em></em>';
      const av = r.querySelector('.pd-av') as HTMLElement;
      av.textContent = p.group === 'child' ? (p.sex === 'm' ? '👦' : '👧') : p.group === 'elder' ? (p.sex === 'm' ? '👴' : '👵') : (p.sex === 'm' ? '👨' : '👩');
      av.classList.add(p.sex);
      (r.querySelector('b') as HTMLElement).textContent = `${p.surname} ${p.name}`;
      (r.querySelector('small') as HTMLElement).textContent = `${t('{n} years', { n: p.age })} · ${p.profession}`;
      (r.querySelector('em') as HTMLElement).textContent = p.number;
      r.addEventListener('click', () => { this.picked = p.id; this.listEl!.querySelectorAll('.pd-row').forEach((x) => x.classList.toggle('active', x === r)); this.showCard(); });
      this.listEl.appendChild(r);
    }
    this.listEl.scrollTop = scroll;
    // the pages: ‹ 1 2 3 … ›
    const pg = this.pagerEl!;
    pg.replaceChildren();
    if (pages > 1) {
      const go = (n: number) => { this.page = Math.max(0, Math.min(pages - 1, n)); this.listEl!.scrollTop = 0; this.fill(count); };
      const btn = (label: string, n: number, on = false, off = false) => { const b = el('button', `pd-pg${on ? ' active' : ''}`); b.textContent = label; b.disabled = off; b.addEventListener('click', () => go(n)); pg.appendChild(b); };
      btn('‹', this.page - 1, false, this.page === 0);
      const shown = new Set([0, pages - 1, this.page - 1, this.page, this.page + 1].filter((n) => n >= 0 && n < pages));
      let last = -1;
      for (const n of [...shown].sort((a, b) => a - b)) {
        if (n - last > 1) { const d = el('span', 'pd-dots'); d.textContent = '…'; pg.appendChild(d); }
        btn(String(n + 1), n, n === this.page);
        last = n;
      }
      btn('›', this.page + 1, false, this.page >= pages - 1);
      const info = el('span', 'pd-pinfo');
      info.textContent = t('{a}–{b} of {n}', { a: this.page * PER + 1, b: Math.min(list.length, this.page * PER + PER), n: list.length });
      pg.appendChild(info);
    }
  }

  private showCard() {
    if (!this.cardEl) return;
    this.cardEl.replaceChildren();
    const v = this.picked >= 0 ? this.host.view(this.picked) : null;
    if (!v) {
      const e = el('div', 'pd-empty');
      e.innerHTML = `<span>🪪</span><b></b><small></small>`;
      (e.querySelector('b') as HTMLElement).textContent = t('Choose a resident');
      (e.querySelector('small') as HTMLElement).textContent = t('Their ID card, family, education, work and money open here.');
      this.cardEl.appendChild(e);
      return;
    }
    this.wrapEl?.classList.add('picked');
    // phones: back to the list
    const back = el('button', 'pd-back');
    back.textContent = `← ${t('List')}`;
    back.addEventListener('click', () => { this.picked = -1; this.wrapEl?.classList.remove('picked'); this.showCard(); });
    this.cardEl.appendChild(back);
    const title = el('div', 'pd-title');
    title.innerHTML = '<b></b><small></small>';
    (title.querySelector('b') as HTMLElement).textContent = v.title;
    (title.querySelector('small') as HTMLElement).textContent = v.subtitle ?? '';
    this.cardEl.appendChild(title);
    if (v.passport) this.cardEl.appendChild(passportCard(v.passport));
    if (v.tags?.length) {
      const tags = el('div', 'ins-tags');
      for (const tg of v.tags) { const s = el('span', `ins-tag ${tg.tone}`); s.textContent = tg.text; tags.appendChild(s); }
      this.cardEl.appendChild(tags);
    }
    for (const sec of v.sections ?? []) {
      const h = el('div', 'pd-sec');
      h.textContent = sec.title;
      this.cardEl.appendChild(h);
      for (const [k, val, tone] of sec.rows) {
        const r = el('div', 'pd-kv');
        r.innerHTML = '<span></span><b></b>';
        (r.querySelector('span') as HTMLElement).textContent = k;
        const vb = r.querySelector('b') as HTMLElement;
        vb.textContent = val;
        if (tone) vb.className = tone === 'good' ? 'pos' : 'neg';
        this.cardEl.appendChild(r);
      }
    }
    const acts = el('div', 'pd-acts');
    const mk = (label: string, ic: Parameters<typeof icon>[0], fn: () => void) => { const b = el('button', 'btn-mini'); b.innerHTML = `${icon(ic)}<span></span>`; (b.querySelector('span') as HTMLElement).textContent = label; b.addEventListener('click', fn); acts.appendChild(b); };
    const id = this.picked;
    mk(t('Show on the map'), 'eye', () => this.host.show(id));
    mk(t('Life story'), 'book', () => this.host.story(id));
    this.cardEl.appendChild(acts);
  }
}

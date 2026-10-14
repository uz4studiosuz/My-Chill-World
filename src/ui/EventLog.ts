import { el, icon } from './dom';
import { t } from '../i18n/i18n';

export interface LogEntry { day: number; text: string }

const MAX = 200;

/** Chronicle of everything that happened: births, weddings, deaths, fires, purchases… */
export class EventLog {
  readonly entries: LogEntry[] = [];
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private filter = '';
  private tab: 'mine' | 'neighbours' = 'mine';
  visible = false;

  constructor(parent: HTMLElement, private dateOf: (day: number) => string, private foreign: () => { day: number; text: string; town: string; tint: string }[] = () => []) {
    this.root = el('div', 'goals eventlog');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = t('Chronicle');
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    const search = el('input', 'log-search');
    search.placeholder = t('Search events…');
    search.addEventListener('input', () => { this.filter = search.value.toLowerCase(); this.render(); });
    this.body = el('div', 'goals-body');
    // two pages: what happened in your town, and the news of the neighbour towns
    const tabs = el('div', 'stats-tabs log-tabs');
    for (const [id, label] of [['mine', 'My town'], ['neighbours', 'Neighbour towns']] as const) {
      const b = el('button', `stab${id === this.tab ? ' active' : ''}`);
      b.textContent = t(label);
      b.addEventListener('click', () => { this.tab = id; tabs.querySelectorAll('.stab').forEach((x) => x.classList.toggle('active', x === b)); this.render(); });
      tabs.appendChild(b);
    }
    this.root.append(head, tabs, search, this.body);
    parent.appendChild(this.root);
  }

  add(day: number, text: string) {
    this.entries.push({ day, text });
    if (this.entries.length > MAX) this.entries.shift();
    if (this.visible) this.render();
  }

  load(list: LogEntry[] = []) {
    this.entries.length = 0;
    this.entries.push(...list.slice(-MAX));
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

  dispose() {
    this.root.remove();
  }

  private render() {
    this.body.replaceChildren();
    if (this.tab === 'neighbours') {
      const all = this.foreign().filter((e) => !this.filter || e.text.toLowerCase().includes(this.filter) || e.town.toLowerCase().includes(this.filter)).sort((a, b) => b.day - a.day);
      if (!all.length) { const empty = el('div', 'goals-sum'); empty.textContent = t('No neighbour towns, or nothing has happened there yet'); this.body.appendChild(empty); return; }
      let d = -1;
      for (const e of all.slice(0, 200)) {
        if (e.day !== d) { d = e.day; const h = el('div', 'log-day'); h.textContent = this.dateOf(e.day); this.body.appendChild(h); }
        const row = el('div', 'log-row');
        row.innerHTML = `<i class="wt-dot"></i><b></b> <span></span>`;
        (row.querySelector('i') as HTMLElement).style.background = e.tint;
        (row.querySelector('b') as HTMLElement).textContent = e.town;
        (row.querySelector('span') as HTMLElement).textContent = e.text;
        this.body.appendChild(row);
      }
      return;
    }
    const list = this.entries.filter((e) => !this.filter || e.text.toLowerCase().includes(this.filter)).slice().reverse();
    if (!list.length) {
      const empty = el('div', 'goals-sum');
      empty.textContent = t('Nothing has happened yet');
      this.body.appendChild(empty);
      return;
    }
    let lastDay = -1;
    for (const e of list) {
      if (e.day !== lastDay) {
        lastDay = e.day;
        const h = el('div', 'log-day');
        h.textContent = this.dateOf(e.day);
        this.body.appendChild(h);
      }
      const row = el('div', 'log-row');
      row.textContent = e.text;
      this.body.appendChild(row);
    }
  }
}

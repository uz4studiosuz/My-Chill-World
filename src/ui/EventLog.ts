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
  visible = false;

  constructor(parent: HTMLElement, private dateOf: (day: number) => string) {
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
    this.root.append(head, search, this.body);
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

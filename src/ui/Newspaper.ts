import { el, icon } from './dom';
import { t } from '../i18n/i18n';

const KEY = 'mcw_news';
const KEEP = 30;

export interface NewsIssue {
  date: string;
  city: string;
  headline: string;
  stories: string[];
  richest: string;
  problem: string;
  population: number;
  popChange: number;
  money: number;
  moneyChange: number;
}

/**
 * The morning newspaper. Every morning a new issue arrives; it does not pop up in the middle of the screen —
 * a counter on the newspaper button shows how many are unread, and the reader opens the newest one with
 * arrows to leaf back through the last days.
 */
export class Newspaper {
  private root: HTMLDivElement;
  private issues: NewsIssue[] = [];
  private unread = 0;
  private index = 0;
  /** Called when the number of unread issues changes (the counter on the button). */
  onUnread: (n: number) => void = () => {};

  static get enabled() {
    try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
  }

  static set enabled(on: boolean) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  }

  constructor(parent: HTMLElement) {
    this.root = el('div', 'news');
    parent.appendChild(this.root);
  }

  get visible() { return this.root.classList.contains('show'); }

  /** A new issue arrived (kept for reading later). */
  show(n: NewsIssue) {
    if (!Newspaper.enabled) return;
    this.issues.unshift(n);
    if (this.issues.length > KEEP) this.issues.length = KEEP;
    this.unread = Math.min(this.issues.length, this.unread + 1);
    this.onUnread(this.unread);
    if (this.visible) { this.index++; this.render(); }
  }

  /** Open the reader at the newest issue (or close it). */
  toggle() {
    if (this.visible) return this.hide();
    this.index = 0;
    this.unread = 0;
    this.onUnread(0);
    this.render();
  }

  private render() {
    this.root.replaceChildren();
    const n = this.issues[this.index];
    const head = el('div', 'news-head');
    head.innerHTML = `${icon('news')}<b></b><span></span>`;
    (head.querySelector('b') as HTMLElement).textContent = n ? t('The {city} Times', { city: n.city }) : t('Newspaper');
    (head.querySelector('span') as HTMLElement).textContent = n?.date ?? '';
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.appendChild(close);
    if (!n) {
      const e = el('div', 'news-headline');
      e.textContent = t('No newspaper yet — the first issue comes tomorrow morning');
      this.root.append(head, e);
      this.root.classList.add('show');
      return;
    }
    const h = el('div', 'news-headline');
    h.textContent = n.headline;
    const list = el('ul', 'news-list');
    for (const s of n.stories.slice(0, 8)) {
      const li = el('li', '');
      li.textContent = s;
      list.appendChild(li);
    }
    const facts = el('div', 'news-facts');
    const sign = (v: number) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
    facts.innerHTML = `
      <span><i>${t('Population')}</i>${n.population} <small class="${n.popChange >= 0 ? 'pos' : 'neg'}">${sign(n.popChange)}</small></span>
      <span><i>${t('Treasury')}</i>$${Math.round(n.money).toLocaleString('en-US')} <small class="${n.moneyChange >= 0 ? 'pos' : 'neg'}">${sign(n.moneyChange)}</small></span>
      <span><i>${t('Richest family')}</i></span>
      <span><i>${t('Biggest problem')}</i></span>`;
    (facts.children[2] as HTMLElement).append(n.richest);
    (facts.children[3] as HTMLElement).append(n.problem);
    // leaf through the last issues
    const nav = el('div', 'news-nav');
    const prev = el('button', 'btn-mini ghost');
    prev.textContent = `‹ ${t('Older')}`;
    prev.disabled = this.index >= this.issues.length - 1;
    prev.addEventListener('click', () => { this.index++; this.render(); });
    const count = el('small', '');
    count.textContent = t('{a} of {b}', { a: this.index + 1, b: this.issues.length });
    const next = el('button', 'btn-mini ghost');
    next.textContent = `${t('Newer')} ›`;
    next.disabled = this.index === 0;
    next.addEventListener('click', () => { this.index--; this.render(); });
    nav.append(prev, count, next);
    this.root.append(head, h, list, facts, nav);
    this.root.classList.add('show');
  }

  hide() {
    this.root.classList.remove('show');
  }

  dispose() {
    this.root.remove();
  }
}

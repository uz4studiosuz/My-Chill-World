import { el, icon } from './dom';
import { t } from '../i18n/i18n';

const KEY = 'mcw_news';

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

/** A small morning newspaper: what happened yesterday, the richest family and the biggest problem. */
export class Newspaper {
  private root: HTMLDivElement;
  private timer = 0;

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

  show(n: NewsIssue) {
    if (!Newspaper.enabled) return;
    this.root.replaceChildren();
    const head = el('div', 'news-head');
    head.innerHTML = `${icon('news')}<b>${t('The {city} Times', { city: n.city })}</b><span>${n.date}</span>`;
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.appendChild(close);
    const h = el('div', 'news-headline');
    h.textContent = n.headline;
    const list = el('ul', 'news-list');
    for (const s of n.stories.slice(0, 4)) {
      const li = el('li', '');
      li.textContent = s;
      list.appendChild(li);
    }
    const facts = el('div', 'news-facts');
    const sign = (v: number) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
    facts.innerHTML = `
      <span><i>${t('Population')}</i>${n.population} <small class="${n.popChange >= 0 ? 'pos' : 'neg'}">${sign(n.popChange)}</small></span>
      <span><i>${t('Treasury')}</i>$${Math.round(n.money).toLocaleString('en-US')} <small class="${n.moneyChange >= 0 ? 'pos' : 'neg'}">${sign(n.moneyChange)}</small></span>
      <span><i>${t('Richest family')}</i>${n.richest}</span>
      <span><i>${t('Biggest problem')}</i>${n.problem}</span>`;
    this.root.append(head, h, list, facts);
    this.root.classList.add('show');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), 14000);
  }

  hide() {
    this.root.classList.remove('show');
  }

  dispose() {
    clearTimeout(this.timer);
    this.root.remove();
  }
}

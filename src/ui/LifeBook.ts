import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import type { StoryEntry } from '../people/Population';

export interface LifeBookData {
  name: string;
  subtitle: string;
  icon: string;
  story: StoryEntry[];
  now: string;
}

/** A citizen's life written like a little book: where they were born, school, work, wedding, children… */
export class LifeBook {
  private root: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement, private dateOf: (day: number) => string) {
    this.root = el('div', 'lifebook');
    parent.appendChild(this.root);
  }

  open(d: LifeBookData) {
    this.visible = true;
    this.root.replaceChildren();
    const head = el('div', 'lb-head');
    const badge = el('div', 'lb-badge');
    badge.textContent = d.icon;
    const titles = el('div', 'lb-titles');
    const h = el('b', '');
    h.textContent = d.name;
    const sub = el('small', '');
    sub.textContent = d.subtitle;
    titles.append(h, sub);
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(badge, titles, x);

    const page = el('div', 'lb-page');
    const cap = el('div', 'lb-chapter');
    cap.textContent = t('The story of a life');
    page.appendChild(cap);
    if (!d.story.length) {
      const p = el('p', 'lb-empty');
      p.textContent = t('Nothing written yet — their story starts now.');
      page.appendChild(p);
    }
    for (const e of d.story) {
      const row = el('div', 'lb-entry');
      const when = el('div', 'lb-when');
      const age = t('{n} years', { n: e.a });
      when.textContent = e.d >= 1 ? `${age} · ${this.dateOf(e.d)}` : age;
      const text = el('div', 'lb-text');
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(e.p ?? {})) params[k] = typeof v === 'string' ? t(v) : v;
      text.textContent = t(e.k, params);
      row.append(when, text);
      page.appendChild(row);
    }
    const now = el('div', 'lb-entry now');
    now.innerHTML = `<div class="lb-when">${t('Today')}</div>`;
    const nt = el('div', 'lb-text');
    nt.textContent = d.now;
    now.appendChild(nt);
    page.appendChild(now);
    this.root.append(head, page);
    this.root.classList.add('show');
    page.scrollTop = page.scrollHeight;
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }
}

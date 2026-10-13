import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import type { Decision } from '../game/Decisions';

/** A card that asks the player to decide (random events). */
export class DecisionPanel {
  private root: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'decision');
    parent.appendChild(this.root);
  }

  show(d: Decision, cityName: string, choose: (i: number) => void) {
    this.visible = true;
    this.root.replaceChildren();
    const head = el('div', 'dc-head');
    head.innerHTML = `<span class="dc-ic">${icon('mail')}</span>`;
    const titles = el('div', 'dc-titles');
    const h = el('b', '');
    h.textContent = t(d.title);
    const sub = el('small', '');
    sub.textContent = `${cityName} · ${t('The town hall must decide')}`;
    titles.append(h, sub);
    head.appendChild(titles);
    const text = el('p', 'dc-text');
    text.textContent = t(d.text);
    const opts = el('div', 'dc-opts');
    d.options.forEach((o, i) => {
      const b = el('button', `dc-opt${i === 0 ? ' primary' : ''}`);
      b.innerHTML = '<b></b><small></small>';
      (b.querySelector('b') as HTMLElement).textContent = t(o.label);
      (b.querySelector('small') as HTMLElement).textContent = t(o.note);
      b.addEventListener('click', () => { this.hide(); choose(i); });
      opts.appendChild(b);
    });
    this.root.append(head, text, opts);
    this.root.classList.add('show');
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }
}

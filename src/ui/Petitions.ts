import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { PETITION_TEXT, Petition } from '../game/Leisure';

/** Letters from residents to the town hall: open requests, answered and ignored ones. */
export class PetitionsPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement, private list: () => { petitions: Petition[]; city: number; day: number; cityName: (id: number) => string }, private show: (p: Petition) => void) {
    this.root = el('div', 'goals eventlog');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = t('Letters from residents');
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    this.body = el('div', 'goals-body');
    this.root.append(head, this.body);
    parent.appendChild(this.root);
  }

  toggle() {
    if (this.visible) this.hide();
    else this.open();
  }

  open() {
    this.visible = true;
    this.root.classList.add('show');
    this.render();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  dispose() { this.root.remove(); }

  render() {
    if (!this.visible) return;
    const { petitions, day, cityName } = this.list();
    this.body.replaceChildren();
    const sum = el('div', 'goals-sum');
    sum.textContent = t('Do what residents ask: you get a reward and their trust. Ignored letters make people unhappy.');
    this.body.appendChild(sum);
    const sorted = petitions.slice().sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1) || b.day - a.day);
    if (!sorted.length) {
      const empty = el('div', 'log-row');
      empty.textContent = t('No letters yet');
      this.body.appendChild(empty);
      return;
    }
    for (const p of sorted) {
      const card = el('div', `petition ${p.state}`);
      const top = el('div', 'petition-top');
      const who = el('b', '');
      who.textContent = t('{family} family', { family: p.from });
      const st = el('span', 'petition-state');
      st.textContent = p.state === 'open' ? t('{n} days left', { n: Math.max(0, 8 - (day - p.day)) }) : p.state === 'done' ? t('Done') : t('Ignored');
      top.append(who, st);
      const text = el('div', 'petition-text');
      text.textContent = t(PETITION_TEXT[p.kind]);
      const foot = el('div', 'petition-foot');
      const reward = el('span', '');
      reward.textContent = `${cityName(p.city)} · ${t('Reward')}: $${p.reward}`;
      foot.appendChild(reward);
      if (p.state === 'open') {
        const go = el('button', 'btn-mini');
        go.innerHTML = `${icon('follow')}<span>${t('Show')}</span>`;
        go.addEventListener('click', () => this.show(p));
        foot.appendChild(go);
      }
      card.append(top, text, foot);
      this.body.appendChild(card);
    }
  }
}

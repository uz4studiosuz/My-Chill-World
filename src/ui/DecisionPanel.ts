import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import type { Decision } from '../game/Decisions';

/** A card that asks the player to decide (random events). */
export class DecisionPanel {
  private root: HTMLDivElement;
  visible = false;
  /** The question on screen (shown again when the UI is rebuilt, e.g. after the language changes). */
  pending?: { d: Decision; cityName: string; choose: (i: number, amount: number) => void };

  constructor(parent: HTMLElement) {
    this.root = el('div', 'decision');
    parent.appendChild(this.root);
  }

  show(d: Decision, cityName: string, choose: (i: number, amount: number) => void) {
    this.visible = true;
    this.pending = { d, cityName, choose };
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
    // how much: a slider, a number and quick buttons (when the question has an amount)
    let amount = d.amount ? d.amount.value : 0;
    const notes: HTMLElement[] = [];
    const err = el('div', 'dc-err');
    const amountBox = el('div', 'dc-amount');
    if (d.amount) {
      const A = d.amount;
      const lab = el('div', 'dc-a-head');
      lab.innerHTML = '<span></span><small></small>';
      (lab.querySelector('span') as HTMLElement).textContent = t(A.label);
      (lab.querySelector('small') as HTMLElement).textContent = A.have !== undefined ? t('You have {n}', { n: Math.floor(A.have) }) : '';
      const row = el('div', 'dc-a-row');
      const range = document.createElement('input');
      range.type = 'range'; range.min = `${A.min}`; range.max = `${A.max}`; range.step = `${A.step}`; range.value = `${amount}`;
      const num = document.createElement('input');
      num.type = 'number'; num.min = `${A.min}`; num.max = `${A.max}`; num.step = `${A.step}`; num.value = `${amount}`; num.inputMode = 'numeric';
      const set = (v: number, from?: HTMLInputElement) => {
        amount = Math.max(A.min, Math.min(A.max, Math.round(v / A.step) * A.step || A.min));
        if (from !== range) range.value = `${amount}`;
        if (from !== num) num.value = `${amount}`;
        err.textContent = '';
        d.options.forEach((o, i) => { if (o.noteFor && notes[i]) notes[i].textContent = o.noteFor(amount); });
      };
      range.addEventListener('input', () => set(Number(range.value), range));
      num.addEventListener('input', () => { if (num.value !== '') set(Number(num.value), num); });
      num.addEventListener('blur', () => set(Number(num.value)));
      row.append(range, num);
      const quick = el('div', 'dc-a-quick');
      const marks: [string, number][] = [['¼', A.max / 4], ['½', A.max / 2], [t('All'), A.max]];
      if (A.have !== undefined && A.have >= A.min && A.have < A.max) marks.push([t('What I have'), A.have]);
      for (const [label, v] of marks) {
        const q = el('button', 'dc-a-q');
        q.textContent = label;
        q.addEventListener('click', () => set(v));
        quick.appendChild(q);
      }
      amountBox.append(lab, row, quick);
    }
    const opts = el('div', 'dc-opts');
    d.options.forEach((o, i) => {
      const b = el('button', `dc-opt${i === 0 ? ' primary' : ''}`);
      b.innerHTML = '<b></b><small></small>';
      (b.querySelector('b') as HTMLElement).textContent = t(o.label);
      const note = b.querySelector('small') as HTMLElement;
      note.textContent = o.noteFor && d.amount ? o.noteFor(amount) : t(o.note);
      notes[i] = note;
      b.addEventListener('click', () => {
        // not possible now (e.g. not enough in the stores): say why and keep the window open
        const why = o.check?.(amount);
        if (why) { err.textContent = why; this.root.classList.remove('shake'); void this.root.offsetWidth; this.root.classList.add('shake'); return; }
        this.hide(); choose(i, amount);
      });
      opts.appendChild(b);
    });
    if (d.amount) this.root.append(head, text, amountBox, err, opts);
    else this.root.append(head, text, err, opts);
    this.root.classList.add('show');
  }

  hide() {
    this.visible = false;
    this.pending = undefined;
    this.root.classList.remove('show');
  }
}

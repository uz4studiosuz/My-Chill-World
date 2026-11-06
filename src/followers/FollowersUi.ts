import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Sex } from '../people/Population';
import type { Building } from '../buildings/Buildings';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';
import { DEV, onSaveStatus, pushWorld } from './store';

/** The page's Instagram name, shown in the film and to visitors (empty: not shown). */
export const INSTAGRAM = '';

const STUDIO_TITLE_KEY = 'mcw_studio_title';
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const button = (label: string, fn: () => void, cls = 'btn-mini') => {
  const b = el('button', cls, label);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
};
const at = (nick: string) => `@${nick}`;

/**
 * The followers' town page: name tags over every follower, a panel to find a follower's home (and, on the owner's
 * computer, to add followers and publish the town), and a studio mode for filming.
 */
export class FollowersUi {
  private panel = el('div', 'fol-panel');
  private tagLayer = el('div', 'fol-tags');
  private studio = el('div', 'studio');
  private banner = el('div', 'fol-banner');
  private tags = new Map<string, HTMLDivElement>();
  private fresh = new Map<string, number>();
  private v = new THREE.Vector3();
  private raf = 0;
  private last = performance.now();
  private listT = 0;
  private listSig = '';
  private bannerT = 0;
  private showTags = true;
  private studioOn = false;
  private tour = true;
  private tourT = 0;
  private tourStep = 0;
  private tourOrder: string[] = [];
  private barT = 0;
  private abort = new AbortController();
  private saveTimer = 0;
  private status!: HTMLDivElement;
  private list!: HTMLDivElement;
  private count!: HTMLSpanElement;
  private caption!: HTMLDivElement;
  private counter!: HTMLDivElement;
  private bar!: HTMLDivElement;

  constructor(private game: Game) {
    this.buildPanel();
    this.buildStudio();
    // the name tags lie under the game's interface, the rest above it
    const ui = document.getElementById('ui');
    if (ui) ui.before(this.tagLayer); else document.body.append(this.tagLayer);
    document.body.append(this.panel, this.banner, this.studio);
    document.body.classList.add('followers-town');
    const sig = this.abort.signal;
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Escape' && this.studioOn) { e.stopPropagation(); this.setStudio(false); }
      if (e.code === 'KeyT' && this.studioOn) this.tourNext();
    }, { signal: sig, capture: true });
    window.addEventListener('mousemove', () => { this.barT = 2.5; }, { signal: sig });
    onSaveStatus((s, note) => {
      if (!this.status) return;
      this.status.textContent = s === 'saving' ? t('Saving into the project…') : s === 'saved' ? `✓ ${t('Saved into the project')} ${new Date().toLocaleTimeString()}` : `⚠ ${t('Could not save')}: ${note ?? ''}`;
      this.status.className = `fol-status ${s}`;
    });
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    clearTimeout(this.saveTimer);
    if (this.studioOn) this.setStudio(false);
    this.panel.remove();
    this.tagLayer.remove();
    this.banner.remove();
    this.studio.remove();
    document.body.classList.remove('followers-town');
  }

  // ---------- the panel ----------

  private buildPanel() {
    const head = el('div', 'fol-head');
    const title = el('b', '', `👥 ${t("Followers' town")}`);
    this.count = el('span', 'fol-count', '0');
    const fold = button('–', () => {
      this.panel.classList.toggle('folded');
      fold.textContent = this.panel.classList.contains('folded') ? '+' : '–';
    }, 'btn-mini ghost fol-fold');
    head.append(title, this.count, fold);
    const body = el('div', 'fol-body');

    if (INSTAGRAM) body.append(el('div', 'fol-promo', t('Follow {name} on Instagram — and your house appears in this town!', { name: at(INSTAGRAM) })));
    else body.append(el('div', 'fol-promo', t('Everyone here is a real follower. Find your house!')));

    // find a follower (everyone can)
    const find = el('form', 'fol-find');
    const q = el('input') as HTMLInputElement;
    q.placeholder = t('Your nickname, e.g. @ali');
    q.autocomplete = 'off';
    q.addEventListener('input', () => { this.listSig = ''; this.renderList(); });
    find.append(q, el('button', 'btn-mini', '🔍'));
    find.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = this.game.findFollower(q.value);
      if (!c) { this.flash(t("{nick} doesn't live here yet", { nick: at(q.value.replace(/^@/, '').trim() || '?') }), 'warn'); sound.play('error'); return; }
      this.game.focusFollower(c);
      this.flash(t('🏠 Here is {nick}', { nick: at(c.fol!) }));
    });
    body.append(find);

    if (DEV) body.append(this.buildAdmin(q));

    this.list = el('div', 'fol-list');
    body.append(this.list);

    const tools = el('div', 'fol-tools');
    const tagBtn = button(`🏷️ ${t('Name tags')}`, () => { this.showTags = !this.showTags; tagBtn.classList.toggle('active', this.showTags); }, 'btn-mini active');
    tools.append(tagBtn, button(`🎬 ${t('Studio (filming)')}`, () => this.setStudio(true), 'btn-mini'));
    body.append(tools);
    this.panel.append(head, body);
    // the panel is not the game: clicks and keys stay in it
    for (const ev of ['pointerdown', 'wheel', 'keydown']) this.panel.addEventListener(ev, (e) => e.stopPropagation());
  }

  /** Adding followers and publishing the town: only on the owner's computer (the dev server). */
  private buildAdmin(find: HTMLInputElement) {
    const box = el('div', 'fol-admin');
    box.append(el('div', 'fol-sub', `🔒 ${t('Only you see this (your computer)')}`));
    const form = el('form', 'fol-add');
    const nick = el('input') as HTMLInputElement;
    nick.placeholder = t('Nickname (Instagram)');
    nick.autocomplete = 'off';
    nick.maxLength = 31;
    let sex: Sex = 'm';
    const sexRow = el('div', 'fol-sex');
    const boy = button(`👦 ${t('Male')}`, () => setSex('m'), 'btn-mini active');
    const girl = button(`👧 ${t('Female')}`, () => setSex('f'), 'btn-mini');
    boy.type = girl.type = 'button';
    const setSex = (s: Sex) => { sex = s; boy.classList.toggle('active', s === 'm'); girl.classList.toggle('active', s === 'f'); };
    const age = el('input') as HTMLInputElement;
    age.type = 'number';
    age.min = '1';
    age.max = '99';
    age.value = '20';
    age.title = t('Age');
    sexRow.append(boy, girl, age);
    const showLbl = el('label', 'fol-check');
    const show = el('input') as HTMLInputElement;
    show.type = 'checkbox';
    show.checked = true;
    showLbl.append(show, document.createTextNode(` 🎥 ${t('Show the move-in (camera flies there)')}`));
    const add = el('button', 'btn-mini primary fol-addbtn', `➕ ${t('Add follower')}`);
    form.append(nick, sexRow, showLbl, add);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.addOne(nick.value, sex, Number(age.value) || 20, show.checked)) { nick.value = ''; nick.focus(); find.value = ''; }
    });

    // many at once: one per line — "nick, m, 22" (m/f, boy/girl, yigit/qiz)
    const many = el('details', 'fol-many');
    many.append(el('summary', '', t('Add many at once')));
    const area = el('textarea') as HTMLTextAreaElement;
    area.placeholder = 'ali_007, m, 21\naziza.uz, f, 19\nsardor, m, 25';
    many.append(area, button(t('Add all'), () => {
      let n = 0;
      const bad: string[] = [];
      for (const line of area.value.split(/\n/)) {
        const [nk, sx, ag] = line.split(/[,;\t]/).map((x) => x.trim());
        if (!nk) continue;
        const s: Sex = /^(f|w|girl|qiz|ayol|female|q)/i.test(sx ?? '') ? 'f' : 'm';
        if (this.addOne(nk, s, Number(ag) || 18 + Math.floor(Math.random() * 12), false, true)) n++; else bad.push(nk);
      }
      area.value = bad.join('\n');
      this.flash(t('{n} followers are moving in', { n }) + (bad.length ? ` · ${t('{n} not added', { n: bad.length })}` : ''));
    }, 'btn-mini'));

    const acts = el('div', 'fol-acts');
    acts.append(
      button(`💾 ${t('Save')}`, () => this.game.save(true), 'btn-mini'),
      button(`⬆️ ${t('Push to GitHub')}`, async () => {
        this.game.save();
        this.status.textContent = t('Pushing to GitHub…');
        await new Promise((r) => setTimeout(r, 800));
        const r = await pushWorld(this.game.followerList().length);
        this.status.textContent = r.ok ? `✓ ${t('Pushed — the site updates in a minute')}` : `⚠ ${r.text.slice(0, 160)}`;
        this.status.className = `fol-status ${r.ok ? 'saved' : 'error'}`;
        sound.play(r.ok ? 'complete' : 'error');
      }, 'btn-mini'),
    );
    this.status = el('div', 'fol-status', t('Changes are saved into the project by themselves'));
    box.append(form, many, acts, this.status);
    return box;
  }

  /** Bring one follower to the town (false when they can't come). */
  private addOne(nickIn: string, sex: Sex, age: number, show: boolean, quiet = false) {
    const nick = nickIn.replace(/^@/, '').replace(/\s+/g, '').slice(0, 30);
    let home: Building | undefined;
    const r = this.game.addFollower(nick, sex, age, (c) => {
      this.fresh.set(c.fol!, performance.now() + 120_000);
      if (home && (show || !quiet)) this.game.celebrate(home);
      if (!quiet) this.flash(t('🎉 {nick} moved into their new home!', { nick: at(c.fol!) }), 'big');
      if (show) setTimeout(() => this.game.focusFollower(c, 4.5, false), 600);
      this.listSig = '';
      this.queueSave();
    });
    if (!r.ok) { if (!quiet) { this.flash(r.reason, 'warn'); sound.play('error'); } return false; }
    home = r.home;
    if (show) {
      const p = r.home.mesh.position;
      this.game.lookAt(p.x, p.z, 5.5, 1.8);
    }
    if (!quiet) this.flash(r.fresh ? t('🏗️ A house for {nick} is going up…', { nick: at(nick) }) : t('🔑 {nick} gets the keys to a house…', { nick: at(nick) }), 'big');
    this.listSig = '';
    return true;
  }

  private queueSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.game.save(), 1500);
  }

  private renderList() {
    const all = this.game.followerList();
    const q = (this.panel.querySelector('.fol-find input') as HTMLInputElement | null)?.value.replace(/^@/, '').trim().toLowerCase() ?? '';
    const shown = (q ? all.filter((c) => c.fol!.toLowerCase().includes(q)) : all).sort((a, b) => a.fol!.localeCompare(b.fol!));
    this.count.textContent = String(all.length + this.game.arrivingCount);
    const sig = `${q}|${shown.map((c) => `${c.id}:${c.family}`).join(',')}`;
    if (sig === this.listSig) return;
    this.listSig = sig;
    this.list.replaceChildren();
    if (!all.length) { this.list.append(el('div', 'fol-empty', DEV ? t('Nobody lives here yet — add the first follower') : t('Nobody lives here yet'))); return; }
    for (const c of shown.slice(0, 200)) {
      const info = this.game.followerInfo(c);
      const row = el('div', 'fol-row');
      const name = el('span', 'fol-nick', `${c.sex === 'f' ? '👧' : '👦'} ${at(info.nick)}`);
      const meta = el('span', 'fol-meta', `${info.age}${info.spouse ? ` · 💍 ${at(info.spouse)}` : ''}`);
      row.append(name, meta);
      row.addEventListener('click', () => this.game.focusFollower(c));
      if (DEV) row.append(button('✖', () => {
        if (!confirm(t('Take {nick} off the list? Their home stays empty.', { nick: at(info.nick) }))) return;
        this.game.removeFollower(info.nick);
        this.listSig = '';
        this.queueSave();
      }, 'btn-mini ghost fol-x'));
      this.list.append(row);
    }
    if (shown.length > 200) this.list.append(el('div', 'fol-empty', t('…and {n} more — search above', { n: shown.length - 200 })));
  }

  /** A message in the middle of the screen (it shows in the film too). */
  private flash(text: string, kind: 'big' | 'warn' | '' = '') {
    this.banner.textContent = text;
    this.banner.className = `fol-banner show ${kind}`;
    this.bannerT = kind === 'big' ? 4.5 : 3;
  }

  // ---------- name tags ----------

  private updateTags() {
    const game = this.game;
    const view = game.cam.viewHalf;
    const used = new Set<string>();
    if (this.showTags && view < 40) {
      const canvas = document.getElementById('game') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const cam = game.viewCamera;
      const now = performance.now();
      // people inside a building share one tag (the household at home, the staff at work)
      const groups = new Map<string, { x: number; y: number; z: number; nicks: string[]; inside: boolean; home: boolean; gold: boolean }>();
      for (const c of game.followerList()) {
        const p = game.followerPos(c);
        if (!p) continue;
        const inside = p.y > 0.42;
        const key = inside ? `b${c.at}` : `c${c.id}`;
        const gold = (this.fresh.get(c.fol!) ?? 0) > now;
        const g = groups.get(key);
        if (g) { g.nicks.push(c.fol!); g.gold ||= gold; }
        else groups.set(key, { x: p.x, y: p.y + (inside ? 0.1 : 0.32), z: p.z, nicks: [c.fol!], inside, home: p.home, gold });
      }
      // when the camera is far, only the households and the newest followers
      const far = view > 18;
      const size = Math.max(10, Math.min(15, 17 - view * 0.25));
      for (const [key, g] of groups) {
        if (far && !g.inside && !g.gold) continue;
        this.v.set(g.x, g.y, g.z).project(cam);
        if (this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) continue;
        const sx = rect.left + (this.v.x * 0.5 + 0.5) * rect.width;
        const sy = rect.top + (-this.v.y * 0.5 + 0.5) * rect.height;
        let d = this.tags.get(key);
        if (!d) { d = el('div', 'fol-tag'); this.tagLayer.append(d); this.tags.set(key, d); }
        const text = g.inside
          ? `${g.home ? '🏠' : '🏢'} ${g.nicks.slice(0, 2).map(at).join(' ')}${g.nicks.length > 2 ? ` +${g.nicks.length - 2}` : ''}`
          : at(g.nicks[0]);
        if (d.textContent !== text) d.textContent = text;
        d.className = `fol-tag${g.inside ? ' in' : ''}${g.gold ? ' gold' : ''}`;
        d.style.fontSize = `${size}px`;
        d.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
        used.add(key);
      }
    }
    for (const [key, d] of this.tags) if (!used.has(key)) { d.remove(); this.tags.delete(key); }
  }

  // ---------- studio (filming) ----------

  private buildStudio() {
    const frame = el('div', 'studio-frame');
    const title = el('div', 'studio-title');
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = localStorage.getItem(STUDIO_TITLE_KEY) ?? (INSTAGRAM
      ? t('Follow {name} — and your house appears in this town!', { name: at(INSTAGRAM) })
      : t('Follow — and your house appears in this town!'));
    title.addEventListener('input', () => localStorage.setItem(STUDIO_TITLE_KEY, title.textContent ?? ''));
    title.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
    this.counter = el('div', 'studio-count');
    this.caption = el('div', 'studio-caption');
    frame.append(title, this.counter, this.caption);

    this.bar = el('div', 'studio-bar');
    const toggle = (label: string, on: boolean, fn: (v: boolean) => void) => {
      const b = button(label, () => { const v = !b.classList.contains('active'); b.classList.toggle('active', v); fn(v); }, `btn-mini${on ? ' active' : ''}`);
      return b;
    };
    this.bar.append(
      toggle(`🎥 ${t('Auto tour')}`, true, (v) => { this.tour = v; this.tourT = 0; if (!v) this.caption.classList.remove('show'); }),
      toggle(`🏷️ ${t('Name tags')}`, true, (v) => { this.showTags = v; }),
      toggle(`📝 ${t('Title')}`, true, (v) => { title.style.display = v ? '' : 'none'; }),
      toggle(`👥 ${t('Counter')}`, true, (v) => { this.counter.style.display = v ? '' : 'none'; }),
      toggle(`📱 9:16`, false, (v) => { document.body.classList.toggle('portrait-916', v); window.dispatchEvent(new Event('resize')); }),
      button(`⏭ ${t('Next (T)')}`, () => this.tourNext(), 'btn-mini'),
      button(`⏹ ${t('Exit (Esc)')}`, () => this.setStudio(false), 'btn-mini ghost'),
    );
    this.bar.append(el('div', 'studio-hint', t('This bar hides by itself — move the mouse to see it. The title can be edited: click it.')));
    for (const ev of ['pointerdown', 'wheel']) this.bar.addEventListener(ev, (e) => e.stopPropagation());
    this.studio.append(frame, this.bar);
  }

  private setStudio(on: boolean) {
    this.studioOn = on;
    this.game.studio = on;
    document.body.classList.toggle('studio-mode', on);
    document.body.classList.toggle('photo-mode', on);
    if (!on) {
      document.body.classList.remove('portrait-916');
      for (const b of this.bar.querySelectorAll('button')) if (b.textContent === '📱 9:16') b.classList.remove('active');
      window.dispatchEvent(new Event('resize'));
      this.caption.classList.remove('show');
      this.game.clearSelection();
    } else {
      this.barT = 3;
      this.tourT = 0.8;
      this.tourStep = 0;
    }
  }

  /** The next shot of the tour: a follower up close (most of the time), or the whole town from above. */
  private tourNext() {
    const all = this.game.followerList();
    this.tourStep++;
    if (!all.length || this.tourStep % 5 === 1) {
      const c = this.game.townCentre();
      this.game.lookAt(c.x, c.z, 15, 3.2);
      this.showCaption(`🏙️ ${t('{n} people live here — every one a follower', { n: all.length })}`, '');
      this.tourT = 7;
      return;
    }
    // everyone in turn (shuffled), people out in the street first
    this.tourOrder = this.tourOrder.filter((n) => all.some((c) => c.fol === n));
    if (!this.tourOrder.length) this.tourOrder = all.map((c) => c.fol!).sort(() => Math.random() - 0.5);
    const outside = this.tourOrder.findIndex((n) => { const c = all.find((x) => x.fol === n); const p = c && this.game.followerPos(c); return !!p && p.y <= 0.42; });
    const nick = this.tourOrder.splice(outside >= 0 ? outside : 0, 1)[0];
    const c = all.find((x) => x.fol === nick)!;
    this.game.focusFollower(c, 4.2, true);
    const info = this.game.followerInfo(c);
    const sub = [
      t('{n} years old', { n: info.age }),
      info.work ? (info.student ? t('studies at the {place}', { place: info.work }) : t('works at the {place}', { place: info.work })) : '',
      info.spouse ? `💍 ${t('married to {nick}', { nick: at(info.spouse) })}` : '',
    ].filter(Boolean).join(' · ');
    this.showCaption(`${c.sex === 'f' ? '👧' : '👦'} ${at(info.nick)}`, `${sub}${sub ? '\n' : ''}${info.activity}`);
    this.tourT = 7.5;
  }

  private showCaption(head: string, sub: string) {
    this.caption.replaceChildren(el('div', 'cap-head', head), ...(sub ? [el('div', 'cap-sub', sub)] : []));
    this.caption.classList.remove('show');
    void this.caption.offsetWidth;
    this.caption.classList.add('show');
  }

  private update(dt: number) {
    this.updateTags();
    this.listT -= dt;
    if (this.listT <= 0) { this.listT = 1; this.renderList(); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('show'); }
    if (!this.studioOn) return;
    this.barT -= dt;
    this.bar.classList.toggle('hide', this.barT <= 0);
    const n = this.game.followerList().length;
    const txt = `👥 ${t('{n} followers live here', { n })}`;
    if (this.counter.textContent !== txt) this.counter.textContent = txt;
    // a slow turn around the town, like a drone
    this.game.cam.rotate(dt * 0.035, false);
    if (this.tour) {
      this.tourT -= dt;
      if (this.tourT <= 0) this.tourNext();
    }
  }
}


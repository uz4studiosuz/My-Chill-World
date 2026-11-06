import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Sex } from '../people/Population';
import type { Building } from '../buildings/Buildings';
import { BUILDINGS } from '../buildings/BuildingTypes';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';
import { DEV, SANDBOX, onSaveStatus, pushWorld, isAdmin, hasKey, tryAdmin, logout, newerExists, keepVideo } from './store';
import { Recorder } from './Recorder';

/** The page's Instagram name, shown in the film and to visitors (empty: not shown). */
export const INSTAGRAM = '';

const STUDIO_TITLE_KEY = 'mcw_studio_title';
const MARK_KEY = 'mcw_followers_marked';
const TEXTS_KEY = 'mcw_studio_texts';
type Texts = { counter: string; person: string; cta: string };
const PACE_KEY = 'mcw_showcase_pace';
/** The film shows at most this many marked followers (the newest). */
const MAX_SHOW = 20;
type Pace = 'normal' | 'fast' | 'turbo';
/** Seconds of each part of the "new in town" film: normal = home, then the person; fast ones = one shot each. */
const PACES: Record<Pace, { intro: number; home: number; each: number; view: number; fly: number; together: boolean; fireworks: boolean; outro: number }> = {
  normal: { intro: 2.8, home: 3.4, each: 7.4, view: 5, fly: 1.5, together: false, fireworks: true, outro: 3 },
  fast: { intro: 1.8, home: 3, each: 3, view: 5.5, fly: 0.9, together: true, fireworks: true, outro: 2.4 },
  turbo: { intro: 1.2, home: 1.8, each: 1.8, view: 6, fly: 0.6, together: true, fireworks: false, outro: 2 },
};
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
const FONT = '"Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif';

/** A name tag as drawn this frame (screen position relative to the game canvas). */
interface TagDraw { x: number; y: number; text: string; inside: boolean; gold: boolean; size: number }

/**
 * The followers' town page: name tags over every follower, a panel to find a follower's home (the admin also adds
 * followers and saves the town there), a studio mode for filming and an MP4 recorder.
 */
export class FollowersUi {
  private panel = el('div', 'fol-panel');
  private tagLayer = el('div', 'fol-tags');
  private studio = el('div', 'studio');
  private banner = el('div', 'fol-banner');
  private chip = el('button', 'fol-chip');
  private tags = new Map<string, HTMLDivElement>();
  private tagDraw: TagDraw[] = [];
  private fresh = new Map<string, number>();
  private v = new THREE.Vector3();
  private raf = 0;
  private last = performance.now();
  /** Time of this page (seconds), also when a video is rendered frame by frame. */
  private clock = 0;
  private listT = 0;
  private listSig = '';
  private bannerT = 0;
  private bannerAt = 0;
  private bannerKind = '';
  private captionAt = -99;
  private showTags = true;
  private studioOn = false;
  private tour = true;
  private tourT = 0;
  private tourStep = 0;
  private tourOrder: string[] = [];
  private barT = 0;
  private syncT = 0;
  private pollT = 60;
  private abort = new AbortController();
  private saveTimer = 0;
  private status?: HTMLDivElement;
  private list!: HTMLDivElement;
  private count!: HTMLSpanElement;
  private find!: HTMLInputElement;
  private title!: HTMLDivElement;
  private caption!: HTMLDivElement;
  private counter!: HTMLDivElement;
  private bar!: HTMLDivElement;
  private recBtn!: HTMLButtonElement;
  private portrait = false;
  private showTitle = true;
  private showCounter = true;
  private rec: Recorder | null = null;
  private recStart = 0;
  private recNext = 0;
  private recLive = false;
  /** Followers marked in the list: the "new in town" film shows them one by one. */
  private marked = new Set<string>(JSON.parse(localStorage.getItem(MARK_KEY) ?? '[]') as string[]);
  /** The film's own words (empty = the usual ones). */
  private texts: Texts = { counter: '', person: '', cta: '', ...(JSON.parse(localStorage.getItem(TEXTS_KEY) ?? '{}') as Partial<Texts>) };
  /** The "new in town" film playing now: its steps (seconds from the start). */
  private show: { steps: [number, () => void][]; t: number; i: number; recorded: boolean } | null = null;
  private markBtn!: HTMLButtonElement;
  private videoBtn?: HTMLButtonElement;
  private sub!: HTMLSpanElement;
  private tab: 'people' | 'add' | 'video' = 'people';
  private newest = true;
  /** A row of the list is being edited (the list waits). */
  private editing = false;
  /** The home lit up in the film carries its owner's name, wherever they are just then. */
  private homeTag?: { nick: string; x: number; y: number; z: number; until: number };
  private onlyMarked = false;
  private pace: Pace = (['normal', 'fast', 'turbo'].includes(localStorage.getItem(PACE_KEY) ?? '') ? localStorage.getItem(PACE_KEY) : 'fast') as Pace;
  private tourBtn!: HTMLButtonElement;
  private editBox!: HTMLDivElement;

  constructor(private game: Game) {
    this.buildPanel();
    this.buildStudio();
    // the name tags lie under the game's interface, the rest above it
    const ui = document.getElementById('ui');
    if (ui) ui.before(this.tagLayer); else document.body.append(this.tagLayer);
    this.chip.addEventListener('click', () => location.reload());
    document.body.append(this.panel, this.banner, this.chip, this.studio);
    document.body.classList.add('followers-town');
    const sig = this.abort.signal;
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Escape' && this.studioOn) { e.stopPropagation(); this.setStudio(false); }
      if (e.code === 'KeyT' && this.studioOn) this.tourNext();
      if (e.code === 'KeyR' && this.studioOn) void this.toggleRecording();
    }, { signal: sig, capture: true });
    window.addEventListener('mousemove', () => { this.barT = 2.5; }, { signal: sig });
    onSaveStatus((s, note) => {
      if (!this.status) return;
      this.status.textContent = s === 'saving' ? t('Saving…') : s === 'saved' ? `✓ ${t('Saved')} ${new Date().toLocaleTimeString()}` : `⚠ ${t('Could not save')}: ${note ?? ''}`;
      this.status.className = `fol-status ${s}`;
    });
    // the picture is read right after the game draws it
    this.game.afterRender = () => this.liveFrame();
    if (DEV) (window as unknown as Record<string, unknown>).__fui = this;
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
    this.rec?.cancel();
    this.rec = null;
    if (this.game.afterRender) this.game.afterRender = undefined;
    if (this.studioOn) this.setStudio(false);
    this.panel.remove();
    this.tagLayer.remove();
    this.banner.remove();
    this.chip.remove();
    this.studio.remove();
    document.body.classList.remove('followers-town');
  }

  // ---------- the panel ----------

  private buildPanel() {
    this.panel.replaceChildren();
    this.status = undefined;
    this.listSig = '';
    const admin = isAdmin() && !this.game.viewOnly;
    if (!admin && this.tab !== 'people') this.tab = 'people';

    // header: the town, how many live there, how many are marked
    const head = el('div', 'fol-head');
    const logo = el('div', 'fol-logo', '🏘️');
    const titles = el('div', 'fol-titles');
    titles.append(el('b', '', t("Followers' town")));
    this.sub = el('span', 'fol-subline', '');
    titles.append(this.sub);
    this.count = el('span', 'fol-count', '0');
    const fold = button('⌄', () => { this.panel.classList.toggle('folded'); }, 'fol-icon fol-fold');
    fold.title = t('Fold');
    head.append(logo, titles, this.count, fold);
    head.addEventListener('dblclick', () => this.panel.classList.toggle('folded'));

    // search (everyone); the admin key typed here lets the admin in
    const find = el('form', 'fol-search');
    const q = el('input') as HTMLInputElement;
    this.find = q;
    q.placeholder = t('Find a follower: @nickname');
    q.autocomplete = 'off';
    q.spellcheck = false;
    q.addEventListener('input', () => { this.listSig = ''; this.renderList(); });
    find.append(el('span', 'fol-search-ico', '⌕'), q);
    find.addEventListener('submit', (e) => { e.preventDefault(); void this.search(q.value); });

    const body = el('div', 'fol-body');
    body.append(find);

    // tabs (the admin): people · add · video
    const panes: Record<string, HTMLDivElement> = {};
    if (admin) {
      const tabs = el('div', 'fol-tabs');
      const tabBtns: HTMLButtonElement[] = [];
      for (const [id, label] of [['people', t('People')], ['add', t('Add')], ['video', t('Video')]] as const) {
        const b = button(label, () => { this.tab = id; for (const x of tabBtns) x.classList.toggle('on', x === b); for (const [k, p] of Object.entries(panes)) p.hidden = k !== id; }, `fol-tab${this.tab === id ? ' on' : ''}`);
        tabBtns.push(b);
        tabs.append(b);
      }
      body.append(tabs);
    }

    // people
    const people = el('div', 'fol-pane');
    panes.people = people;
    if (!admin) people.append(el('div', 'fol-promo', INSTAGRAM
      ? t('Follow {name} on Instagram — and your house appears in this town!', { name: at(INSTAGRAM) })
      : t('Everyone here is a real follower. Find your house!')));
    const bar = el('div', 'fol-listbar');
    const sortBtn = button(this.newest ? t('Newest first') : t('A–Z'), () => { this.newest = !this.newest; sortBtn.textContent = this.newest ? t('Newest first') : t('A–Z'); this.listSig = ''; this.renderList(); }, 'fol-chip2');
    sortBtn.title = t('Order');
    const onlyBtn = button(`☑ ${t('Marked')}`, () => { this.onlyMarked = !this.onlyMarked; onlyBtn.classList.toggle('on', this.onlyMarked); this.listSig = ''; this.renderList(); }, `fol-chip2${this.onlyMarked ? ' on' : ''}`);
    onlyBtn.title = t('Only the marked');
    bar.append(sortBtn);
    if (admin) {
      bar.append(
        onlyBtn,
        button(`+${MAX_SHOW} ${t('newest')}`, () => this.markNewest(), 'fol-chip2'),
        button(t('Clear'), () => { this.marked.clear(); this.saveMarks(); this.listSig = ''; this.renderList(); }, 'fol-chip2 ghost'),
      );
    }
    this.list = el('div', 'fol-list');
    people.append(bar, this.list);
    if (!admin) {
      const tools = el('div', 'fol-row-btns');
      const tagBtn = button(`🏷️ ${t('Name tags')}`, () => { this.showTags = !this.showTags; tagBtn.classList.toggle('on', this.showTags); }, `fol-btn${this.showTags ? ' on' : ''}`);
      tools.append(tagBtn);
      people.append(tools, el('div', 'fol-foot', `👀 ${t('Watching mode: the town lives on by itself — only its admin builds here')}`));
    }
    body.append(people);

    if (admin) {
      panes.add = this.buildAdmin();
      panes.video = this.buildVideoPane();
      body.append(panes.add, panes.video);
      for (const [k, p] of Object.entries(panes)) p.hidden = k !== this.tab;
    }

    this.panel.append(head, body);
    this.saveMarks();
    // the panel is not the game: clicks and keys stay in it
    for (const ev of ['pointerdown', 'wheel', 'keydown']) this.panel.addEventListener(ev, (e) => e.stopPropagation());
  }

  /** The video tab: how fast the marked are shown, the button that films them, the studio. */
  private buildVideoPane() {
    const pane = el('div', 'fol-pane');
    pane.append(el('div', 'fol-label', t('Pace of the "new in town" film')));
    const seg = el('div', 'fol-seg');
    const segBtns: HTMLButtonElement[] = [];
    for (const [id, label, note] of [['normal', t('Normal'), '≈7 s'], ['fast', t('Fast'), '≈3 s'], ['turbo', t('Very fast'), '≈1.8 s']] as const) {
      const b = button('', () => { this.pace = id; localStorage.setItem(PACE_KEY, id); for (const x of segBtns) x.classList.toggle('on', x === b); this.saveMarks(); }, `fol-seg-btn${this.pace === id ? ' on' : ''}`);
      b.append(el('b', '', label), el('small', '', `${note} / ${t('person')}`));
      segBtns.push(b);
      seg.append(b);
    }
    this.videoBtn = button('', () => void this.startShowcase(), 'fol-cta');
    const tools = el('div', 'fol-row-btns');
    const tagBtn = button(`🏷️ ${t('Name tags')}`, () => { this.showTags = !this.showTags; tagBtn.classList.toggle('on', this.showTags); }, `fol-btn${this.showTags ? ' on' : ''}`);
    tools.append(tagBtn, button(`🎬 ${t('Open the studio')}`, () => this.setStudio(true), 'fol-btn'));
    pane.append(seg, this.videoBtn, el('div', 'fol-hint', t('Up to {n} marked followers, newest first: each one is lit up at home with their name, then the call to follow. It is saved as an MP4 by itself (turn on 9:16 in the studio for Reels).', { n: MAX_SHOW })), tools);
    return pane;
  }

  /** Mark the newest followers (the film of who came lately). */
  private markNewest() {
    const newest = this.game.followerList().sort((a, b) => b.id - a.id).slice(0, MAX_SHOW);
    this.marked = new Set(newest.map((c) => c.fol!));
    this.saveMarks();
    this.listSig = '';
    this.renderList();
    this.flash(t('{n} newest followers marked', { n: newest.length }));
  }

  /** Build the panel again (the visitor became the admin, or the other way round). */
  refresh() { this.buildPanel(); }

  private async search(text: string) {
    const c = this.game.findFollower(text);
    if (c) {
      this.game.focusFollower(c);
      this.flash(t('🏠 Here is {nick}', { nick: at(c.fol!) }));
      return;
    }
    // not a follower: maybe the admin key (checked by the server, never kept in the game's files)
    const raw = text.trim();
    if (raw.length >= 6 && !/\s/.test(raw)) {
      const ok = await tryAdmin(raw);
      if (ok) {
        this.find.value = '';
        this.becomeAdmin();
        return;
      }
      if (ok === null && /[#!$%^&*]/.test(raw)) { this.flash(t('The server did not answer — try again'), 'warn'); return; }
    }
    this.flash(t("{nick} doesn't live here yet", { nick: at(raw.replace(/^@/, '') || '?') }), 'warn');
    sound.play('error');
  }

  private becomeAdmin() {
    this.game.setViewOnly(false);
    this.buildPanel();
    this.flash(`🔑 ${t('Admin mode: you can build and add followers — everything is saved for everyone')}`, 'big');
    sound.play('complete');
  }

  /** The add tab: one follower (nickname, boy/girl, age), many at once, saving. The admin only. */
  private buildAdmin() {
    const pane = el('div', 'fol-pane');
    const form = el('form', 'fol-card fol-add');
    const nick = el('input') as HTMLInputElement;
    nick.placeholder = t('Nickname (Instagram)');
    nick.autocomplete = 'off';
    nick.spellcheck = false;
    nick.maxLength = 31;
    let sex: Sex = 'm';
    const row = el('div', 'fol-addrow');
    const seg = el('div', 'fol-seg small');
    const boy = button(`👦 ${t('Male')}`, () => setSex('m'), 'fol-seg-btn on');
    const girl = button(`👧 ${t('Female')}`, () => setSex('f'), 'fol-seg-btn');
    boy.type = girl.type = 'button';
    seg.append(boy, girl);
    const setSex = (s: Sex) => { sex = s; boy.classList.toggle('on', s === 'm'); girl.classList.toggle('on', s === 'f'); };
    const ageBox = el('label', 'fol-age');
    const age = el('input') as HTMLInputElement;
    age.type = 'number';
    age.min = '1';
    age.max = '99';
    age.value = '20';
    ageBox.append(age, el('span', '', t('age')));
    row.append(seg, ageBox);
    const work = this.workSelect('');
    const showLbl = el('label', 'fol-check');
    const show = el('input') as HTMLInputElement;
    show.type = 'checkbox';
    show.checked = true;
    showLbl.append(show, el('span', '', t('Show the move-in (camera flies there)')));
    const add = el('button', 'fol-cta', `＋ ${t('Add follower')}`);
    form.append(nick, row, work, showLbl, add);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.addOne(nick.value, sex, Number(age.value) || 20, show.checked, false, work.value)) { nick.value = ''; nick.focus(); }
    });

    // many at once: one per line — "nick, m, 22" (m/f, boy/girl, yigit/qiz)
    const many = el('details', 'fol-card fol-many');
    many.append(el('summary', '', t('Add many at once')));
    const area = el('textarea') as HTMLTextAreaElement;
    area.placeholder = 'ali_007, m, 21\naziza.uz, f, 19\nsardor, m, 25';
    many.append(area, button(t('Add all'), () => {
      let n = 0;
      const bad: string[] = [];
      const twice: string[] = [];
      for (const line of area.value.split(/\n/)) {
        const [nk, sx, ag] = line.split(/[,;\t]/).map((x) => x.trim());
        if (!nk) continue;
        // already living here (or on their way): not added again
        if (this.game.hasFollower(nk)) { twice.push(at(nk.replace(/^@/, ''))); continue; }
        const s: Sex = /^(f|w|girl|qiz|ayol|female|q)/i.test(sx ?? '') ? 'f' : 'm';
        if (this.addOne(nk, s, Number(ag) || 18 + Math.floor(Math.random() * 12), false, true)) n++; else bad.push(line.trim());
      }
      area.value = bad.join('\n');
      this.flash([t('{n} followers are moving in', { n }),
        twice.length ? t('{n} already live here: {list}', { n: twice.length, list: twice.slice(0, 5).join(', ') + (twice.length > 5 ? '…' : '') }) : '',
        bad.length ? t('{n} not added', { n: bad.length }) : ''].filter(Boolean).join(' · '), twice.length || bad.length ? 'warn' : '', 5);
    }, 'fol-btn'));

    const acts = el('div', 'fol-row-btns');
    acts.append(button(`💾 ${t('Save')}`, () => this.game.save(true), 'fol-btn'));
    acts.append(button(`⬇ ${t('Download the list')}`, () => this.downloadList(), 'fol-btn'));
    if (DEV) acts.append(button(`⬆️ GitHub`, async () => {
      this.game.save(false, false, true);
      if (this.status) this.status.textContent = t('Pushing to GitHub…');
      await new Promise((r) => setTimeout(r, 800));
      const r = await pushWorld(this.game.followerList().length);
      if (this.status) {
        this.status.textContent = r.ok ? `✓ ${t('Pushed — the site updates in a minute')}` : `⚠ ${r.text.slice(0, 160)}`;
        this.status.className = `fol-foot fol-status ${r.ok ? 'saved' : 'error'}`;
      }
      sound.play(r.ok ? 'complete' : 'error');
    }, 'fol-btn'));
    if (hasKey()) acts.append(button(`🚪 ${t('Leave admin mode')}`, () => { logout(); location.reload(); }, 'fol-btn ghost'));
    this.status = el('div', 'fol-foot fol-status', SANDBOX ? `🧪 ${t('Rehearsal town: nothing is saved')}`
      : hasKey() ? `🔑 ${t('Everything is saved for everyone by itself (the site shows it at once)')}`
        : t('Saved into the project file. To save on the site too, type the admin key into the search box'));
    pane.append(form, many, acts, this.status);
    return pane;
  }

  /** The followers as a text file, one a line — "nickname, m/f, age" (the same lines "Add many" takes). */
  private downloadList() {
    const all = this.game.followerList().sort((a, b) => a.id - b.id);
    if (!all.length) { this.flash(t('Nobody lives here yet'), 'warn'); return; }
    const text = all.map((c) => `${c.fol}, ${c.sex}, ${Math.floor(c.age)}`).join('\r\n') + '\r\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = `followers-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    this.flash(t('{n} followers in the file', { n: all.length }));
  }

  /** Bring one follower to the town (false when they can't come). */
  private addOne(nickIn: string, sex: Sex, age: number, show: boolean, quiet = false, want?: string) {
    if (this.game.viewOnly) return false;
    const nick = nickIn.replace(/^@/, '').replace(/\s+/g, '').slice(0, 30);
    if (nick && this.game.hasFollower(nick)) {
      if (!quiet) { this.flash(t('@{nick} already lives here', { nick }), 'warn'); sound.play('error'); }
      return false;
    }
    let home: Building | undefined;
    const r = this.game.addFollower(nick, sex, age, (c) => {
      this.fresh.set(c.fol!, this.clock + 120);
      this.marked.add(c.fol!);
      this.saveMarks();
      if (home && (show || !quiet)) this.game.celebrate(home);
      if (!quiet) this.flash(t('🎉 {nick} moved into their new home!', { nick: at(c.fol!) }), 'big');
      if (show) setTimeout(() => this.game.focusFollower(c, 4.5, false), 600);
      this.listSig = '';
      this.queueSave();
    }, want);
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

  private saveMarks() {
    const live = new Set(this.game.followerList().map((c) => c.fol!));
    for (const n of this.marked) if (!live.has(n)) this.marked.delete(n);
    localStorage.setItem(MARK_KEY, JSON.stringify([...this.marked]));
    const n = Math.min(MAX_SHOW, this.marked.size);
    const label = `🌟 ${t('Show the marked ({n})', { n })}`;
    if (this.markBtn) this.markBtn.textContent = label;
    if (this.videoBtn) { this.videoBtn.textContent = label; this.videoBtn.disabled = !n; }
    if (this.sub) this.listSig = '';
  }

  private queueSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.game.save(false, false, true), 1500);
  }

  /** The work list: any (the town decides), none, or a kind of workplace (the town's own first). */
  private workSelect(value: string) {
    const sel = el('select', 'fol-select') as HTMLSelectElement;
    const opt = (v: string, label: string, parent: HTMLElement = sel) => { const o = el('option', '', label) as HTMLOptionElement; o.value = v; parent.append(o); };
    opt('', `💼 ${t('Work: any (the town decides)')}`);
    opt('none', `🏠 ${t("Doesn't work")}`);
    const choices = this.game.workChoices();
    const here = el('optgroup') as HTMLOptGroupElement;
    here.label = t('In the town');
    const later = el('optgroup') as HTMLOptGroupElement;
    later.label = t('Not built yet (works there once it is)');
    for (const ch of choices) opt(ch.kind, ch.name, ch.here ? here : later);
    if (here.children.length) sel.append(here);
    if (later.children.length) sel.append(later);
    sel.value = value;
    sel.addEventListener('keydown', (e) => e.stopPropagation());
    return sel;
  }

  /** The admin changes a follower right in the list: nickname, boy or girl, age, work. */
  private openEdit(nick: string, row: HTMLElement) {
    const c = this.game.followerList().find((x) => x.fol === nick);
    if (!c) return;
    this.editing = true;
    const card = el('form', 'fol-card fol-edit');
    const name = el('input') as HTMLInputElement;
    name.value = c.fol!;
    name.spellcheck = false;
    name.maxLength = 31;
    let sex: Sex = c.sex;
    const seg = el('div', 'fol-seg small');
    const boy = button(`👦 ${t('Male')}`, () => setSex('m'), `fol-seg-btn${sex === 'm' ? ' on' : ''}`);
    const girl = button(`👧 ${t('Female')}`, () => setSex('f'), `fol-seg-btn${sex === 'f' ? ' on' : ''}`);
    boy.type = girl.type = 'button';
    const setSex = (s: Sex) => { sex = s; boy.classList.toggle('on', s === 'm'); girl.classList.toggle('on', s === 'f'); };
    seg.append(boy, girl);
    const ageBox = el('label', 'fol-age');
    const age = el('input') as HTMLInputElement;
    age.type = 'number';
    age.min = '1';
    age.max = '99';
    age.value = String(Math.floor(c.age));
    ageBox.append(age, el('span', '', t('age')));
    const r2 = el('div', 'fol-addrow');
    r2.append(seg, ageBox);
    const work = this.workSelect(c.want ?? '');
    const btns = el('div', 'fol-row-btns');
    const save = el('button', 'fol-cta', t('Save')) as HTMLButtonElement;
    const close = () => { this.editing = false; this.listSig = ''; this.renderList(); };
    btns.append(save, button(t('Cancel'), close, 'fol-btn ghost'));
    card.append(name, r2, work, btns);
    for (const ev of ['click', 'pointerdown']) card.addEventListener(ev, (e) => e.stopPropagation());
    card.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    card.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = this.game.editFollower(c, { nick: name.value, sex, age: Number(age.value) || Math.floor(c.age), want: work.value });
      if (err) { this.flash(err, 'warn'); sound.play('error'); return; }
      if (c.fol !== nick) {
        if (this.marked.delete(nick)) { this.marked.add(c.fol!); this.saveMarks(); }
        const fr = this.fresh.get(nick);
        if (fr !== undefined) { this.fresh.delete(nick); this.fresh.set(c.fol!, fr); }
      }
      this.flash(t('{nick} was changed', { nick: at(c.fol!) }));
      this.queueSave();
      close();
    });
    row.replaceWith(card);
    name.focus();
  }

  private renderList() {
    if (this.editing) return;
    const all = this.game.followerList();
    const q = this.find?.value.replace(/^@/, '').trim().toLowerCase() ?? '';
    let shown = q ? all.filter((c) => c.fol!.toLowerCase().includes(q)) : all;
    if (this.onlyMarked) shown = shown.filter((c) => this.marked.has(c.fol!));
    shown = shown.sort((a, b) => (this.newest ? b.id - a.id : a.fol!.localeCompare(b.fol!)));
    const total = all.length + this.game.arrivingCount;
    this.count.textContent = String(total);
    this.sub.textContent = this.marked.size ? t('{n} live here · {m} marked', { n: total, m: this.marked.size }) : t('{n} live here', { n: total });
    const admin = isAdmin() && !this.game.viewOnly;
    const sig = `${admin}|${q}|${this.newest}|${this.onlyMarked}|${[...this.marked].join(',')}|${shown.map((c) => `${c.id}:${c.job}:${c.school}`).join(',')}`;
    if (sig === this.listSig) return;
    this.listSig = sig;
    this.list.replaceChildren();
    if (!shown.length) {
      this.list.append(el('div', 'fol-empty', !all.length ? (admin ? t('Nobody lives here yet — add the first follower') : t('Nobody lives here yet')) : t('Nobody found')));
      return;
    }
    for (const c of shown.slice(0, 200)) {
      const info = this.game.followerInfo(c);
      const row = el('div', `fol-row${this.marked.has(c.fol!) ? ' marked' : ''}`);
      const ava = el('span', `fol-ava ${c.sex === 'f' ? 'f' : 'm'}`, info.nick.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '@');
      const text = el('div', 'fol-text');
      const name = el('div', 'fol-nick', at(info.nick));
      if ((this.fresh.get(c.fol!) ?? -1) > this.clock) name.append(el('span', 'fol-new', t('new')));
      // the chosen work, and where they work until it is built (or has room)
      const wantName = c.want && c.want !== 'none' ? this.game.workChoices().find((w) => w.kind === c.want)?.name ?? '' : '';
      const wish = c.want === 'none' ? `🏠 ${t("Doesn't work")}` : wantName && info.work !== wantName ? `${info.work ? `${info.work} → ` : ''}🎯 ${wantName}` : '';
      text.append(name, el('div', 'fol-meta', [t('{n} years old', { n: info.age }), wish || info.work].filter(Boolean).join(' · ')));
      row.append(ava, text);
      row.addEventListener('click', () => this.game.focusFollower(c));
      if (admin) {
        const box = el('input') as HTMLInputElement;
        box.type = 'checkbox';
        box.className = 'fol-mark';
        box.checked = this.marked.has(c.fol!);
        box.title = t('Mark for the video');
        box.addEventListener('click', (e) => e.stopPropagation());
        box.addEventListener('change', () => {
          if (box.checked) this.marked.add(c.fol!); else this.marked.delete(c.fol!);
          row.classList.toggle('marked', box.checked);
          this.saveMarks();
        });
        const x = button('×', () => {
          if (!confirm(t('Take {nick} off the list? Their home is pulled down.', { nick: at(info.nick) }))) return;
          this.game.removeFollower(info.nick);
          this.listSig = '';
          this.queueSave();
        }, 'fol-icon fol-x');
        x.title = t('Remove');
        const edit = button('✎', () => this.openEdit(c.fol!, row), 'fol-icon fol-x fol-ed');
        edit.title = t('Edit');
        row.append(box, edit, x);
      }
      this.list.append(row);
    }
    if (shown.length > 200) this.list.append(el('div', 'fol-empty', t('…and {n} more — search above', { n: shown.length - 200 })));
  }

  /** A message in the middle of the screen (it shows in the film too). */
  flash(text: string, kind: 'big' | 'warn' | '' = '', seconds?: number) {
    this.banner.textContent = text;
    this.banner.className = `fol-banner show ${kind}`;
    this.bannerKind = kind;
    this.bannerAt = this.clock;
    this.bannerT = seconds ?? (kind === 'big' ? 4.5 : 3);
  }

  // ---------- name tags ----------

  private updateTags() {
    const game = this.game;
    const view = game.cam.viewHalf;
    const used = new Set<string>();
    this.tagDraw = [];
    if (this.showTags && view < 40) {
      const canvas = document.getElementById('game') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const cam = game.viewCamera;
      // people inside a building share one tag (the household at home, the staff at work)
      const groups = new Map<string, { x: number; y: number; z: number; nicks: string[]; inside: boolean; home: boolean; gold: boolean }>();
      for (const c of game.followerList()) {
        const p = game.followerPos(c);
        if (!p) continue;
        const inside = p.y > 0.42;
        const key = inside ? `b${c.at}` : `c${c.id}`;
        const gold = (this.fresh.get(c.fol!) ?? -1) > this.clock;
        const g = groups.get(key);
        if (g) { g.nicks.push(c.fol!); g.gold ||= gold; }
        else groups.set(key, { x: p.x, y: p.y + (inside ? 0.1 : 0.32), z: p.z, nicks: [c.fol!], inside, home: p.home, gold });
      }
      const ht = this.homeTag;
      if (ht && ht.until > this.clock) groups.set('spot', { x: ht.x, y: ht.y, z: ht.z, nicks: [ht.nick], inside: true, home: true, gold: true });
      // when the camera is far, only the households and the newest followers
      const far = view > 18;
      const size = Math.max(10, Math.min(15, 17 - view * 0.25));
      for (const [key, g] of groups) {
        if (far && !g.inside && !g.gold) continue;
        this.v.set(g.x, g.y, g.z).project(cam);
        if (this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) continue;
        const rx = (this.v.x * 0.5 + 0.5) * rect.width;
        const ry = (-this.v.y * 0.5 + 0.5) * rect.height;
        let d = this.tags.get(key);
        if (!d) { d = el('div', 'fol-tag'); this.tagLayer.append(d); this.tags.set(key, d); }
        const text = g.inside
          ? `${g.home ? '🏠' : '🏢'} ${g.nicks.slice(0, 2).map(at).join(' ')}${g.nicks.length > 2 ? ` +${g.nicks.length - 2}` : ''}`
          : at(g.nicks[0]);
        if (d.textContent !== text) d.textContent = text;
        d.className = `fol-tag${g.inside ? ' in' : ''}${g.gold ? ' gold' : ''}`;
        d.style.fontSize = `${size}px`;
        d.style.transform = `translate(${(rect.left + rx).toFixed(1)}px, ${(rect.top + ry).toFixed(1)}px) translate(-50%, -100%)`;
        this.tagDraw.push({ x: rx, y: ry, text, inside: g.inside, gold: g.gold, size });
        used.add(key);
      }
    }
    for (const [key, d] of this.tags) if (!used.has(key)) { d.remove(); this.tags.delete(key); }
  }

  // ---------- studio (filming) ----------

  private buildStudio() {
    const frame = el('div', 'studio-frame');
    const title = el('div', 'studio-title');
    this.title = title;
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
    this.recBtn = button(`⏺ ${t('Record MP4 (R)')}`, () => void this.toggleRecording(), 'btn-mini rec');
    this.markBtn = button(`🌟 ${t('Show the marked ({n})', { n: this.marked.size })}`, () => void this.startShowcase(), 'btn-mini primary');
    this.tourBtn = toggle(`🎥 ${t('Auto tour')}`, true, (v) => { this.tour = v; this.tourT = 0; if (!v) this.caption.classList.remove('show'); });
    this.editBox = this.buildTextEditor();
    this.bar.append(
      this.markBtn,
      this.recBtn,
      toggle(`✏️ ${t('Texts')}`, false, (v) => { this.editBox.style.display = v ? '' : 'none'; }),
      this.tourBtn,
      toggle(`🏷️ ${t('Name tags')}`, true, (v) => { this.showTags = v; }),
      toggle(`📝 ${t('Title')}`, true, (v) => { this.showTitle = v; title.style.display = v ? '' : 'none'; }),
      toggle(`👥 ${t('Counter')}`, true, (v) => { this.showCounter = v; this.counter.style.display = v ? '' : 'none'; }),
      toggle(`📱 9:16`, false, (v) => this.setPortrait(v)),
      button(`⏭ ${t('Next (T)')}`, () => this.tourNext(), 'btn-mini'),
      button(`⏹ ${t('Exit (Esc)')}`, () => this.setStudio(false), 'btn-mini ghost'),
    );
    this.bar.append(this.editBox);
    this.bar.append(el('div', 'studio-hint', `🌟 ${t('Mark followers in the list (the box in front of each name): this shows each one — their home, then them — and saves it as an MP4.')}`));
    this.bar.append(el('div', 'studio-hint', t('This bar hides by itself — move the mouse to see it. The title can be edited: click it. The MP4 has the picture, the title and the captions, without this bar.')));
    for (const ev of ['pointerdown', 'wheel']) this.bar.addEventListener(ev, (e) => e.stopPropagation());
    this.studio.append(frame, this.bar);
  }

  /** The film's words: the title, the line under it, the words for each person and the last words. */
  private buildTextEditor() {
    const box = el('div', 'studio-edit');
    box.style.display = 'none';
    const field = (label: string, value: string, placeholder: string, set: (v: string) => void) => {
      const l = el('label', '', label);
      const i = el('input') as HTMLInputElement;
      i.value = value;
      i.placeholder = placeholder;
      i.addEventListener('input', () => set(i.value));
      i.addEventListener('keydown', (e) => e.stopPropagation());
      l.append(i);
      return l;
    };
    const keep = () => localStorage.setItem(TEXTS_KEY, JSON.stringify(this.texts));
    box.append(
      field(t('Title'), this.title.textContent ?? '', '', (v) => { this.title.textContent = v; localStorage.setItem(STUDIO_TITLE_KEY, v); }),
      field(t('Line under the title ({n} = how many)'), this.texts.counter, `👥 ${t('{n} followers live here', { n: '{n}' })}`, (v) => { this.texts.counter = v; keep(); }),
      field(t('For each person ({nick} = the nickname)'), this.texts.person, this.personText('{nick}'), (v) => { this.texts.person = v; keep(); }),
      field(t('At the end'), this.texts.cta, this.ctaText(), (v) => { this.texts.cta = v; keep(); }),
    );
    return box;
  }

  private personText(nick: string) { return (this.texts.person || t('🎉 New in town: {nick}')).replace('{nick}', nick); }
  private ctaText() { return this.texts.cta || t('Follow and write your nickname in the comments — your house is next! 👇'); }

  /**
   * The "new in town" film: the town from above, then each marked follower — their home with fireworks, then
   * themselves with their card — and the call to follow at the end. It is recorded as an MP4 by itself.
   */
  async startShowcase() {
    const all = this.game.followerList();
    // the newest marked first, at most MAX_SHOW
    const picked = all.filter((c) => this.marked.has(c.fol!)).sort((a, b) => b.id - a.id);
    if (!picked.length) { this.flash(t('Mark followers in the list first (the box in front of each name)'), 'warn'); return; }
    const nicks = picked.slice(0, MAX_SHOW).map((c) => c.fol!);
    if (picked.length > MAX_SHOW) this.flash(t('Only the {n} newest of the marked are shown', { n: MAX_SHOW }));
    if (!this.studioOn) this.setStudio(true);
    this.tour = false;
    this.tourBtn.classList.remove('active');
    const recorded = !this.rec;
    if (recorded) await this.startRecording(true);
    const pace = PACES[this.pace];
    const steps: [number, () => void][] = [];
    const centre = (view = 13) => { const c = this.game.townCentre(); this.game.lookAt(c.x, c.z, view, 1.4); };
    steps.push([0, () => { centre(); this.hideCaption(); }]);
    let at0 = pace.intro;
    nicks.forEach((nick, i) => {
      const card = () => {
        const c = this.game.followerList().find((x) => x.fol === nick);
        if (!c) return;
        const info = this.game.followerInfo(c);
        const sub = [t('{n} years old', { n: info.age }), info.work].filter(Boolean).join(' · ');
        this.showCaption(`${c.sex === 'f' ? '👧' : '👦'} ${at(info.nick)}`, `${sub}${nicks.length > 1 ? `${sub ? '\n' : ''}${i + 1} / ${nicks.length}` : ''}`);
      };
      steps.push([at0, () => {
        const c = this.game.followerList().find((x) => x.fol === nick);
        const home = c && this.game.homeOf(c);
        // the home lit up (a golden ring and a beam), the name over it in gold, fireworks
        if (home) {
          this.game.lookAt(home.mesh.position.x, home.mesh.position.z, pace.view, pace.fly);
          this.game.spotlight(home, pace.home + 0.2);
          this.homeTag = { nick, x: home.mesh.position.x, y: 0.75 + BUILDINGS[home.kind].size * 0.35, z: home.mesh.position.z, until: this.clock + pace.home };
          if (pace.fireworks) this.game.celebrate(home);
        }
        this.fresh.set(nick, this.clock + pace.each);
        this.flash(this.personText(at(nick)), 'big', pace.home);
        if (pace.together) card(); else this.hideCaption();
      }]);
      // the normal pace then shows the person themselves
      if (!pace.together) steps.push([at0 + pace.home, () => { this.showFollower(nick, 4.2); }]);
      at0 += pace.each;
    });
    steps.push([at0, () => { centre(14); this.showCaption(`🏙️ ${t('{n} people live here — every one a follower', { n: this.game.followerList().length })}`, ''); }]);
    steps.push([at0 + pace.outro, () => { this.hideCaption(); this.flash(this.ctaText(), 'big', 4.5); }]);
    steps.push([at0 + pace.outro + 4.6, () => { this.show = null; if (recorded) void this.stopRecording(); }]);
    this.show = { steps, t: 0, i: 0, recorded };
  }

  setPortrait(v: boolean) {
    this.portrait = v;
    document.body.classList.toggle('portrait-916', v);
    for (const b of this.bar.querySelectorAll('button')) if (b.textContent === '📱 9:16') b.classList.toggle('active', v);
    window.dispatchEvent(new Event('resize'));
  }

  setStudio(on: boolean) {
    if (!on) this.show = null;
    if (!on && this.rec) void this.toggleRecording();
    this.studioOn = on;
    this.game.studio = on;
    document.body.classList.toggle('studio-mode', on);
    document.body.classList.toggle('photo-mode', on);
    if (!on) {
      this.setPortrait(false);
      this.caption.classList.remove('show');
      this.game.clearSelection();
    } else {
      this.barT = 3;
      this.tourT = 0.8;
      this.tourStep = 0;
    }
  }

  /** Studio options for a scripted film: the tour, the title and its text. */
  configure(o: { tour?: boolean; title?: string | null; counter?: boolean; tags?: boolean }) {
    if (o.tour !== undefined) { this.tour = o.tour; this.tourT = 0.5; }
    if (o.title !== undefined) { this.showTitle = o.title !== null; this.title.style.display = this.showTitle ? '' : 'none'; if (o.title) this.title.textContent = o.title; }
    if (o.counter !== undefined) { this.showCounter = o.counter; this.counter.style.display = o.counter ? '' : 'none'; }
    if (o.tags !== undefined) this.showTags = o.tags;
  }

  /** The next shot of the tour: a follower up close (most of the time), or the whole town from above. */
  tourNext() {
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
    this.showFollower(nick);
    this.tourT = 7.5;
  }

  /** Close-up of one follower with their caption. */
  showFollower(nick: string, view = 4.2) {
    const c = this.game.findFollower(nick);
    if (!c) return;
    this.game.focusFollower(c, view, true);
    const info = this.game.followerInfo(c);
    const sub = [
      t('{n} years old', { n: info.age }),
      info.work ? (info.student ? t('studies at the {place}', { place: info.work }) : t('works at the {place}', { place: info.work })) : '',
      info.spouse ? `💍 ${t('married to {nick}', { nick: at(info.spouse) })}` : '',
    ].filter(Boolean).join(' · ');
    this.showCaption(`${c.sex === 'f' ? '👧' : '👦'} ${at(info.nick)}`, `${sub}${sub ? '\n' : ''}${info.activity}`);
  }

  showCaption(head: string, sub: string) {
    this.caption.replaceChildren(el('div', 'cap-head', head), ...(sub ? [el('div', 'cap-sub', sub)] : []));
    this.caption.classList.remove('show');
    void this.caption.offsetWidth;
    this.caption.classList.add('show');
    this.captionAt = this.clock;
  }

  hideCaption() { this.caption.classList.remove('show'); }

  /** One step of the page (called every frame, or by a scripted film with a fixed step). */
  update(dt: number) {
    this.clock += dt;
    this.updateTags();
    this.listT -= dt;
    if (this.listT <= 0) { this.listT = 1; this.renderList(); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('show'); }
    // a visitor's clock keeps to the town's real time; now and then they hear of a newer town
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = 5; this.game.followersResync(); }
    if (this.game.viewOnly && !SANDBOX) {
      this.pollT -= dt;
      if (this.pollT <= 0) {
        this.pollT = 60;
        void newerExists().then((yes) => {
          if (!yes) return;
          this.chip.textContent = `🔄 ${t('The town was updated — new followers. Show')}`;
          this.chip.classList.add('show');
        });
      }
    }
    if (!this.studioOn) return;
    // the bar stays while its words are being edited
    if (this.editBox.contains(document.activeElement)) this.barT = 2.5;
    this.barT -= dt;
    this.bar.classList.toggle('hide', this.barT <= 0 && (!this.rec || !!this.show));
    const n = this.game.followerList().length;
    const txt = this.texts.counter ? this.texts.counter.replace('{n}', String(n)) : `👥 ${t('{n} followers live here', { n })}`;
    if (this.counter.textContent !== txt) this.counter.textContent = txt;
    // a slow turn around the town, like a drone
    this.game.cam.rotate(dt * 0.035, false);
    if (this.show) {
      const s = this.show;
      s.t += dt;
      while (this.show === s && s.i < s.steps.length && s.steps[s.i][0] <= s.t) s.steps[s.i++][1]();
    } else if (this.tour) {
      this.tourT -= dt;
      if (this.tourT <= 0) this.tourNext();
    }
    if (this.rec && this.recLive) {
      const s = Math.floor((performance.now() - this.recStart) / 1000);
      this.recBtn.textContent = `⏹ ${t('Stop')} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  // ---------- the MP4 recorder ----------

  /** Start a recording: 1080×1920 in 9:16, otherwise 1920×1080. `live` = from the screen as it plays. */
  async startRecording(live = true, fps = 30) {
    if (this.rec) return;
    const w = this.portrait ? 1080 : 1920, h = this.portrait ? 1920 : 1080;
    try {
      this.rec = await Recorder.create(w, h, fps);
    } catch (e) {
      this.flash(`⚠ ${(e as Error).message}`, 'warn');
      return;
    }
    // the game is drawn sharp enough for the video
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    const cropW = cw / ch > w / h ? ch * (w / h) : cw;
    this.game.setPixelRatio?.(Math.min(3, Math.max(1, w / cropW)));
    this.recLive = live;
    this.recStart = performance.now();
    this.recNext = 0;
    this.recBtn.classList.add('on');
  }

  async stopRecording(): Promise<string | null> {
    const rec = this.rec;
    if (!rec) return null;
    this.rec = null;
    this.recBtn.classList.remove('on');
    this.recBtn.textContent = `⏺ ${t('Record MP4 (R)')}`;
    this.game.setPixelRatio?.(undefined);
    if (!rec.frames) { rec.cancel(); return null; }
    this.flash(t('Making the MP4…'), '', 30);
    try {
      const blob = await rec.finish();
      const name = `my-chill-world-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp4`;
      const where = await keepVideo(blob, name);
      this.flash(`✓ ${t('Video saved')}: ${where}`, '', 6);
      sound.play('complete');
      return where;
    } catch (e) {
      this.flash(`⚠ ${(e as Error).message}`, 'warn', 6);
      return null;
    }
  }

  private async toggleRecording() {
    if (this.rec) await this.stopRecording();
    else await this.startRecording(true);
  }

  /** Live recording: right after the game drew its frame, at most 30 times a second. */
  private liveFrame() {
    if (!this.rec || !this.recLive) return;
    const ms = performance.now() - this.recStart;
    if (ms < this.recNext) return;
    this.recNext = Math.max(this.recNext + 1000 / this.rec.fps, ms - 1000 / this.rec.fps);
    if (this.rec.busy) return;
    try { this.rec.frame((ctx, w, h) => this.compose(ctx, w, h), ms * 1000); } catch (e) { console.warn('[rec]', e); void this.stopRecording(); }
  }

  /** A scripted film: one frame at this time (after the game was stepped and drawn). */
  async capture(timeSec: number) {
    if (!this.rec) return;
    this.rec.frame((ctx, w, h) => this.compose(ctx, w, h), timeSec * 1e6);
    if (this.rec.frames % 10 === 0) await this.rec.drain();
  }

  /** The video frame: the game's picture (filling the frame) with the tags, title, counter, caption and banner. */
  private compose(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    // the part of the screen that fills the video (cut in the middle)
    let cropW = cw, cropH = ch;
    if (cw / ch > W / H) cropW = ch * (W / H); else cropH = cw * (H / W);
    const cropX = (cw - cropW) / 2, cropY = (ch - cropH) / 2;
    const k = W / cropW;
    const dpr = canvas.width / cw;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(canvas, cropX * dpr, cropY * dpr, cropW * dpr, cropH * dpr, 0, 0, W, H);
    const u = Math.min(W, H) / 1080;

    // name tags
    for (const g of this.tagDraw) {
      const x = (g.x - cropX) * k, y = (g.y - cropY) * k;
      if (x < -50 || y < -20 || x > W + 50 || y > H + 50) continue;
      // the size in the video does not depend on how wide the window is
      const fs = g.size * 2.1 * u;
      ctx.font = `${g.inside ? 700 : 800} ${fs}px ${FONT}`;
      const tw = ctx.measureText(g.text).width, ph = fs * 1.45, pw = tw + fs * 1.0;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.3)';
      ctx.shadowBlur = fs * 0.4;
      ctx.shadowOffsetY = fs * 0.12;
      ctx.fillStyle = g.gold ? '#ffc65a' : g.inside ? 'rgba(28,36,31,.85)' : 'rgba(255,255,255,.94)';
      this.pill(ctx, x - pw / 2, y - ph, pw, ph, ph / 2);
      ctx.restore();
      ctx.fillStyle = g.gold ? '#3b2500' : g.inside ? '#fff' : '#1d2a22';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.text, x, y - ph / 2 + fs * 0.04);
    }

    if (this.studioOn) {
      // the title at the top, the counter under it
      let y = H * 0.05;
      if (this.showTitle && this.title.textContent) {
        const fs = 66 * u * (this.portrait ? 1 : 0.9);
        ctx.font = `900 ${fs}px ${FONT}`;
        const lines = this.wrap(ctx, this.title.textContent, W * 0.88);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (const line of lines) {
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,.55)';
          ctx.shadowBlur = fs * 0.35;
          ctx.shadowOffsetY = fs * 0.06;
          ctx.lineWidth = fs * 0.12;
          ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.strokeText(line, W / 2, y);
          ctx.fillStyle = '#fff';
          ctx.fillText(line, W / 2, y);
          ctx.restore();
          y += fs * 1.12;
        }
        y += fs * 0.25;
      }
      if (this.showCounter && this.counter.textContent) {
        const fs = 34 * u;
        ctx.font = `800 ${fs}px ${FONT}`;
        const tw = ctx.measureText(this.counter.textContent).width;
        ctx.fillStyle = 'rgba(255,255,255,.93)';
        this.pill(ctx, W / 2 - tw / 2 - fs * 0.7, y, tw + fs * 1.4, fs * 1.6, fs * 0.8);
        ctx.fillStyle = '#1d2a22';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.counter.textContent, W / 2, y + fs * 0.82);
      }
      // the caption of the follower in view
      if (this.caption.classList.contains('show')) {
        const a = Math.min(1, (this.clock - this.captionAt) / 0.45);
        const head = this.caption.querySelector('.cap-head')?.textContent ?? '';
        const sub = this.caption.querySelector('.cap-sub')?.textContent ?? '';
        ctx.save();
        ctx.globalAlpha = a;
        const lift = (1 - a) * 30 * u;
        const subFs = 30 * u, headFs = 58 * u;
        const subLines = sub ? sub.split('\n').flatMap((l) => { ctx.font = `700 ${subFs}px ${FONT}`; return this.wrap(ctx, l, W * 0.84); }) : [];
        let by = H * 0.91 + lift - subLines.length * subFs * 1.35 - (subLines.length ? subFs * 0.9 : 0);
        ctx.font = `900 ${headFs}px ${FONT}`;
        const hw = Math.min(W * 0.9, ctx.measureText(head).width + headFs * 0.9), hh = headFs * 1.5;
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 24 * u;
        ctx.fillStyle = '#fff';
        this.pill(ctx, W / 2 - hw / 2, by - hh, hw, hh, 22 * u);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#18231c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(head, W / 2, by - hh / 2 + headFs * 0.04, W * 0.86);
        if (subLines.length) {
          by += subFs * 0.6;
          ctx.font = `700 ${subFs}px ${FONT}`;
          const sw = Math.max(...subLines.map((l) => ctx.measureText(l).width)) + subFs * 1.2;
          const sh = subLines.length * subFs * 1.35 + subFs * 0.6;
          ctx.fillStyle = 'rgba(15,20,17,.66)';
          this.pill(ctx, W / 2 - sw / 2, by, sw, sh, 16 * u);
          ctx.fillStyle = '#fff';
          subLines.forEach((l, i) => ctx.fillText(l, W / 2, by + subFs * 0.3 + subFs * 1.35 * (i + 0.5)));
        }
        ctx.restore();
      }
    }

    // the banner (moving in, a wedding, the call to follow)
    if (this.bannerT > 0 && this.banner.textContent) {
      const a = Math.min(1, (this.clock - this.bannerAt) / 0.3, this.bannerT / 0.3);
      const big = this.bannerKind === 'big';
      const fs = (big ? 50 : 32) * u;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `800 ${fs}px ${FONT}`;
      const lines = this.wrap(ctx, this.banner.textContent, W * 0.8);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.6;
      const bh = lines.length * fs * 1.25 + fs * 0.9;
      const bx = W / 2 - bw / 2, by = H * (this.portrait || H > W ? 0.3 : 0.2) - (1 - a) * 12 * u;
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 30 * u;
      if (big) {
        const gr = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        gr.addColorStop(0, '#ffd666');
        gr.addColorStop(1, '#ff8c5a');
        ctx.fillStyle = gr;
      } else ctx.fillStyle = this.bannerKind === 'warn' ? 'rgba(120,40,30,.92)' : 'rgba(20,26,22,.88)';
      this.pill(ctx, bx, by, bw, bh, 26 * u);
      ctx.shadowBlur = 0;
      ctx.fillStyle = big ? '#2b1600' : '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, by + fs * 0.45 + fs * 1.25 * (i + 0.5)));
      ctx.restore();
    }
  }

  private pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
    ctx.fill();
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }
}

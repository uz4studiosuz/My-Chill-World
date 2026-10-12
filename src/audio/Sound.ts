/**
 * All sound is synthesised with WebAudio — no audio files to download.
 * Effects are short envelopes on oscillators / filtered noise; the music is a slow, generative pentatonic pad.
 */

export type SoundName =
  | 'click' | 'place' | 'build' | 'demolish' | 'error' | 'coin' | 'toast' | 'thunder' | 'complete' | 'achieve' | 'fire';

const KEY = 'mcw_audio';
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer = 0;
  private last = new Map<SoundName, number>();
  sfxOn = true;
  musicOn = true;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (typeof s.sfx === 'boolean') this.sfxOn = s.sfx;
      if (typeof s.music === 'boolean') this.musicOn = s.music;
    } catch { /* storage blocked */ }
  }

  /** Browsers only allow audio after a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.5 : 0;
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.12 : 0;
    this.musicGain.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.scheduleMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.5 : 0;
    this.store();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.12 : 0;
    this.store();
  }

  /** Mute everything (ads, hidden tab). */
  suspend(on: boolean) {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private store() {
    try { localStorage.setItem(KEY, JSON.stringify({ sfx: this.sfxOn, music: this.musicOn })); } catch { /* ignore */ }
  }

  play(name: SoundName) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // the same sound at most ~12 times a second
    if (now - (this.last.get(name) ?? -1) < 0.08) return;
    this.last.set(name, now);
    switch (name) {
      case 'click': this.tone(880, 0.05, 'triangle', 0.25, 660); break;
      case 'toast': this.tone(660, 0.08, 'sine', 0.2); this.tone(990, 0.1, 'sine', 0.16, undefined, 0.07); break;
      case 'place': this.thud(0.35); this.tone(220, 0.12, 'square', 0.12, 140); break;
      case 'build': this.thud(0.18); this.tone(520, 0.06, 'triangle', 0.15); break;
      case 'complete': [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.22, undefined, i * 0.08)); break;
      case 'achieve': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.12, undefined, i * 0.1)); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.12); this.tone(1319, 0.14, 'square', 0.12, undefined, 0.06); break;
      case 'demolish': this.noiseBurst(0.45, 500, 0.5); this.tone(110, 0.3, 'sawtooth', 0.12, 50); break;
      case 'error': this.tone(200, 0.12, 'square', 0.15, 150); this.tone(150, 0.16, 'square', 0.15, 110, 0.1); break;
      case 'thunder': this.noiseBurst(1.8, 300, 0.9); this.tone(60, 1.2, 'sine', 0.4, 35); break;
      case 'fire': this.noiseBurst(0.6, 1500, 0.25); break;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    const ctx = this.ctx!, t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxGain!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, cutoff: number, vol: number) {
    const ctx = this.ctx!, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxGain!);
    src.start(t0);
    src.stop(t0 + dur);
  }

  private thud(vol: number) {
    this.tone(140, 0.12, 'sine', vol, 60);
  }

  /** Soft generative music: a pad note and a few plucks every couple of seconds. */
  private scheduleMusic() {
    const ctx = this.ctx!;
    const step = () => {
      if (this.ctx && this.musicOn && ctx.state === 'running') {
        const root = 196; // G3
        const t0 = ctx.currentTime;
        const pad = SCALE[Math.floor(Math.random() * 4)];
        this.musicNote(root * Math.pow(2, pad / 12) / 2, t0, 3.6, 0.5, 'sine');
        for (let i = 0; i < 3; i++) {
          if (Math.random() < 0.35) continue;
          const n = SCALE[Math.floor(Math.random() * SCALE.length)];
          this.musicNote(root * Math.pow(2, n / 12), t0 + i * 0.8 + Math.random() * 0.2, 1.2, 0.35, 'triangle');
        }
      }
      this.musicTimer = window.setTimeout(step, 2800);
    };
    clearTimeout(this.musicTimer);
    step();
  }

  private musicNote(freq: number, t0: number, dur: number, vol: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.musicGain!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

export const sound = new SoundEngine();

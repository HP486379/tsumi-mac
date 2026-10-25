/**
 * WebAudio による合成サウンド（音声ファイル不要・軽量）。
 * BGM と効果音はそれぞれ ON/OFF 可能。AudioContext はユーザー操作後に生成する。
 */
export type SoundName = 'thud' | 'spawn' | 'rotate' | 'move' | 'clear' | 'combo' | 'money' | 'event' | 'gameover' | 'lock';

type Ctx = AudioContext;

export class AudioManager {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private nextNoteTime = 0;
  private lastPlay = new Map<SoundName, number>();
  seEnabled: boolean;
  bgmEnabled: boolean;
  /** 実際に鳴らした回数（テスト・検証用） */
  playedCount = 0;
  private bgmWanted = false;

  constructor(se = true, bgm = true) {
    this.seEnabled = se;
    this.bgmEnabled = bgm;
  }

  /** ユーザー操作のハンドラ内で呼ぶ */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.16;
      this.bgmGain.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  setSe(on: boolean): void {
    this.seEnabled = on;
  }

  setBgm(on: boolean): void {
    this.bgmEnabled = on;
    if (!on) this.stopBgmInternal();
    else if (this.bgmWanted) this.startBgm();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(name: SoundName, intensity = 1): void {
    if (!this.seEnabled) return;
    const now = performance.now();
    const last = this.lastPlay.get(name) ?? 0;
    const minGap = name === 'thud' ? 70 : name === 'move' ? 30 : 40;
    if (now - last < minGap) return;
    this.lastPlay.set(name, now);
    this.playedCount++;
    if (!this.ctx) return;
    const v = Math.max(0.05, Math.min(1, intensity));
    switch (name) {
      case 'thud':
        this.tone(140 + 40 * v, 0.09, 'sine', 0.35 * v, 0, 60);
        this.tone(320, 0.03, 'triangle', 0.08 * v);
        break;
      case 'lock':
        this.tone(220, 0.06, 'triangle', 0.12);
        break;
      case 'move':
        this.tone(660, 0.025, 'square', 0.03);
        break;
      case 'rotate':
        this.tone(880, 0.04, 'triangle', 0.06, 0, 1100);
        break;
      case 'spawn':
        this.tone(520, 0.05, 'sine', 0.06, 0, 700);
        break;
      case 'clear':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, i * 0.06));
        break;
      case 'combo':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, i * 0.05));
        break;
      case 'money':
        this.tone(1319, 0.08, 'square', 0.08);
        this.tone(1760, 0.22, 'square', 0.08, 0.08);
        break;
      case 'event':
        this.tone(440, 0.1, 'sine', 0.1);
        this.tone(660, 0.16, 'sine', 0.1, 0.1);
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.08, i * 0.18));
        break;
    }
  }

  // --- BGM：先読みスケジューリングによる軽量ループ ---
  private static readonly MELODY = [
    72, 0, 76, 0, 79, 76, 74, 0, 71, 0, 74, 0, 77, 74, 72, 0,
    69, 0, 72, 0, 76, 72, 71, 0, 67, 0, 71, 74, 72, 0, 0, 0,
  ];
  private static readonly BASS = [48, 48, 43, 43, 45, 45, 43, 43];

  startBgm(): void {
    this.bgmWanted = true;
    if (!this.bgmEnabled || !this.ctx || this.bgmTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 100);
  }

  stopBgm(): void {
    this.bgmWanted = false;
    this.stopBgmInternal();
  }

  private stopBgmInternal(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private scheduleBgm(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    const stepDur = 0.16;
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      const i = this.bgmStep % AudioManager.MELODY.length;
      const m = AudioManager.MELODY[i]!;
      const t = this.nextNoteTime;
      if (m > 0) this.note(m, stepDur * 0.9, 'triangle', 0.5, t);
      if (i % 4 === 0) {
        const b = AudioManager.BASS[(i / 4) % AudioManager.BASS.length]!;
        this.note(b, stepDur * 3.5, 'sine', 0.8, t);
      }
      this.nextNoteTime += stepDur;
      this.bgmStep++;
    }
  }

  private note(midi: number, dur: number, type: OscillatorType, vol: number, t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bgmGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  suspend(): void {
    this.stopBgmInternal();
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.bgmWanted && this.bgmEnabled) this.startBgm();
  }

  get isBgmPlaying(): boolean {
    return this.bgmTimer !== null;
  }
}

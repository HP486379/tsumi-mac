/**
 * ゲームエンジン層（ブラウザ用）。
 * requestAnimationFrame で描画し、物理は固定ステップ（60Hz）で進める。React の state は
 * HUD_INTERVAL_MS ごとにまとめて通知し、毎フレームは更新しない。
 */
import { HUD_INTERVAL_MS } from '../config';
import type { DeviceKind } from '../../data/devices';
import { GameSim, type GameMessage, type GameOverReason } from './GameSim';
import { FixedStepper } from './loop';
import { Renderer, type RenderState } from '../rendering/renderer';
import { FrameViews } from '../rendering/frameViews';
import { ObliqueRenderer } from '../rendering/obliqueRenderer';
import { AudioManager } from '../systems/audio';
import { actionForKey, type Action } from '../systems/input';
import type { ScoreSnapshot } from '../systems/scoring';
import type { SpawnTicket, GameEventType } from '../systems/spawner';

export interface HudState {
  score: ScoreSnapshot;
  next: SpawnTicket;
  dangerRatio: number;
  paused: boolean;
}

export interface EngineCallbacks {
  onHud: (h: HudState) => void;
  onMessage: (m: GameMessage) => void;
  onGameOver: (score: ScoreSnapshot, reason: GameOverReason) => void;
  onPauseChange: (paused: boolean) => void;
}

export interface EngineDebugApi {
  views: () => { front: RenderState | null; oblique: RenderState | null; obliqueFrames: number; synchronized: boolean };
  state: () => {
    status: string; paused: boolean; entities: number; active: string | null; activeState: string | null;
    q: number; score: ScoreSnapshot; danger: number; fps: number; steps: number; escaped: number;
    activeX: number | null; activeY: number | null; frames: number; audioPlayed: number; bgmPlaying: boolean;
  };
  forceNext: (kind: DeviceKind) => void;
  placeLocked: (kind: DeviceKind, col: number, row: number, quadrant?: number) => void;
  triggerEvent: (type: GameEventType) => void;
  setTimeScale: (n: number) => void;
  occupancy: () => number[];
}

export class GameEngine {
  sim: GameSim;
  private renderer: Renderer;
  private views: FrameViews;
  private oblique: ObliqueRenderer | null = null;
  private stepper = new FixedStepper();
  private raf = 0;
  private lastT = 0;
  private lastHud = 0;
  private paused = false;
  private destroyed = false;
  private timeScale = 1;
  private fps = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private overNotified = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly cb: EngineCallbacks,
    readonly audio: AudioManager,
    private readonly seed?: number,
  ) {
    this.renderer = new Renderer(canvas);
    this.views = new FrameViews(this.renderer);
    this.sim = this.createSim();
    this.onVisibility = this.onVisibility.bind(this);
    this.frame = this.frame.bind(this);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private createSim(): GameSim {
    this.overNotified = false;
    return new GameSim(
      {
        onMessage: (m) => this.cb.onMessage(m),
        onSound: (n, i) => this.audio.play(n, i),
        onGameOver: (reason) => {
          if (this.overNotified) return;
          this.overNotified = true;
          this.audio.stopBgm();
          this.emitHud(true);
          this.cb.onGameOver(this.sim.score(), reason);
        },
      },
      { seed: this.seed },
    );
  }

  start(): void {
    this.paused = false;
    this.lastT = performance.now();
    this.stepper.reset();
    this.audio.startBgm();
    this.emitHud(true);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  restart(): void {
    this.sim.destroy();
    this.sim = this.createSim();
    this.start();
  }

  private frame(t: number): void {
    if (this.destroyed) return;
    const dt = t - this.lastT;
    this.lastT = t;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1000) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    if (!this.paused && this.sim.status === 'running') {
      const steps = this.stepper.advance(dt) * this.timeScale;
      for (let i = 0; i < steps && this.sim.status === 'running'; i++) this.sim.step();
    }
    this.views.draw(this.sim.renderState());
    if (t - this.lastHud >= HUD_INTERVAL_MS) {
      this.lastHud = t;
      this.emitHud(false);
    }
    // 一時停止中・終了後は描画ループを止めて CPU を休ませる
    if (!this.paused && this.sim.status === 'running') this.raf = requestAnimationFrame(this.frame);
  }

  private lastHudKey = '';
  private emitHud(force: boolean): void {
    const score = this.sim.score();
    const next = this.sim.nextTicket();
    const danger = this.sim.danger.ratio;
    const key = `${Math.round(score.spent)}|${Math.round(score.fieldValue)}|${score.lines}|${score.level}|${next.kind}|${next.refurb}|${danger.toFixed(2)}|${this.paused}|${Math.floor(score.timeMs / 1000)}|${score.combo}`;
    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.cb.onHud({ score, next, dangerRatio: danger, paused: this.paused });
  }

  // ------------------------------------------------------------------ 一時停止
  get isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    if (this.paused || this.sim.status !== 'running') return;
    this.paused = true;
    this.sim.input.clear();
    cancelAnimationFrame(this.raf);
    this.audio.suspend();
    this.views.draw(this.sim.renderState());
    this.emitHud(true);
    this.cb.onPauseChange(true);
  }

  resume(): void {
    if (!this.paused || this.sim.status !== 'running') return;
    this.paused = false;
    this.lastT = performance.now();
    this.stepper.reset();
    this.audio.resume();
    this.emitHud(true);
    this.cb.onPauseChange(false);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** 画面非表示時はシミュレーションを停止 */
  private onVisibility(): void {
    if (document.visibilityState === 'hidden') this.pause();
  }

  // ------------------------------------------------------------------ 入力
  press(a: Action): void {
    if (a === 'pause') {
      this.togglePause();
      return;
    }
    if (this.paused) return;
    this.sim.press(a);
  }

  release(a: Action): void {
    this.sim.release(a);
  }

  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const a = actionForKey(e.code);
    if (!a) return false;
    if (down) {
      if (e.repeat) return true; // OS のキーリピートは使わず独自DAS
      this.press(a);
    } else {
      this.release(a);
    }
    return true;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.renderer.resize(cssW, cssH, dpr);
    this.views.draw(this.sim.renderState());
  }

  /** Optional rendering sink only; never starts a loop or another GameSim. */
  setObliqueView(canvas: HTMLCanvasElement | null, width = 400, height = 704, dpr = 1): void {
    this.oblique = canvas ? new ObliqueRenderer(canvas, this.renderer.sprites) : null;
    this.oblique?.resize(width, height, dpr);
    this.views.attach(this.oblique);
  }

  resizeOblique(width: number, height: number, dpr: number): void {
    this.oblique?.resize(width, height, dpr);
    if (this.oblique && this.views.lastState) this.oblique.draw(this.views.lastState);
  }

  // ------------------------------------------------------------------ デバッグ・検証用
  debugApi(): EngineDebugApi {
    return {
      views: () => ({ front: this.views.lastState, oblique: this.oblique?.lastState ?? null,
        obliqueFrames: this.oblique?.frames ?? 0, synchronized: !!this.oblique && this.oblique.lastState === this.views.lastState }),
      state: () => {
        const a = this.sim.active;
        return {
          status: this.sim.status,
          paused: this.paused,
          entities: this.sim.entities.size,
          active: a ? a.kind : null,
          activeState: a ? a.state : null,
          q: this.sim.rotationQuadrant,
          score: this.sim.score(),
          danger: this.sim.danger.elapsed,
          fps: this.fps,
          steps: this.sim.stepCount,
          escaped: this.sim.escaped,
          activeX: a ? a.body.position.x : null,
          activeY: a ? a.body.position.y : null,
          frames: this.renderer.frames,
          audioPlayed: this.audio.playedCount,
          bgmPlaying: this.audio.isBgmPlaying,
        };
      },
      forceNext: (kind) => this.sim.spawner.force(kind),
      placeLocked: (kind, col, row, quadrant = 0) => {
        this.sim.placeLocked(kind, col, row, quadrant);
      },
      triggerEvent: (type) => this.sim.announceEvent(type),
      setTimeScale: (n) => {
        this.timeScale = Math.max(1, Math.min(8, Math.round(n)));
      },
      occupancy: () => Array.from(this.sim.occupancy()),
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.views.attach(null);
    this.oblique = null;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.stopBgm();
    this.sim.destroy();
  }
}

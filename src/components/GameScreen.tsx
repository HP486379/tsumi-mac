import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine, type EngineDebugApi, type HudState } from '../game/engine/GameEngine';
import type { GameMessage } from '../game/engine/GameSim';
import type { AudioManager } from '../game/systems/audio';
import type { Settings } from '../game/systems/highscore';
import type { ScoreSnapshot } from '../game/systems/scoring';
import type { Action } from '../game/systems/input';
import { useStageSize } from '../hooks/useStageSize';
import { Hud } from './Hud';
import { CountHud } from './CountHud';
import { CountSim,type CountSnapshot } from '../game/count/CountSim';
import { saveCountPeak } from '../game/count/records';
import { TouchControls } from './TouchControls';
import { PauseOverlay } from './PauseOverlay';
import { boardForMode,obliqueViewport } from '../game/board';
import { physicsMode,type PlayMode } from '../data/playModes';

declare global {
  interface Window {
    __tsumimac?: EngineDebugApi;
  }
}

interface Props {
  mode?:PlayMode;
  audio: AudioManager;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onGameOver: (s: ScoreSnapshot,count?:CountSnapshot) => void;
  onTitle: () => void;
  seed?: number;
}

interface Toast { id: number; title: string; detail?: string; kind: GameMessage['kind'] }

export function GameScreen({ audio, settings, onSettings, onGameOver, onTitle, seed,mode='classic' }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const obliqueRef = useRef<HTMLCanvasElement>(null);
  const obliqueSurfaceRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [collapse, setCollapse] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [obliqueOpen, setObliqueOpen] = useState(() => window.matchMedia('(min-width: 1000px) and (min-height: 560px)').matches);
  const toastId = useRef(0);
  const board=boardForMode(physicsMode(mode)),view=obliqueViewport(board);
  const size = useStageSize(stageRef,board);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const pushToast = useCallback((m: GameMessage) => {
    // イベント・散財のみHTMLトーストで短く表示（行消し・コンボはキャンバス上に表示）
    if (m.kind !== 'event' && m.kind !== 'spend' && m.kind !== 'level') return;
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, title: m.title, detail: m.detail, kind: m.kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let overTimer = 0;
    const engine = new GameEngine(
      canvas,
      {
        onHud: setHud,
        onMessage: pushToast,
        onPauseChange: setPaused,
        onGameOver: (score,_reason,count) => {
          setCollapse(true);
          overTimer = window.setTimeout(() => onGameOverRef.current(score,count), 1600);
        },
      },
      audio,
      seed,
      mode,
    );
    engineRef.current = engine;
    window.__tsumimac = engine.debugApi();
    engine.start();

    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      // ポーズ中のボタン操作（Space/Enter）を妨げない
      if (engine.isPaused && e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (engine.handleKey(e, true)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (engine.handleKey(e, false)) e.preventDefault();
    };
    const onBlur = () => { engine.release('fine'); engine.pause(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.clearTimeout(overTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      engine.destroy();
      engineRef.current = null;
      if (window.__tsumimac) delete window.__tsumimac;
    };
  }, [audio, pushToast, seed,mode]);

  useEffect(() => {
    engineRef.current?.resize(size.width, size.height, size.dpr);
  }, [size]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1000px) and (min-height: 560px)');
    const change = () => setObliqueOpen(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    const canvas = obliqueRef.current;
    const surface = obliqueSurfaceRef.current;
    if (!engine || !canvas || !surface) return;
    if (!obliqueOpen) { engine.setObliqueView(null); return; }
    const rect = surface.getBoundingClientRect();
    engine.setObliqueView(canvas, rect.width, rect.height, window.devicePixelRatio || 1);
    const resize = () => {
      const r = surface.getBoundingClientRect();
      engine.resizeOblique(r.width, r.height, window.devicePixelRatio || 1);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); engine.setObliqueView(null); };
  }, [obliqueOpen, audio, pushToast, seed,mode]);

  const press = useCallback((a: Action) => {
    audio.unlock();
    engineRef.current?.press(a);
  }, [audio]);
  const release = useCallback((a: Action) => engineRef.current?.release(a), []);
  const leave=()=>{const sim=engineRef.current?.sim;if(sim instanceof CountSim)saveCountPeak(sim.count().peak);onTitle();};

  return (
    <main className="game-screen" data-testid="game-screen" data-mode={mode}>
      {mode==='count'?<CountHud hud={hud} onPause={()=>engineRef.current?.pause()}/>:<Hud hud={hud} mode={mode} onPause={() => engineRef.current?.pause()} />}
      <div className="stage" ref={stageRef}>
        <div className="canvas-wrap" style={{ width: size.width, height: size.height }}>
          <canvas
            ref={canvasRef}
            className="game-canvas"
            data-testid="game-canvas"
            style={{ width: size.width, height: size.height }}
            aria-label="ゲームフィールド"
          />
          <div className="toasts" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.kind}`} data-testid="toast">
                <strong>{t.title}</strong>
                {t.detail && <span>{t.detail}</span>}
              </div>
            ))}
          </div>
          {collapse && (
            <div className="collapse-overlay" data-testid="collapse-overlay">
              <span>{mode==='count'?'積載チャレンジ終了':'積みMac崩壊'}</span>
            </div>
          )}
        </div>
      </div>
      <aside className="side-panel">
        <details className="oblique-panel" open={obliqueOpen} onToggle={e => setObliqueOpen(e.currentTarget.open)} data-testid="oblique-panel">
          <summary aria-controls="oblique-content" onKeyDown={e => {
            // Native details activation must not also hard-drop the game.
            if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation();
          }} onKeyUp={e => {
            if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation();
          }}>斜めビュー <span>LIVE / 閲覧専用</span></summary>
          <div id="oblique-content">
            <div className="oblique-surface" style={{aspectRatio: `${view.width} / ${view.height}`}} ref={obliqueSurfaceRef}>
              <canvas ref={obliqueRef} className="oblique-canvas" data-testid="oblique-canvas" aria-label="正面と同期した斜めビュー（閲覧専用）" />
              {collapse && <div className="oblique-status" data-testid="oblique-over">{mode==='count'?'出現場所が塞がりました':'積みMac崩壊'}</div>}
            </div>
            <p className="oblique-note">同じ状態を別の角度から表示。接触位置・操作は正面ビューで確認してください。</p>
          </div>
        </details>
        <div className="operation-guide">
        {mode==='count'&&<p className="count-rules">行消しなし。崩れても続行！ 赤線は終了条件ではありません。出現場所が3秒間塞がると終了します。</p>}
        <h3>操作</h3>
        <ul className="key-help">
          <li><kbd>←</kbd><kbd>→</kbd> 36px移動（長押し可） / <kbd>Shift</kbd>＋左右 1px微調整</li>
          <li><kbd>↑</kbd>/<kbd>X</kbd> 右回転 <kbd>Z</kbd> 左回転</li>
          <li><kbd>↓</kbd> 高速落下 <kbd>Space</kbd> ハードドロップ</li>
          <li><kbd>P</kbd>/<kbd>Esc</kbd> 一時停止</li>
        </ul>
        <p className="combo-line" data-testid="hud-combo">
          {mode==='count'?'固定されたMacを1台ずつ計測':<>コンボ {hud?.score.combo ?? 0} / 最大 {hud?.score.maxCombo ?? 0}</>}
        </p>
        </div>
      </aside>
      <TouchControls onPress={press} onRelease={release} hardDrop={mode==='count'} />
      {paused && !collapse && (
        <PauseOverlay
          settings={settings}
          onSettings={onSettings}
          onResume={() => {
            audio.unlock();
            engineRef.current?.resume();
          }}
          onRestart={() => {
            setPaused(false);
            engineRef.current?.restart();
          }}
          onTitle={leave}
        />
      )}
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine, type EngineDebugApi, type HudState } from '../game/engine/GameEngine';
import type { GameMessage } from '../game/engine/GameSim';
import type { AudioManager } from '../game/systems/audio';
import type { Settings } from '../game/systems/highscore';
import type { ScoreSnapshot } from '../game/systems/scoring';
import type { Action } from '../game/systems/input';
import { useStageSize } from '../hooks/useStageSize';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { PauseOverlay } from './PauseOverlay';

declare global {
  interface Window {
    __tsumimac?: EngineDebugApi;
  }
}

interface Props {
  audio: AudioManager;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onGameOver: (s: ScoreSnapshot) => void;
  onTitle: () => void;
  seed?: number;
}

interface Toast { id: number; title: string; detail?: string; kind: GameMessage['kind'] }

export function GameScreen({ audio, settings, onSettings, onGameOver, onTitle, seed }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [collapse, setCollapse] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const size = useStageSize(stageRef);
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
        onGameOver: (score) => {
          setCollapse(true);
          overTimer = window.setTimeout(() => onGameOverRef.current(score), 1600);
        },
      },
      audio,
      seed,
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
    const onBlur = () => engine.pause();
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
  }, [audio, pushToast, seed]);

  useEffect(() => {
    engineRef.current?.resize(size.width, size.height, size.dpr);
  }, [size]);

  const press = useCallback((a: Action) => {
    audio.unlock();
    engineRef.current?.press(a);
  }, [audio]);
  const release = useCallback((a: Action) => engineRef.current?.release(a), []);

  return (
    <main className="game-screen" data-testid="game-screen">
      <Hud hud={hud} onPause={() => engineRef.current?.pause()} />
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
              <span>積みMac崩壊</span>
            </div>
          )}
        </div>
      </div>
      <aside className="side-panel">
        <h3>操作</h3>
        <ul className="key-help">
          <li><kbd>←</kbd><kbd>→</kbd> 移動</li>
          <li><kbd>↑</kbd>/<kbd>X</kbd> 右回転 <kbd>Z</kbd> 左回転</li>
          <li><kbd>↓</kbd> 高速落下 <kbd>Space</kbd> ハードドロップ</li>
          <li><kbd>P</kbd>/<kbd>Esc</kbd> 一時停止</li>
        </ul>
        <p className="combo-line" data-testid="hud-combo">
          コンボ {hud?.score.combo ?? 0} / 最大 {hud?.score.maxCombo ?? 0}
        </p>
      </aside>
      <TouchControls onPress={press} onRelease={release} />
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
          onTitle={onTitle}
        />
      )}
    </main>
  );
}

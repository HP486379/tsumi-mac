import { useEffect, useRef } from 'react';
import { DEVICES, formatYen } from '../data/devices';
import type { HudState } from '../game/engine/GameEngine';
import { drawPreview } from '../game/rendering/renderer';
import { deviceCells,type GameMode } from '../data/gameModes';

export function Hud({ hud, onPause,mode='classic' }: { hud: HudState | null; onPause: () => void;mode?:GameMode }) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const nextKind = hud?.next.kind;
  const nextRefurb = hud?.next.refurb ?? false;
  useEffect(() => {
    const c = previewRef.current;
    if (!c || !nextKind) return;
    const d = deviceCells(nextKind,mode);
    drawPreview(c, { ...(mode==='real'?{mode}:{}),kind: nextKind, wCells: d.w, hCells: d.h, refurb: nextRefurb, cutTop: false, cutBottom: false }, window.devicePixelRatio || 1);
  }, [nextKind, nextRefurb,mode]);

  const s = hud?.score;
  return (
    <section className="hud" data-testid="hud" aria-label="スコア">
      <div className="hud-item spent">
        <span className="hud-label">散財総額</span>
        <span className="hud-value" data-testid="hud-spent">{formatYen(s?.spent ?? 0)}</span>
      </div>
      <div className="hud-item index">
        <span className="hud-label">積みMac指数</span>
        <span className="hud-value" data-testid="hud-index">{formatYen(s?.fieldValue ?? 0)}</span>
      </div>
      <div className="hud-item small lv">
        <span className="hud-label">{mode==='real'?<span data-testid="game-mode">実寸モード / レベル</span>:'レベル'}</span>
        <span className="hud-value" data-testid="hud-level">{s?.level ?? 1}</span>
      </div>
      <div className="hud-item small lines">
        <span className="hud-label">整理行数</span>
        <span className="hud-value" data-testid="hud-lines">{s?.lines ?? 0}</span>
      </div>
      <div className="hud-item next">
        <span className="hud-label">NEXT</span>
        <canvas ref={previewRef} className="next-canvas" width={80} height={64} aria-hidden="true" />
        <span className="next-name" data-testid="hud-next">
          {nextKind ? DEVICES[nextKind].name : '-'}
          {nextRefurb ? '（整備済）' : ''}
        </span>
      </div>
      <button type="button" className="btn pause-btn" data-testid="pause-button" aria-label="一時停止" onClick={onPause}>
        ❚❚
      </button>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { DEVICES, formatYen } from '../data/devices';
import type { HudState } from '../game/engine/GameEngine';
import { drawPreview } from '../game/rendering/renderer';
import { deviceCells,type GameMode } from '../data/gameModes';

export function Hud({ hud, onPause,mode='classic',countBest }: { hud: HudState | null; onPause: () => void;mode?:GameMode;countBest?:number }) {
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
        <span className="hud-label">{countBest!==undefined?'現在積載台数':'散財総額'}</span>
        <span className="hud-value" data-testid={countBest!==undefined?'count-current':'hud-spent'}>{countBest!==undefined?`${hud?.count?.current??0}台`:formatYen(s?.spent ?? 0)}</span>
      </div>
      <div className="hud-item index">
        <span className="hud-label">{countBest!==undefined?'今回の最高積載台数':'積みMac指数'}</span>
        <span className="hud-value" data-testid={countBest!==undefined?'count-peak':'hud-index'}>{countBest!==undefined?`${hud?.count?.peak??0}台`:formatYen(s?.fieldValue ?? 0)}</span>
      </div>
      <div className="hud-item small lv">
        <span className="hud-label">{countBest!==undefined?'歴代最高':mode==='real'?<span data-testid="game-mode">実寸540×900 / レベル</span>:'レベル'}</span>
        <span className="hud-value" data-testid={countBest!==undefined?'count-best':'hud-level'}>{countBest!==undefined?`${countBest}台`:s?.level ?? 1}</span>
      </div>
      <div className="hud-item small lines">
        <span className="hud-label">{countBest!==undefined?'出現待機':'整理行数'}</span>
        <span className="hud-value" data-testid={countBest!==undefined?'count-wait':'hud-lines'}>{countBest!==undefined?`${(hud?.count?.blockedSeconds??0).toFixed(1)} / 3秒`:s?.lines ?? 0}</span>
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

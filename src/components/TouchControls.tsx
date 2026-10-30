import type { PointerEvent as RPointerEvent } from 'react';
import type { Action } from '../game/systems/input';

interface Props {
  onPress: (a: Action) => void;
  onRelease: (a: Action) => void;
  hardDrop?:boolean;
}

interface Btn { action: Action; label: string; aria: string; testId: string }

const LEFT: Btn[] = [
  { action: 'left', label: '◀', aria: '左移動', testId: 'touch-left' },
  { action: 'right', label: '▶', aria: '右移動', testId: 'touch-right' },
];
const RIGHT: Btn[] = [
  { action: 'rotateR', label: '⟳', aria: '回転', testId: 'touch-rotate' },
  { action: 'soft', label: '▼', aria: '高速落下', testId: 'touch-soft' },
];

/** タッチ操作ボタン。pointer イベントで押下・解放を扱い、スクロールやズームを抑止する */
export function TouchControls({ onPress, onRelease,hardDrop=false }: Props) {
  const handlers = (a: Action) => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      onPress(a);
    },
    onPointerUp: (e: RPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onRelease(a);
    },
    onPointerCancel: () => onRelease(a),
    onLostPointerCapture: () => onRelease(a),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  });
  const render = (b: Btn) => (
    <button key={b.testId} type="button" className={`touch-btn ${b.action}`} aria-label={b.aria} data-testid={b.testId} {...handlers(b.action)}>
      {b.label}
    </button>
  );
  return (
    <>
      <div className="touch-group cl" data-testid="touch-left-group">{LEFT.map(render)}</div>
      <div className="touch-group cr" data-testid="touch-right-group">
        {RIGHT.map(render)}
        {hardDrop&&render({action:'hard',label:'⤓',aria:'ハードドロップ',testId:'touch-hard'})}
        <button
          type="button"
          className="touch-btn pause small"
          aria-label="一時停止"
          data-testid="touch-pause"
          onPointerDown={(e: RPointerEvent<HTMLButtonElement>) => {
            e.preventDefault();
            onPress('pause');
          }}
        >
          ❚❚
        </button>
      </div>
    </>
  );
}

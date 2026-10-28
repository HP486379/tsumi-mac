import { useEffect, useState, type RefObject } from 'react';
import { CLASSIC_BOARD,type BoardSpec } from '../game/board';

export interface StageSize { width: number; height: number; dpr: number }

/** モードの論理盤面全体をステージ内へ同率で収める（リサイズ・画面回転に追従）。 */
export function useStageSize(ref: RefObject<HTMLElement | null>,board:Readonly<BoardSpec>=CLASSIC_BOARD): StageSize {
  const [size, setSize] = useState<StageSize>({ width: board.width, height: board.height, dpr: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const k = Math.max(0.2, Math.min(r.width / board.width, r.height / board.height));
        const width = Math.floor(board.width * k);
        const height = Math.floor(board.height * k);
        const dpr = window.devicePixelRatio || 1;
        setSize((prev) => (prev.width === width && prev.height === height && prev.dpr === dpr ? prev : { width, height, dpr }));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [ref,board]);
  return size;
}

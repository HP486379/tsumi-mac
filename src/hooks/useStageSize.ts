import { useEffect, useState, type RefObject } from 'react';
import { FIELD_H, FIELD_W } from '../game/config';

export interface StageSize { width: number; height: number; dpr: number }

/** ステージ要素に収まる最大の 360:648 サイズを求める（リサイズ・画面回転に追従） */
export function useStageSize(ref: RefObject<HTMLElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>({ width: FIELD_W, height: FIELD_H, dpr: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const k = Math.max(0.2, Math.min(r.width / FIELD_W, r.height / FIELD_H));
        const width = Math.floor(FIELD_W * k);
        const height = Math.floor(FIELD_H * k);
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
  }, [ref]);
  return size;
}

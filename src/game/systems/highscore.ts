/** ハイスコア・設定の localStorage 永続化 */
import type { ScoreSnapshot } from './scoring';

export interface HighScore {
  bestSpent: number;
  bestLines: number;
  bestCleared: number;
  bestMaxCombo: number;
  plays: number;
}

export interface Settings { bgm: boolean; se: boolean }

const HS_KEY = 'tsumimac.highscore.v1';
const SETTINGS_KEY = 'tsumimac.settings.v1';

export const EMPTY_HIGHSCORE: HighScore = { bestSpent: 0, bestLines: 0, bestCleared: 0, bestMaxCombo: 0, plays: 0 };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadHighScore(store: StorageLike | null = storage()): HighScore {
  try {
    const raw = store?.getItem(HS_KEY);
    if (!raw) return { ...EMPTY_HIGHSCORE };
    const v = JSON.parse(raw) as Partial<HighScore>;
    return {
      bestSpent: Number(v.bestSpent) || 0,
      bestLines: Number(v.bestLines) || 0,
      bestCleared: Number(v.bestCleared) || 0,
      bestMaxCombo: Number(v.bestMaxCombo) || 0,
      plays: Number(v.plays) || 0,
    };
  } catch {
    return { ...EMPTY_HIGHSCORE };
  }
}

/** 結果を反映して保存。新記録の項目名を返す */
export function submitResult(s: ScoreSnapshot, store: StorageLike | null = storage()): { hs: HighScore; newRecord: boolean } {
  const prev = loadHighScore(store);
  const hs: HighScore = {
    bestSpent: Math.max(prev.bestSpent, Math.round(s.spent)),
    bestLines: Math.max(prev.bestLines, s.lines),
    bestCleared: Math.max(prev.bestCleared, Math.round(s.cleared)),
    bestMaxCombo: Math.max(prev.bestMaxCombo, s.maxCombo),
    plays: prev.plays + 1,
  };
  try {
    store?.setItem(HS_KEY, JSON.stringify(hs));
  } catch {
    /* 容量不足等は無視 */
  }
  return { hs, newRecord: Math.round(s.spent) > prev.bestSpent };
}

export function loadSettings(store: StorageLike | null = storage()): Settings {
  try {
    const raw = store?.getItem(SETTINGS_KEY);
    if (!raw) return { bgm: true, se: true };
    const v = JSON.parse(raw) as Partial<Settings>;
    return { bgm: v.bgm !== false, se: v.se !== false };
  } catch {
    return { bgm: true, se: true };
  }
}

export function saveSettings(s: Settings, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

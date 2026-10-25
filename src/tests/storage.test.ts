import { describe, expect, it } from 'vitest';
import { loadHighScore, loadSettings, saveSettings, submitResult } from '../game/systems/highscore';
import { buildShareText, shareText } from '../app/share';
import type { ScoreSnapshot } from '../game/systems/scoring';

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const snap = (spent: number, lines = 3): ScoreSnapshot => ({
  spent, cleared: 100_000, fieldValue: spent - 100_000, lines, combo: 0, maxCombo: 2, level: 1, timeMs: 65_000, devices: 7,
});

describe('ハイスコア保存（localStorage）', () => {
  it('保存した内容を再読み込みで取得できる（リロード相当）', () => {
    const st = new MemStore();
    const r1 = submitResult(snap(500_000), st);
    expect(r1.newRecord).toBe(true);
    const r2 = submitResult(snap(300_000, 9), st);
    expect(r2.newRecord).toBe(false);
    const hs = loadHighScore(st);
    expect(hs.bestSpent).toBe(500_000);
    expect(hs.bestLines).toBe(9);
    expect(hs.plays).toBe(2);
  });

  it('壊れたデータでも落ちない', () => {
    const st = new MemStore();
    st.setItem('tsumimac.highscore.v1', '{broken');
    expect(loadHighScore(st).bestSpent).toBe(0);
  });

  it('サウンド設定の保存', () => {
    const st = new MemStore();
    expect(loadSettings(st)).toEqual({ bgm: true, se: true });
    saveSettings({ bgm: false, se: true }, st);
    expect(loadSettings(st)).toEqual({ bgm: false, se: true });
  });
});

describe('共有', () => {
  it('共有テキストに主要項目が入る', () => {
    const t = buildShareText(snap(1_234_567));
    expect(t).toContain('積みMac');
    expect(t).toContain('¥1,234,567');
    expect(t).toContain('起動したMac：0台');
  });

  it('Web Share API があれば使う', async () => {
    let shared = '';
    const nav = { share: async (d: { text?: string }) => { shared = d.text ?? ''; } } as unknown as Navigator;
    expect(await shareText('abc', nav)).toBe('shared');
    expect(shared).toBe('abc');
  });

  it('Web Share API が無ければクリップボードへコピー', async () => {
    let copied = '';
    const nav = { clipboard: { writeText: async (s: string) => { copied = s; } } } as unknown as Navigator;
    expect(await shareText('xyz', nav)).toBe('copied');
    expect(copied).toBe('xyz');
  });

  it('共有がキャンセルされたら cancelled', async () => {
    const err = new Error('cancel');
    err.name = 'AbortError';
    const nav = { share: async () => { throw err; } } as unknown as Navigator;
    expect(await shareText('x', nav)).toBe('cancelled');
  });
});

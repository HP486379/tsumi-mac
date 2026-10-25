import { describe, expect, it } from 'vitest';
import { ScoreLedger } from '../game/systems/scoring';

describe('スコア台帳', () => {
  it('同じデバイスの価格は二重計上されない', () => {
    const l = new ScoreLedger();
    expect(l.registerPurchase(1, 50_000)).toBe(true);
    expect(l.registerPurchase(1, 50_000)).toBe(false);
    expect(l.spent).toBe(50_000);
    expect(l.devices).toBe(1);
  });

  it('分割時は面積比で按分し、散財総額 = 積みMac指数 + 整理額 を保つ', () => {
    const l = new ScoreLedger();
    l.registerPurchase(1, 1_000_000);
    l.registerPurchase(2, 50_000);
    const cleared = l.applySplit(1, [{ id: 3, value: 750_000 }]);
    expect(cleared).toBeCloseTo(250_000, 6);
    expect(l.fieldValue).toBeCloseTo(800_000, 6);
    expect(l.spent).toBe(1_050_000);
    expect(l.fieldValue + l.cleared).toBeCloseTo(l.spent, 6);
    // 同じソースの再処理は無視（二重計上防止）
    expect(l.applySplit(1, [])).toBe(0);
    expect(l.cleared).toBeCloseTo(250_000, 6);
    // 断片の再分割
    l.applySplit(3, []);
    expect(l.cleared).toBeCloseTo(1_000_000, 6);
    expect(l.fieldValue + l.cleared).toBeCloseTo(l.spent, 6);
  });

  it('コンボ：連続した配置で行消去が続くと加算、途切れるとリセット', () => {
    const l = new ScoreLedger();
    l.beginPlacement();
    expect(l.registerClear(1)).toBe(1);
    expect(l.registerClear(1)).toBe(1); // 同一配置の連鎖は+1のみ
    l.beginPlacement();
    expect(l.registerClear(2)).toBe(2);
    l.beginPlacement();
    l.beginPlacement(); // 消去なしの配置を挟む
    expect(l.combo).toBe(0);
    expect(l.maxCombo).toBe(2);
    expect(l.lines).toBe(4);
  });

  it('レベルは5行ごとに上がる', () => {
    const l = new ScoreLedger();
    l.beginPlacement();
    l.registerClear(4);
    expect(l.level).toBe(1);
    l.registerClear(1);
    expect(l.level).toBe(2);
  });
});

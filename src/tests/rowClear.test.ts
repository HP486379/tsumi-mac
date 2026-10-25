import { describe, expect, it } from 'vitest';
import { planRowClear, type PieceState } from '../game/grid/rowClear';
import { CELL } from '../game/config';

let idc = 1;
function piece(kind: PieceState['kind'], col: number, row: number, w: number, h: number, value: number, angle = 0): PieceState {
  const q = Math.round(angle / (Math.PI / 2)) % 2 === 1;
  const W = q ? h : w;
  const H = q ? w : h;
  return { id: idc++, kind, refurb: false, cx: (col + W / 2) * CELL, cy: (row + H / 2) * CELL, angle, wCells: w, hCells: h, value, vx: 0, vy: 0 };
}

describe('行消去プランナー', () => {
  it('1行消去：対象行だけのボディは丸ごと消え、整理額は価格どおり', () => {
    const ps = [0, 2, 4, 6, 8].map((c) => piece('miniM1', c, 17, 2, 1, 50_000));
    const plan = planRowClear(ps, [17]);
    expect(plan.removeIds).toHaveLength(5);
    expect(plan.create).toHaveLength(0);
    expect(plan.clearedValue).toBeCloseTo(250_000, 6);
    expect(plan.clearedCells).toBe(10);
  });

  it('縦長ボディは消去行だけ切り取られ、残りが断片として再構築される', () => {
    const pro = piece('pro', 0, 14, 2, 4, 1_000_000); // 行14..17
    const plan = planRowClear([pro], [17]);
    expect(plan.removeIds).toEqual([pro.id]);
    expect(plan.create).toHaveLength(1);
    const f = plan.create[0]!;
    expect(f.wCells).toBe(2);
    expect(f.hCells).toBe(3);
    expect(f.cy).toBeCloseTo((14 + 1.5) * CELL, 6);
    expect(f.value).toBeCloseTo(750_000, 6);
    expect(plan.clearedValue).toBeCloseTo(250_000, 6);
    expect(f.cutBottom).toBe(true);
    expect(f.cutTop).toBe(false);
  });

  it('中央の行を消すと上下2つの断片に分割される（複数行消去）', () => {
    const pro = piece('pro', 0, 14, 2, 4, 1_000_000);
    const plan = planRowClear([pro], [15, 16]);
    expect(plan.create).toHaveLength(2);
    const heights = plan.create.map((f) => f.hCells).sort();
    expect(heights).toEqual([1, 1]);
    expect(plan.create.reduce((s, f) => s + f.value, 0) + plan.clearedValue).toBeCloseTo(1_000_000, 6);
  });

  it('90度回転したボディもワールド軸で分割される', () => {
    const studio = piece('studio', 0, 15, 3, 2, 330_000, Math.PI / 2); // ワールドで2幅×3高, 行15..17
    const plan = planRowClear([studio], [17]);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]!.wCells).toBe(2);
    expect(plan.create[0]!.hCells).toBe(2);
    expect(plan.create[0]!.value).toBeCloseTo(220_000, 6);
  });

  it('消去行に接していないボディ・隣接行のボディは変化しない（ワープなし）', () => {
    const above = piece('miniM1', 0, 16, 2, 1, 50_000);
    const below = piece('miniM1', 2, 17, 2, 1, 50_000);
    const plan = planRowClear([above, below], [17]);
    expect(plan.removeIds).toEqual([below.id]);
    expect(plan.create).toHaveLength(0);
  });

  it('大きく傾いたボディは簡易方式：帯に半分以上かかる場合のみ全体整理', () => {
    const tilted = piece('miniM1', 4, 17, 2, 1, 50_000, 0.4);
    const plan = planRowClear([tilted], [17]);
    expect(plan.wholeRemovedIds).toEqual([tilted.id]);
    const tiltedAbove = { ...piece('miniM1', 4, 15, 2, 1, 50_000, 0.4), cy: 16 * CELL + 2 };
    const plan2 = planRowClear([tiltedAbove], [17]);
    expect(plan2.removeIds).toHaveLength(0);
  });

  it('消去行が空なら何もしない', () => {
    const plan = planRowClear([piece('miniM4', 0, 17, 1, 1, 115_000)], []);
    expect(plan.removeIds).toHaveLength(0);
  });
});

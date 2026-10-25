import { describe, expect, it } from 'vitest';
import { computeOccupancy, findFullRows, isCellOccupied, unionArea } from '../game/grid/occupancy';
import { rectVertices } from '../game/physics/geometry';
import { CELL, COLS, ROWS } from '../game/config';

const at = (occ: Float32Array, r: number, c: number) => occ[r * COLS + c]!;

describe('仮想グリッド占有判定', () => {
  it('境界値：89.9%は非占有、90.0%と90.1%は占有', () => {
    expect(isCellOccupied(0.899)).toBe(false);
    expect(isCellOccupied(0.9)).toBe(true);
    expect(isCellOccupied(0.901)).toBe(true);
  });

  it('多角形から計算した占有率が90%境界で正しく判定される', () => {
    const r = ROWS - 1;
    const mk = (ratio: number) => {
      const h = CELL * ratio;
      // セル(r,0)の下側を ratio だけ覆う矩形
      return rectVertices(CELL / 2, (r + 1) * CELL - h / 2, CELL, h, 0);
    };
    for (const [ratio, expected] of [[0.89, false], [0.9, true], [0.91, true]] as const) {
      const occ = computeOccupancy([mk(ratio)]);
      expect(at(occ, r, 0)).toBeCloseTo(ratio, 4);
      expect(isCellOccupied(at(occ, r, 0))).toBe(expected);
    }
  });

  it('同一セルに重なる複数ボディは和集合で計算し100%を超えない', () => {
    const a = rectVertices(18, 18, 36, 36, 0);
    const b = rectVertices(18, 18, 36, 36, 0);
    const occ = computeOccupancy([a, b], { cols: 1, rows: 1, cell: 36 });
    expect(occ[0]!).toBeCloseTo(1, 5);
    // 半分ずつ重なる2つ：合算すると 0.6+0.6=1.2 だが和集合は 0.9
    const c = rectVertices(18, 36 - 0.6 * 18, 36, 0.6 * 36, 0); // 下60%
    const d = rectVertices(18, 0.6 * 18, 36, 0.6 * 36, 0); // 上60%
    const occ2 = computeOccupancy([c, d], { cols: 1, rows: 1, cell: 36 });
    expect(occ2[0]!).toBeCloseTo(1, 5);
    const e = rectVertices(18, 36 - 0.45 * 18, 36, 0.45 * 36, 0); // 下45%
    const f = rectVertices(18, 36 - 0.3 * 18, 36, 0.3 * 36, 0); // 下30%（eに包含）
    const occ3 = computeOccupancy([e, f], { cols: 1, rows: 1, cell: 36 });
    expect(occ3[0]!).toBeCloseTo(0.45, 5);
  });

  it('多数の多角形（サンプリングフォールバック）でも1以下', () => {
    const polys = Array.from({ length: 8 }, (_, i) => rectVertices(18, 18, 36 - i, 36 - i, i * 0.1));
    const a = unionArea(polys, { minX: 0, minY: 0, maxX: 36, maxY: 36 });
    expect(a).toBeLessThan(36 * 36 + 1e-6);
    expect(a).toBeGreaterThan(36 * 36 * 0.85);
  });

  it('回転したボディの占有（45度の正方形は四隅が欠ける）', () => {
    const sq = rectVertices(18, (ROWS - 0.5) * CELL, 36, 36, Math.PI / 4);
    const occ = computeOccupancy([sq]);
    expect(at(occ, ROWS - 1, 0)).toBeLessThan(0.9);
  });

  it('1行すべて埋まると行が検出され、9セルだけでは検出されない', () => {
    const r = ROWS - 1;
    const row = Array.from({ length: 5 }, (_, i) => rectVertices((i * 2 + 1) * CELL, (r + 0.5) * CELL, 72, 36, 0));
    expect(findFullRows(computeOccupancy(row))).toEqual([r]);
    const partial = row.slice(0, 4).concat([rectVertices(8.5 * CELL, (r + 0.5) * CELL, 36, 36, 0)]);
    expect(findFullRows(computeOccupancy(partial))).toEqual([]);
  });

  it('わずかなずれ（2px）なら占有のまま、大きなずれ（5px）なら非占有', () => {
    const r = ROWS - 1;
    const row = (dy: number) => Array.from({ length: 5 }, (_, i) => rectVertices((i * 2 + 1) * CELL, (r + 0.5) * CELL - dy, 72, 36, 0));
    expect(findFullRows(computeOccupancy(row(2)))).toEqual([r]);
    expect(findFullRows(computeOccupancy(row(5)))).toEqual([]);
  });
});

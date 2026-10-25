import { describe, expect, it } from 'vitest';
import { clipPolygonToRect, convexOverlap, intersectConvex, polygonArea, quadrantOf, rectVertices } from '../game/physics/geometry';

describe('geometry', () => {
  it('矩形の頂点（回転なし）', () => {
    const v = rectVertices(50, 50, 20, 10, 0);
    expect(v[0]).toEqual({ x: 40, y: 45 });
    expect(v[2]).toEqual({ x: 60, y: 55 });
    expect(polygonArea(v)).toBeCloseTo(200, 6);
  });

  it('90度回転で幅と高さが入れ替わる（回転後の当たり判定）', () => {
    const v = rectVertices(0, 0, 72, 36, Math.PI / 2);
    const xs = v.map((p) => p.x);
    const ys = v.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(36, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(72, 6);
  });

  it('接触（辺が接するだけ）は重なりとみなさない', () => {
    const a = rectVertices(18, 18, 36, 36, 0);
    const b = rectVertices(54, 18, 36, 36, 0);
    expect(convexOverlap(a, b, 0.5)).toBe(false);
    const c = rectVertices(50, 18, 36, 36, 0);
    expect(convexOverlap(a, c, 0.5)).toBe(true);
  });

  it('回転した矩形の重なり判定（SAT）', () => {
    const a = rectVertices(0, 0, 72, 36, Math.PI / 2); // 縦長 36x72
    const b = rectVertices(36, 0, 36, 36, 0); // aの右側 x:18..54（接触のみ）
    expect(convexOverlap(a, b)).toBe(false);
    const c = rectVertices(20, 0, 36, 36, 0); // x:2..38 → 重なる
    expect(convexOverlap(a, c)).toBe(true);
  });

  it('矩形クリップ・凸交差の面積', () => {
    const sq = rectVertices(18, 18, 36, 36, Math.PI / 4);
    const clipped = clipPolygonToRect(sq, { minX: 0, minY: 0, maxX: 36, maxY: 36 });
    expect(polygonArea(clipped)).toBeLessThan(36 * 36);
    expect(polygonArea(clipped)).toBeGreaterThan(36 * 36 * 0.7);
    const a = rectVertices(0, 0, 10, 10, 0);
    const b = rectVertices(5, 0, 10, 10, 0);
    expect(polygonArea(intersectConvex(a, b))).toBeCloseTo(50, 6);
  });

  it('角度の四分円判定', () => {
    expect(quadrantOf(0).q).toBe(0);
    expect(quadrantOf(Math.PI / 2 + 0.05).q).toBe(1);
    expect(quadrantOf(Math.PI / 2 + 0.05).residual).toBeCloseTo(0.05, 6);
    expect(quadrantOf(-Math.PI / 2).q).toBe(3);
  });
});

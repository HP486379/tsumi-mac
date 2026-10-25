/**
 * 行消去プランナー（純粋関数）。
 * 消去対象行と交差するボディを「行単位で分割」し、消去部分だけを取り除いた残りの断片を再構築する。
 * 90度単位からの傾きが大きいボディは分割が不安定なため、簡易方式（中心が消去帯にあれば全体整理）で扱う。
 */
import { CELL } from '../config';
import type { DeviceKind } from '../../data/devices';
import { type Polygon, rectVertices, quadrantOf, clipPolygonToRect, polygonArea, polygonAABB } from '../physics/geometry';

export interface PieceState {
  id: number;
  kind: DeviceKind;
  refurb: boolean;
  cx: number;
  cy: number;
  angle: number;
  /** ボディのローカル寸法（セル数） */
  wCells: number;
  hCells: number;
  /** フィールド上に残っている価値（円） */
  value: number;
  vx: number;
  vy: number;
}

export interface FragmentSpec {
  kind: DeviceKind;
  refurb: boolean;
  sourceId: number;
  cx: number;
  cy: number;
  angle: number;
  wCells: number;
  hCells: number;
  value: number;
  vx: number;
  vy: number;
  cutTop: boolean;
  cutBottom: boolean;
}

export interface RowClearPlan {
  removeIds: number[];
  create: FragmentSpec[];
  clearedValue: number;
  clearedCells: number;
  /** 簡易方式（全体整理）で処理したボディID */
  wholeRemovedIds: number[];
}

/** 90度単位からこれ以上傾いていたら分割せず簡易方式 */
export const MAX_SPLIT_TILT = 0.2;

export function piecePolygon(p: PieceState, cell = CELL): Polygon {
  return rectVertices(p.cx, p.cy, p.wCells * cell, p.hCells * cell, p.angle);
}

export function planRowClear(pieces: PieceState[], rows: number[], cell = CELL, fieldWidth = 10 * CELL): RowClearPlan {
  const rowSet = new Set(rows);
  const plan: RowClearPlan = { removeIds: [], create: [], clearedValue: 0, clearedCells: 0, wholeRemovedIds: [] };
  if (rowSet.size === 0) return plan;
  const sortedRows = [...rowSet].sort((a, b) => a - b);

  for (const p of pieces) {
    const poly = piecePolygon(p, cell);
    const bb = polygonAABB(poly);
    // 帯との交差（1px未満の接触は無視）
    const touches = sortedRows.some((r) => bb.maxY > r * cell + 1 && bb.minY < (r + 1) * cell - 1);
    if (!touches) continue;

    const { q, residual } = quadrantOf(p.angle);
    const total = p.wCells * p.hCells;

    if (Math.abs(residual) > MAX_SPLIT_TILT) {
      // 簡易方式：消去帯内の面積が半分以上なら全体を整理
      let inBand = 0;
      for (const r of sortedRows) {
        inBand += polygonArea(clipPolygonToRect(poly, { minX: -1e6, maxX: 1e6, minY: r * cell, maxY: (r + 1) * cell }));
      }
      const frac = inBand / polygonArea(poly);
      if (frac >= 0.5) {
        plan.removeIds.push(p.id);
        plan.wholeRemovedIds.push(p.id);
        plan.clearedValue += p.value;
        plan.clearedCells += total;
      }
      continue;
    }

    const W = q % 2 === 1 ? p.hCells : p.wCells;
    const H = q % 2 === 1 ? p.wCells : p.hCells;
    const topRow = Math.round((p.cy - (H * cell) / 2) / cell);
    const removedRows: number[] = [];
    for (let i = 0; i < H; i++) if (rowSet.has(topRow + i)) removedRows.push(topRow + i);
    if (removedRows.length === 0) continue;

    const valuePerCell = p.value / total;
    plan.removeIds.push(p.id);
    plan.clearedValue += valuePerCell * removedRows.length * W;
    plan.clearedCells += removedRows.length * W;

    // 残りの連続行を断片として再構築
    let runStart = -1;
    for (let i = 0; i <= H; i++) {
      const row = topRow + i;
      const keep = i < H && !rowSet.has(row);
      if (keep && runStart < 0) runStart = row;
      if (!keep && runStart >= 0) {
        const len = row - runStart;
        const halfW = (W * cell) / 2;
        const cx = Math.min(fieldWidth - halfW, Math.max(halfW, p.cx));
        plan.create.push({
          kind: p.kind,
          refurb: p.refurb,
          sourceId: p.id,
          cx,
          cy: (runStart + len / 2) * cell,
          angle: residual,
          wCells: W,
          hCells: len,
          value: valuePerCell * W * len,
          vx: p.vx,
          vy: p.vy,
          cutTop: rowSet.has(runStart - 1),
          cutBottom: rowSet.has(row),
        });
        runStart = -1;
      }
    }
  }
  return plan;
}

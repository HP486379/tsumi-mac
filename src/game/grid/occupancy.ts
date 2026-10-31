/**
 * 仮想グリッド占有判定。
 * 各物理ボディの「回転後の多角形」とセルの重なり面積を計算し、
 * 同一セル内に複数ボディがある場合は面積の和集合（包除原理）で占有率を求める（≤100%）。
 */
import { COLS, ROWS, CELL, OCCUPANCY_THRESHOLD } from '../config';
import {
  type Polygon, type AABB, clipPolygonToRect, intersectConvex, polygonArea, polygonAABB,
} from '../physics/geometry';

export interface GridSpec { cols: number; rows: number; cell: number }
export const DEFAULT_GRID: GridSpec = { cols: COLS, rows: ROWS, cell: CELL };

/** 包除原理で扱う最大多角形数。超えた場合はサンプリングにフォールバック */
const MAX_EXACT_UNION = 6;

/** 凸多角形群の和集合面積（各多角形はすでにセル内にクリップ済み） */
export function unionArea(polys: Polygon[], cellRect: AABB): number {
  const list = polys.filter((p) => p.length >= 3 && polygonArea(p) > 1e-9);
  const n = list.length;
  if (n === 0) return 0;
  if (n === 1) return polygonArea(list[0]!);
  if (n <= MAX_EXACT_UNION) {
    let total = 0;
    // 包除原理：|A∪B∪…| = Σ|A| − Σ|A∩B| + …（凸同士の交差は凸）
    const recurse = (start: number, current: Polygon, depth: number) => {
      for (let i = start; i < n; i++) {
        const inter = depth === 0 ? list[i]! : intersectConvex(current, list[i]!);
        const a = polygonArea(inter);
        if (a <= 1e-9) continue;
        total += (depth % 2 === 0 ? 1 : -1) * a;
        recurse(i + 1, inter, depth + 1);
      }
    };
    recurse(0, [], 0);
    const cellArea = (cellRect.maxX - cellRect.minX) * (cellRect.maxY - cellRect.minY);
    return Math.max(0, Math.min(cellArea, total));
  }
  return sampledUnionArea(list, cellRect, 16);
}

function pointInConvex(p: Polygon, x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (Math.abs(c) < 1e-12) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function sampledUnionArea(polys: Polygon[], r: AABB, res: number): number {
  const w = r.maxX - r.minX;
  const h = r.maxY - r.minY;
  let hit = 0;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = r.minX + ((i + 0.5) / res) * w;
      const y = r.minY + ((j + 0.5) / res) * h;
      if (polys.some((p) => pointInConvex(p, x, y))) hit++;
    }
  }
  return (hit / (res * res)) * w * h;
}

/** 全セルの占有率（0..1）を row-major で返す */
export function computeOccupancy(polygons: Polygon[], grid: GridSpec = DEFAULT_GRID): Float32Array {
  const { cols, rows, cell } = grid;
  const perCell: Polygon[][] = Array.from({ length: cols * rows }, () => []);
  for (const poly of polygons) {
    const bb = polygonAABB(poly);
    const c0 = Math.max(0, Math.floor(bb.minX / cell));
    const c1 = Math.min(cols - 1, Math.floor((bb.maxX - 1e-9) / cell));
    const r0 = Math.max(0, Math.floor(bb.minY / cell));
    const r1 = Math.min(rows - 1, Math.floor((bb.maxY - 1e-9) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const rect = { minX: c * cell, minY: r * cell, maxX: (c + 1) * cell, maxY: (r + 1) * cell };
        const clipped = clipPolygonToRect(poly, rect);
        if (clipped.length >= 3) perCell[r * cols + c]!.push(clipped);
      }
    }
  }
  const occ = new Float32Array(cols * rows);
  const cellArea = cell * cell;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list = perCell[r * cols + c]!;
      if (list.length === 0) continue;
      const rect = { minX: c * cell, minY: r * cell, maxX: (c + 1) * cell, maxY: (r + 1) * cell };
      occ[r * cols + c] = Math.min(1, unionArea(list, rect) / cellArea);
    }
  }
  return occ;
}

export function isCellOccupied(ratio: number, threshold = OCCUPANCY_THRESHOLD): boolean {
  // 浮動小数誤差で 0.9 ちょうどが落ちないよう微小値を許容
  return ratio >= threshold - 1e-6;
}

/** 10セルすべて占有された行のインデックス（上から0）を返す */
export function findFullRows(occ: Float32Array, grid: GridSpec = DEFAULT_GRID, threshold = OCCUPANCY_THRESHOLD): number[] {
  const out: number[] = [];
  for (let r = 0; r < grid.rows; r++) {
    let full = true;
    for (let c = 0; c < grid.cols; c++) {
      if (!isCellOccupied(occ[r * grid.cols + c]!, threshold)) { full = false; break; }
    }
    if (full) out.push(r);
  }
  return out;
}


/**
 * Classic mode: a continuous horizontal strip also completes a row.
 * Thin Mac minis cannot fill 90% of a 36px-tall cell even when their
 * entire width is covered. Require an actual shared horizontal slice;
 * independent silhouettes at different heights must not be combined.
 */
export function findContinuousStripRows(polygons: Polygon[], grid: GridSpec = DEFAULT_GRID): number[] {
  const result: number[] = [];
  const width = grid.cols * grid.cell;
  const minThickness = 2;
  const gapTolerance = 0.75;
  for (let row = 0; row < grid.rows; row++) {
    const top = row * grid.cell, bottom = top + grid.cell;
    const relevant = polygons.filter(p => {
      const b = polygonAABB(p);
      return b.maxY > top + minThickness && b.minY < bottom - minThickness;
    });
    if (!relevant.length) continue;
    const levels = [top, bottom, ...relevant.flatMap(p => p.map(v => v.y).filter(y => y > top && y < bottom))]
      .sort((a,b) => a-b);
    const unique = levels.filter((y,i) => i===0 || y-levels[i-1]! > 1e-7);
    let full = false;
    for (let i=1; i<unique.length && !full; i++) {
      const low=unique[i-1]!, high=unique[i]!;
      if (high-low < minThickness) continue;
      const y=(low+high)/2;
      const spans: Array<[number,number]> = [];
      for (const p of relevant) {
        const xs:number[]=[];
        for(let j=0;j<p.length;j++){
          const a=p[j]!,b=p[(j+1)%p.length]!;
          if ((a.y<=y && b.y>y)||(b.y<=y && a.y>y))
            xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
        }
        if(xs.length>=2)spans.push([Math.max(0,Math.min(...xs)),Math.min(width,Math.max(...xs))]);
      }
      spans.sort((a,b)=>a[0]-b[0]);
      let reach=0;
      for(const [start,end] of spans){
        if(start>reach+gapTolerance)break;
        reach=Math.max(reach,end);
        if(reach>=width-gapTolerance){full=true;break;}
      }
    }
    if(full)result.push(row);
  }
  return result;
}

/**
 * 斜めビュー用の「閉じた立体」の幾何（描画非依存の純関数）。
 * - 箱：前面四角形を奥行きベクトルで押し出し、見える側面だけを返す（背面・底面・左面は描かない）。
 * - 円筒：両端キャップの楕円と、それに接する側面ストリップを返す。
 * 奥行きは公式寸法の比（depthCm / widthCm）から算出し、機種共通の奥行き係数は使わない。
 */
import type { OfficialDimension } from '../../data/officialDimensions';

export interface Pt { x: number; y: number }

/**
 * 奥行き1pxあたりの画面ずれ。後退方向は既存実装と同じ x:y = 1:-0.65、短縮率 0.42。
 * 右壁際の Mac Pro 2023（奥行き約149px）でも 400px の斜めキャンバスに収まるよう短縮している。
 * 短縮率は全機種共通。機種ごとの奥行きは公式の奥行き/幅比で決まり、この係数で一律に潰してはいない。
 */
export const DEPTH_DIR: Pt = { x: 0.42, y: -0.42 * 0.65 };

/** 1cmあたりの論理px（前面の幅方向から決める。断片でも元機種の幅 spec.w*CELL を渡すこと） */
export const pxPerCm = (dim: OfficialDimension, fullWidthPx: number): number => fullWidthPx / dim.widthCm;

/** 奥行きの画面ベクトル（実寸 depthCm 分） */
export function depthVector(dim: OfficialDimension, scalePxPerCm: number): Pt {
  const d = dim.depthCm * scalePxPerCm;
  return { x: DEPTH_DIR.x * d, y: DEPTH_DIR.y * d };
}

export const polygonArea = (p: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};

export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export interface SideFace { edge: number; normal: Pt; points: [Pt, Pt, Pt, Pt]; shade: number }
export interface BoxSolid { front: Pt[]; back: Pt[]; sides: SideFace[]; v: Pt }

/** 外向き法線の向きから面の明度係数を決める（上面 1.0、側面 0.5〜0.72、下向き 0.5） */
export function faceShade(n: Pt): number {
  const top = Math.max(0, -n.y), side = Math.abs(n.x);
  return Math.min(1, 0.5 + 0.5 * top + 0.22 * side * (1 - top));
}

/** 前面四角形（画面座標・任意の回転）を v だけ押し出した閉じた箱。押し出し方向を向く面だけを返す */
export function buildBoxSolid(front: readonly Pt[], v: Pt): BoxSolid {
  if (front.length !== 4) throw new Error('front must have 4 corners');
  const cx = front.reduce((s, p) => s + p.x, 0) / 4, cy = front.reduce((s, p) => s + p.y, 0) / 4;
  const back = front.map((p) => ({ x: p.x + v.x, y: p.y + v.y }));
  const sides: SideFace[] = [];
  for (let i = 0; i < 4; i++) {
    const a = front[i]!, b = front[(i + 1) % 4]!;
    let nx = b.y - a.y, ny = -(b.x - a.x);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    if (nx * ((a.x + b.x) / 2 - cx) + ny * ((a.y + b.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    if (nx * v.x + ny * v.y <= 1e-9) continue;
    const n = { x: nx, y: ny };
    sides.push({ edge: i, normal: n, shade: faceShade(n), points: [a, b, back[(i + 1) % 4]!, back[i]!] });
  }
  return { front: [...front], back, sides, v };
}

/** 前後関係のキー。押し出し方向（右上）にある立体ほど大きい＝後から描く。 */
export function drawOrderKey(center: Pt, v: Pt): number {
  const len = Math.hypot(v.x, v.y) || 1;
  return (center.x * v.x + center.y * v.y) / len;
}

export interface EllipseSpec { cx: number; cy: number; rx: number; ry: number; rotation: number }

/** 共役半径 P1,P2 で表した楕円 C + P1 cos t + P2 sin t を、軸長・回転角に変換する */
export function ellipseFromConjugate(c: Pt, p1: Pt, p2: Pt): EllipseSpec {
  const a = p1.x, b = p2.x, cc = p1.y, d = p2.y;
  const m11 = a * a + b * b, m22 = cc * cc + d * d, m12 = a * cc + b * d;
  const tr = m11 + m22, det = Math.sqrt(Math.max(0, (m11 - m22) ** 2 / 4 + m12 * m12));
  const l1 = tr / 2 + det, l2 = Math.max(0, tr / 2 - det);
  return { cx: c.x, cy: c.y, rx: Math.sqrt(l1), ry: Math.sqrt(l2), rotation: 0.5 * Math.atan2(2 * m12, m11 - m22) };
}

export interface CylinderSolid {
  caps: { bottom: EllipseSpec; top: EllipseSpec; bottomC: Pt; topC: Pt };
  strip: [Pt, Pt, Pt, Pt];
  tangent: { t: number; bottom: [Pt, Pt]; top: [Pt, Pt] };
  visibleCap: 'top' | 'bottom' | 'none';
}

/**
 * 円筒。軸は接触面（前面平面）から半径 R だけ奥にあり、最前の母線が接触面に接する。
 * 奥行き方向の半径は DEPTH_DIR × radiusPx（直径16.7cm 由来）で投影し、箱の奥行きは流用しない。
 */
export function buildCylinderSolid(axisTop: Pt, axisBottom: Pt, radiusVec: Pt, radiusPx: number): CylinderSolid {
  const p2: Pt = { x: DEPTH_DIR.x * radiusPx, y: DEPTH_DIR.y * radiusPx };
  const topC = { x: axisTop.x + p2.x, y: axisTop.y + p2.y };
  const bottomC = { x: axisBottom.x + p2.x, y: axisBottom.y + p2.y };
  const S = { x: axisTop.x - axisBottom.x, y: axisTop.y - axisBottom.y };
  const cr = (u: Pt, w: Pt) => u.x * w.y - u.y * w.x;
  const t = Math.atan2(cr(p2, S), cr(radiusVec, S));
  const at = (c: Pt, tt: number): Pt => ({ x: c.x + radiusVec.x * Math.cos(tt) + p2.x * Math.sin(tt), y: c.y + radiusVec.y * Math.cos(tt) + p2.y * Math.sin(tt) });
  const bt: [Pt, Pt] = [at(bottomC, t), at(bottomC, t + Math.PI)];
  const tt: [Pt, Pt] = [at(topC, t), at(topC, t + Math.PI)];
  const sl = Math.hypot(S.x, S.y) || 1;
  const topVis = (S.x / sl) * DEPTH_DIR.x + (S.y / sl) * DEPTH_DIR.y;
  const visibleCap = Math.abs(topVis) < 1e-6 ? 'none' : topVis > 0 ? 'top' : 'bottom';
  return {
    caps: { bottom: ellipseFromConjugate(bottomC, radiusVec, p2), top: ellipseFromConjugate(topC, radiusVec, p2), bottomC, topC },
    strip: [bt[0], tt[0], tt[1], bt[1]], tangent: { t, bottom: bt, top: tt }, visibleCap,
  };
}

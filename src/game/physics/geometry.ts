/** 純粋な2D幾何ユーティリティ（物理エンジン非依存・単体テスト対象） */
export interface Vec2 { x: number; y: number }
export type Polygon = Vec2[];

export interface AABB { minX: number; minY: number; maxX: number; maxY: number }

/** 中心・サイズ・回転角から矩形の頂点を返す（Matter.jsと同じ順：左上→右上→右下→左下） */
export function rectVertices(cx: number, cy: number, w: number, h: number, angle: number): Polygon {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  const local: Array<[number, number]> = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  return local.map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }));
}

/** 符号付き面積（y下向き座標系では時計回りが正） */
export function signedArea(p: Polygon): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const v = p[i]!;
    const n = p[(i + 1) % p.length]!;
    a += v.x * n.y - n.x * v.y;
  }
  return a / 2;
}

export function polygonArea(p: Polygon): number {
  return p.length < 3 ? 0 : Math.abs(signedArea(p));
}

export function polygonAABB(p: Polygon): AABB {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of p) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

/** 凸多角形を軸平行矩形でクリップ（Sutherland–Hodgman） */
export function clipPolygonToRect(poly: Polygon, r: AABB): Polygon {
  let out = poly;
  const edges: Array<[(v: Vec2) => number, number, boolean, 'x' | 'y']> = [
    [(v) => v.x, r.minX, true, 'x'],
    [(v) => v.x, r.maxX, false, 'x'],
    [(v) => v.y, r.minY, true, 'y'],
    [(v) => v.y, r.maxY, false, 'y'],
  ];
  for (const [get, lim, isMin, axis] of edges) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    const inside = (v: Vec2) => (isMin ? get(v) >= lim : get(v) <= lim);
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!;
      const prev = input[(i + input.length - 1) % input.length]!;
      const cIn = inside(cur);
      const pIn = inside(prev);
      if (cIn !== pIn) {
        const t = (lim - get(prev)) / (get(cur) - get(prev));
        const ix = prev.x + (cur.x - prev.x) * t;
        const iy = prev.y + (cur.y - prev.y) * t;
        out.push(axis === 'x' ? { x: lim, y: iy } : { x: ix, y: lim });
      }
      if (cIn) out.push(cur);
    }
  }
  return out;
}

/** 凸多角形同士の交差（Sutherland–Hodgman、clipperは凸） */
export function intersectConvex(subject: Polygon, clipper: Polygon): Polygon {
  if (subject.length < 3 || clipper.length < 3) return [];
  const orient = signedArea(clipper) >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clipper.length; i++) {
    if (out.length === 0) break;
    const a = clipper[i]!;
    const b = clipper[(i + 1) % clipper.length]!;
    const side = (p: Vec2) => orient * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]!;
      const prev = input[(j + input.length - 1) % input.length]!;
      const sc = side(cur);
      const sp = side(prev);
      const cIn = sc >= 0;
      const pIn = sp >= 0;
      if (cIn !== pIn) {
        const t = sp / (sp - sc);
        out.push({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
      }
      if (cIn) out.push(cur);
    }
  }
  return out;
}

/** 凸多角形の分離軸判定。tolerance(px)以下の接触・微小めり込みは「重なりなし」とみなす */
export function convexOverlap(a: Polygon, b: Polygon, tolerance = 0.5): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]!;
      const p2 = poly[(i + 1) % poly.length]!;
      const nx = -(p2.y - p1.y);
      const ny = p2.x - p1.x;
      const len = Math.hypot(nx, ny) || 1;
      const ux = nx / len, uy = ny / len;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const v of a) { const d = v.x * ux + v.y * uy; if (d < aMin) aMin = d; if (d > aMax) aMax = d; }
      for (const v of b) { const d = v.x * ux + v.y * uy; if (d < bMin) bMin = d; if (d > bMax) bMax = d; }
      const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (overlap <= tolerance) return false;
    }
  }
  return true;
}

/** 角度を最も近い90度単位に丸めたときの四分円番号(0..3)と残差 */
export function quadrantOf(angle: number): { q: number; residual: number } {
  const half = Math.PI / 2;
  const k = Math.round(angle / half);
  const q = ((k % 4) + 4) % 4;
  return { q, residual: angle - k * half };
}

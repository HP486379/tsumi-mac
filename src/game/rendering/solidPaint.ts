/** 閉じた立体の Canvas 描画。面の継ぎ目に背景が見えないよう、塗りと同色の細い縁取りで面を重ねる。 */
import type { BoxSolid, CylinderSolid, EllipseSpec, Pt } from './solidGeometry';

export interface PaintCtx {
  fillStyle: unknown; strokeStyle: unknown; lineWidth: number; lineJoin: string;
  beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void;
  fill(): void; stroke(): void; quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void };
}
export interface Palette { body: string; bodyDark: string }

const hexToRgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: [number, number, number], b: [number, number, number], t: number) => a.map((v, i) => v + (b[i]! - v) * t) as [number, number, number];
/** shade=1 で body（明部）、0.5 で bodyDark（暗部） */
export function shadedColor(p: Palette, shade: number): string {
  const c = mix(hexToRgb(p.bodyDark), hexToRgb(p.body), Math.max(0, Math.min(1, (shade - 0.5) / 0.5)));
  return `rgb(${c.map((v) => Math.round(v)).join(',')})`;
}
function poly(ctx: PaintCtx, pts: readonly Pt[]): void {
  ctx.beginPath(); pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))); ctx.closePath();
}
function fillSeam(ctx: PaintCtx, color: string): void {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
  ctx.fill(); ctx.stroke();
}
/** A softly bevelled silhouette for each extruded face, including the far corners. */
function roundedQuad(ctx: PaintCtx, pts: readonly Pt[], radius: number): void {
  const corners = pts.map((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    const d0 = Math.hypot(prev.x - p.x, prev.y - p.y);
    const d1 = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, d0 * 0.28, d1 * 0.28);
    return {
      enter: { x: p.x + (prev.x - p.x) * r / (d0 || 1), y: p.y + (prev.y - p.y) * r / (d0 || 1) },
      exit: { x: p.x + (next.x - p.x) * r / (d1 || 1), y: p.y + (next.y - p.y) * r / (d1 || 1) },
      p,
    };
  });
  ctx.beginPath();
  ctx.moveTo(corners[0]!.enter.x, corners[0]!.enter.y);
  for (const c of corners) {
    ctx.quadraticCurveTo(c.p.x, c.p.y, c.exit.x, c.exit.y);
    const next = corners[(corners.indexOf(c) + 1) % corners.length]!;
    ctx.lineTo(next.enter.x, next.enter.y);
  }
  ctx.closePath();
}

/** Rounded metal enclosure: soft far corners and a narrow chamfer along the front lip. */
export function paintBoxSides(ctx: PaintCtx, solid: BoxSolid, palette: Palette, radius = 5): void {
  for (const f of solid.sides) {
    roundedQuad(ctx, f.points, radius);
    fillSeam(ctx, shadedColor(palette, f.shade));
    const a = f.points[0], b = f.points[1];
    const vx = b.x - a.x, vy = b.y - a.y;
    const length = Math.hypot(vx, vy) || 1;
    const inset = Math.min(radius * 0.35, 2.2);
    ctx.beginPath();
    ctx.moveTo(a.x + vx / length * Math.min(radius, length * 0.2), a.y + vy / length * Math.min(radius, length * 0.2));
    ctx.lineTo(b.x - vx / length * Math.min(radius, length * 0.2), b.y - vy / length * Math.min(radius, length * 0.2));
    ctx.strokeStyle = shadedColor(palette, 0.93);
    ctx.lineWidth = inset;
    ctx.stroke();
  }
}
function ellipsePath(ctx: PaintCtx, e: EllipseSpec): void {
  ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, e.rotation, 0, Math.PI * 2);
}
/** 黒い円筒（Mac Pro Late 2013）：隠れる端 → 側面（光沢帯） → 見えるキャップ（外輪＋内側） */
export function paintCylinderSolid(ctx: PaintCtx, c: CylinderSolid, base = '#16181d', rim = '#3a3f4a', gloss = '#7b8394'): void {
  const hidden = c.visibleCap === 'top' ? c.caps.bottom : c.caps.top;
  ellipsePath(ctx, hidden); fillSeam(ctx, base);
  const [a, b] = [c.tangent.bottom[0], c.tangent.bottom[1]];
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, '#0b0c0f'); g.addColorStop(0.28, gloss); g.addColorStop(0.36, '#2a2e37'); g.addColorStop(0.75, base); g.addColorStop(1, '#050608');
  poly(ctx, c.strip); ctx.fillStyle = g; ctx.strokeStyle = base; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke();
  if (c.visibleCap !== 'none') {
    const cap = c.visibleCap === 'top' ? c.caps.top : c.caps.bottom;
    ellipsePath(ctx, cap); fillSeam(ctx, rim);
    ellipsePath(ctx, { ...cap, rx: cap.rx * 0.78, ry: cap.ry * 0.78 }); fillSeam(ctx, '#1d2027');
  }
}

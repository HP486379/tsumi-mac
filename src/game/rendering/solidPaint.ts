/** 閉じた立体の Canvas 描画。面の継ぎ目に背景が見えないよう、塗りと同色の細い縁取りで面を重ねる。 */
import type { BoxSolid, CylinderSolid, EllipseSpec, Pt } from './solidGeometry';

export interface PaintCtx {
  fillStyle: unknown; strokeStyle: unknown; lineWidth: number; lineJoin: string;
  beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void;
  fill(): void; stroke(): void;
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
/** 側面だけを描く（前面は呼び出し側が既存スプライトで重ねる）。 */
export function paintBoxSides(ctx: PaintCtx, solid: BoxSolid, palette: Palette): void {
  for (const f of solid.sides) { poly(ctx, f.points); fillSeam(ctx, shadedColor(palette, f.shade)); }
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

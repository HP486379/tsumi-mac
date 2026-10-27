import { DEVICES, type DeviceKind } from '../../data/devices';
import { OFFICIAL_DIMENSIONS } from '../../data/officialDimensions';
import { CELL, DANGER_Y, FIELD_H, FIELD_W } from '../config';
import type { RenderItem, RenderState } from './renderer';
import type { SpriteCache } from './sprites';
import {
  DEPTH_DIR, buildBoxSolid, buildCylinderSolid, depthVector, drawOrderKey, pxPerCm,
  type CylinderSolid,
} from './solidGeometry';
import { paintBoxSides, paintCylinderSolid, type PaintCtx } from './solidPaint';

export const OBLIQUE_W = 400;
export const OBLIQUE_H = 704;
const A = 0.84, B = 0.12, D = 0.9, TX = 28, TY = 38;
type Point = { x: number; y: number };

/** One affine contact plane: touching points stay touching after projection. */
export function projectPoint(x: number, y: number): Point {
  return { x: TX + A * x, y: TY + B * x + D * y };
}

/** Depth in px = official depth(cm) x (front width px / official width cm). Per-model, not a shared factor. */
export function depthPx(kind: DeviceKind): number {
  const dim = OFFICIAL_DIMENSIONS[kind];
  return dim.depthCm * pxPerCm(dim, DEVICES[kind].w * CELL);
}

/**
 * Visual shell thickness, not physical footprint depth.
 *
 * The front sprites show the device's narrow face. Extruding by the complete
 * official front-to-back dimension made a separate, oversized rectangular
 * container behind every Mac. The technical dimensions remain available via
 * depthPx(), but the auxiliary illustration uses a deliberately compressed
 * silhouette. Mini/Studio are low-profile; the tower stays deeper.
 */
export function visualDepthVec(kind: DeviceKind, wCells = DEVICES[kind].w): Point {
  const dim = OFFICIAL_DIMENSIONS[kind];
  const frontWidth = wCells * CELL;
  const officialProjected = dim.depthCm * pxPerCm(dim, DEVICES[kind].w * CELL);
  const ratio = kind === 'pro' ? 0.30 : kind === 'studio' ? 0.16 : kind === 'miniM4' ? 0.13 : 0.12;
  const maxDepth = frontWidth * ratio;
  const effective = Math.min(officialProjected, maxDepth);
  return { x: DEPTH_DIR.x * effective, y: DEPTH_DIR.y * effective };
}
function depthVec(kind: DeviceKind): Point {
  return visualDepthVec(kind);
}

export function projectedDevice(item: RenderItem): { front: Point[]; back: Point[] } {
  const w = item.key.wCells * CELL / 2, h = item.key.hCells * CELL / 2;
  const c = Math.cos(item.angle), s = Math.sin(item.angle);
  const front = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x = 0, y = 0]) =>
    projectPoint(item.x + x * c - y * s, item.y + x * s + y * c));
  // Fragments keep the parent model's depth (spec.w), not the fragment width.
  const v = depthVec(item.key.kind);
  return { front, back: front.map(p => ({ x: p.x + v.x, y: p.y + v.y })) };
}

/** Cylinder (Mac Pro Late 2013): local Y is the cylinder axis, local X the diameter. */
export function projectedCylinder(item: RenderItem): CylinderSolid {
  const w = item.key.wCells * CELL, h = item.key.hCells * CELL, R = w / 2;
  const c = Math.cos(item.angle), s = Math.sin(item.angle);
  const at = (lx: number, ly: number): Point => projectPoint(item.x + lx * c - ly * s, item.y + lx * s + ly * c);
  const top = at(0, -h / 2), bottom = at(0, h / 2), o = at(0, 0), r = at(R, 0);
  return buildCylinderSolid(top, bottom, { x: r.x - o.x, y: r.y - o.y }, R);
}

/** Far-to-near order for the extrusion pass. Returns a copy; RenderState is never mutated. */
export function sortedForDrawing(items: readonly RenderItem[]): RenderItem[] {
  return items
    .map((item, i) => ({ item, i, key: drawOrderKey(projectPoint(item.x, item.y), DEPTH_DIR) }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map(e => e.item);
}

const isCylinder = (kind: DeviceKind): boolean => OFFICIAL_DIMENSIONS[kind].shape === 'cylinder';

/** Read-only pseudo-3D view. Existing model sprites are shared with the front. */
export class ObliqueRenderer {
  private ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private scale = 1;
  frames = 0;
  lastState: RenderState | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly sprites: SpriteCache) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    // Auxiliary view uses at most 1.5 device pixels per logical pixel.
    const scale = Math.max(0.25, Math.min(1.5, cssW / OBLIQUE_W * Math.min(dpr, 2), cssH / OBLIQUE_H * Math.min(dpr, 2)));
    if (this.background && Math.abs(this.scale - scale) < 0.001) return;
    this.scale = scale;
    this.canvas.width = Math.round(OBLIQUE_W * scale);
    this.canvas.height = Math.round(OBLIQUE_H * scale);
    this.background = document.createElement('canvas');
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const ctx = this.background.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#111620'; ctx.fillRect(0, 0, OBLIQUE_W, OBLIQUE_H);
    const corners = [[0, 0], [FIELD_W, 0], [FIELD_W, FIELD_H], [0, FIELD_H]].map(([x = 0, y = 0]) => projectPoint(x, y));
    this.polygon(ctx, corners); ctx.fillStyle = '#1b2330'; ctx.fill();
    ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD_W; x += CELL) this.line(ctx, projectPoint(x, 0), projectPoint(x, FIELD_H));
    for (let y = 0; y <= FIELD_H; y += CELL) this.line(ctx, projectPoint(0, y), projectPoint(FIELD_W, y));
    ctx.strokeStyle = '#7fd3ff80'; ctx.lineWidth = 2;
    this.line(ctx, projectPoint(0, FIELD_H), projectPoint(FIELD_W, FIELD_H));
  }

  private line(ctx: CanvasRenderingContext2D, a: Point, b: Point): void {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  private polygon(ctx: CanvasRenderingContext2D, points: Point[]): void {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  }

  draw(state: RenderState): void {
    if (!this.background) return;
    this.lastState = state; this.frames++;
    const ctx = this.ctx, scale = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.background, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Compact illustrated shells: avoid the oversized rectangular boxes of v4.
    // Physics and the official dimension ledger are unchanged.
    // Guides and row flashes belong to the projected contact plane.
    ctx.save();
    ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, TY * scale);
    if (state.guide) {
      ctx.fillStyle = '#7fd3ff12';
      ctx.fillRect(state.guide.minX, state.guide.top, state.guide.maxX - state.guide.minX, FIELD_H - state.guide.top);
    }
    for (const f of state.flashes) {
      ctx.fillStyle = `rgba(255,240,170,${Math.min(0.75, f.life * 1.5)})`;
      ctx.fillRect(0, f.row * CELL, FIELD_W, CELL);
    }
    ctx.restore();

    // Each object's sides and front are composited together, far-to-near.
    // This prevents a distant shell from being painted over a nearer front.
    for (const item of sortedForDrawing(state.items)) {
      const w = item.key.wCells * CELL, h = item.key.hCells * CELL;
      if (isCylinder(item.key.kind)) {
        paintCylinderSolid(ctx as unknown as PaintCtx, projectedCylinder(item));
      } else {
        const { front } = projectedDevice(item);
        paintBoxSides(ctx as unknown as PaintCtx, buildBoxSolid(front, depthVec(item.key.kind)), DEVICES[item.key.kind]);
        ctx.save();
        ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, TY * scale);
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.drawImage(this.sprites.get(item.key), -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      if (item.active) {
        ctx.save();
        ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, TY * scale);
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.strokeStyle = '#7fd3ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
    ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, TY * scale);
    ctx.strokeStyle = state.dangerRatio > 0 ? '#ff4a5e' : '#ff4a5e88';
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    this.line(ctx, { x: 0, y: DANGER_Y }, { x: FIELD_W, y: DANGER_Y });
    ctx.setLineDash([]);
    if (state.dangerRatio > 0) {
      ctx.fillStyle = '#ff4a5ecc'; ctx.fillRect(0, DANGER_Y - 5, FIELD_W * state.dangerRatio, 4);
    }
  }
}

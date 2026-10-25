import { DEVICES, type DeviceKind } from '../../data/devices';
import { CELL, DANGER_Y, FIELD_H, FIELD_W } from '../config';
import type { RenderItem, RenderState } from './renderer';
import type { SpriteCache } from './sprites';

export const OBLIQUE_W = 400;
export const OBLIQUE_H = 704;
const A = 0.84, B = 0.12, D = 0.9, TX = 28, TY = 38;
type Point = { x: number; y: number };
const DEPTH: Record<DeviceKind, number> = { miniM1: 20, miniM2: 22, miniM4: 26, studio: 34, pro: 38 };

/** One affine contact plane: touching points stay touching after projection. */
export function projectPoint(x: number, y: number): Point {
  return { x: TX + A * x, y: TY + B * x + D * y };
}

export function projectedDevice(item: RenderItem): { front: Point[]; back: Point[] } {
  const w = item.key.wCells * CELL / 2, h = item.key.hCells * CELL / 2;
  const c = Math.cos(item.angle), s = Math.sin(item.angle);
  const front = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x = 0, y = 0]) =>
    projectPoint(item.x + x * c - y * s, item.y + x * s + y * c));
  const depth = DEPTH[item.key.kind];
  return { front, back: front.map(p => ({ x: p.x + depth, y: p.y - depth * 0.65 })) };
}

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

    // Draw extrusion first; never let a decorative side hide another front face
    // or imply a second contact location. Do not sort or mutate RenderState.
    for (const item of state.items) {
      const { front, back } = projectedDevice(item);
      const spec = DEVICES[item.key.kind];
      this.polygon(ctx, back); ctx.fillStyle = spec.bodyDark; ctx.fill();
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        this.polygon(ctx, [front[i]!, back[i]!, back[next]!, front[next]!]);
        ctx.fillStyle = i % 2 ? spec.bodyDark : spec.body;
        ctx.fill(); ctx.strokeStyle = '#171c26'; ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
    ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, TY * scale);
    if (state.guide) {
      ctx.fillStyle = '#7fd3ff12';
      ctx.fillRect(state.guide.minX, state.guide.top, state.guide.maxX - state.guide.minX, FIELD_H - state.guide.top);
    }
    for (const f of state.flashes) {
      ctx.fillStyle = `rgba(255,240,170,${Math.min(0.75, f.life * 1.5)})`;
      ctx.fillRect(0, f.row * CELL, FIELD_W, CELL);
    }
    for (const item of state.items) {
      const w = item.key.wCells * CELL, h = item.key.hCells * CELL;
      ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.angle);
      ctx.drawImage(this.sprites.get(item.key), -w / 2, -h / 2, w, h);
      if (item.active) {
        ctx.strokeStyle = '#7fd3ff'; ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
    ctx.strokeStyle = state.dangerRatio > 0 ? '#ff4a5e' : '#ff4a5e88';
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    this.line(ctx, { x: 0, y: DANGER_Y }, { x: FIELD_W, y: DANGER_Y });
    ctx.setLineDash([]);
    if (state.dangerRatio > 0) {
      ctx.fillStyle = '#ff4a5ecc'; ctx.fillRect(0, DANGER_Y - 5, FIELD_W * state.dangerRatio, 4);
    }
  }
}

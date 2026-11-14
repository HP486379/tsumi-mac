import { DEVICES, type DeviceKind } from '../../data/devices';
import { isClassicMini } from '../../data/gameModes';
import { OFFICIAL_DIMENSIONS } from '../../data/officialDimensions';
import { CELL } from '../config';
import { CLASSIC_BOARD,obliqueViewport,type BoardSpec } from '../board';
import type { RenderItem, RenderState } from './renderer';
import type { SpriteCache } from './sprites';
import {
  DEPTH_DIR, buildCylinderSolid, depthVector, drawOrderKey, pxPerCm,
  type CylinderSolid,
} from './solidGeometry';
import { ChassisRenderer } from './chassisRenderer';
import { CAMERA, projectWorld } from './chassisProjection';

export const OBLIQUE_W = 400;
export const OBLIQUE_H = 704;
const { a: A, b: B, d: D, tx: TX, ty: TY } = CAMERA;
type Point = { x: number; y: number };

/** One affine contact plane: touching points stay touching after projection. */
export function projectPoint(x: number, y: number): Point {
  return projectWorld(x, y);
}

/** Depth in px = official depth(cm) x (front width px / official width cm). Per-model, not a shared factor. */
export function depthPx(kind: DeviceKind): number {
  const dim = OFFICIAL_DIMENSIONS[kind];
  return dim.depthCm * pxPerCm(dim, (isClassicMini(kind)?2:DEVICES[kind].w) * CELL);
}

function depthVec(kind: DeviceKind): Point {
  const dim = OFFICIAL_DIMENSIONS[kind];
  return depthVector(dim, pxPerCm(dim, (isClassicMini(kind)?2:DEVICES[kind].w) * CELL));
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

/** Corner radius in logical front-plane pixels, not a depth reduction. */
export function chassisRadius(kind: DeviceKind, w: number, h: number): number {
  const r = kind === 'pro' ? 5 : kind === 'studio' ? 8 : kind === 'miniM4' ? 5 : 6;
  return Math.min(r, w * 0.2, h * 0.2);
}

/** Read-only solid view. The constructor keeps the front cache argument for compatibility. */
export class ObliqueRenderer {
  private ctx: CanvasRenderingContext2D;
  private view;
  private projectPoint(x:number,y:number):Point {const p=projectPoint(x,y);return {x:p.x,y:p.y+this.view.offsetY};}
  private background: HTMLCanvasElement | null = null;
  private scale = 1;
  private chassis = new ChassisRenderer();
  frames = 0;
  lastState: RenderState | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, _sprites: SpriteCache,readonly board:Readonly<BoardSpec>=CLASSIC_BOARD) {
    this.view=obliqueViewport(board);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    // Auxiliary view uses at most 1.5 device pixels per logical pixel.
    const scale = Math.max(0.25, Math.min(1.5, cssW / this.view.width * Math.min(dpr, 2), cssH / this.view.height * Math.min(dpr, 2)));
    if (this.background && Math.abs(this.scale - scale) < 0.001) return;
    this.scale = scale;
    this.canvas.width = Math.round(this.view.width * scale);
    this.canvas.height = Math.round(this.view.height * scale);
    this.background = document.createElement('canvas');
    this.background.width = this.canvas.width;
    this.background.height = this.canvas.height;
    const ctx = this.background.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#111620'; ctx.fillRect(0, 0, this.view.width, this.view.height);
    const corners = [[0, 0], [this.board.width, 0], [this.board.width, this.board.height], [0, this.board.height]].map(([x = 0, y = 0]) => this.projectPoint(x, y));
    this.polygon(ctx, corners); ctx.fillStyle = '#1b2330'; ctx.fill();
    ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
    for (let x = 0; x <= this.board.width; x += CELL) this.line(ctx, this.projectPoint(x, 0), this.projectPoint(x, this.board.height));
    for (let y = 0; y <= this.board.height; y += CELL) this.line(ctx, this.projectPoint(0, y), this.projectPoint(this.board.width, y));
    ctx.strokeStyle = '#7fd3ff80'; ctx.lineWidth = 2;
    this.line(ctx, this.projectPoint(0, this.board.height), this.projectPoint(this.board.width, this.board.height));
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

    // Guides and flashes remain on the same contact plane as the main view.
    ctx.save();
    ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, (TY+this.view.offsetY) * scale);
    if (state.guide) {
      ctx.fillStyle = '#7fd3ff12';
      ctx.fillRect(state.guide.minX, state.guide.top, state.guide.maxX - state.guide.minX, this.board.height - state.guide.top);
    }
    for (const f of state.flashes) {
      ctx.fillStyle = `rgba(255,240,170,${Math.min(0.75, f.life * 1.5)})`;
      ctx.fillRect(0, f.row * CELL, this.board.width, CELL);
    }
    ctx.restore();

    ctx.drawImage(this.chassis.draw(state.items, this.canvas.width, this.canvas.height,this.view), 0, 0, this.view.width, this.view.height);
    ctx.setTransform(A * scale, B * scale, 0, D * scale, TX * scale, (TY+this.view.offsetY) * scale);
    ctx.strokeStyle = state.dangerRatio > 0 ? '#ff4a5e' : '#ff4a5e88';
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    this.line(ctx, { x: 0, y: this.board.dangerY }, { x: this.board.width, y: this.board.dangerY });
    ctx.setLineDash([]);
    if (state.dangerRatio > 0) {
      ctx.fillStyle = '#ff4a5ecc'; ctx.fillRect(0, this.board.dangerY - 5, this.board.width * state.dangerRatio, 4);
    }
  }
}

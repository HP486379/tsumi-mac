/**
 * Canvas 2D レンダラー。論理座標（360×648）で描き、変換行列で画面ピクセルへスケーリングする。
 * 背景は事前描画したキャッシュを使い、毎フレームの描画コストを抑える。
 */
import { CELL, COLS, DANGER_Y, FIELD_H, FIELD_W, ROWS } from '../config';
import { SpriteCache, drawDevice, type SpriteKey } from './sprites';

export interface RenderItem {
  x: number;
  y: number;
  angle: number;
  key: SpriteKey;
  active: boolean;
}

export interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  vy: number;
}

export interface RowFlash { row: number; life: number }

export interface RenderState {
  items: RenderItem[];
  guide: { minX: number; maxX: number; top: number } | null;
  dangerRatio: number;
  floaters: Floater[];
  flashes: RowFlash[];
  shake: number;
  timeMs: number;
}

/** 内部解像度の上限倍率（N100等の低負荷化：過剰な高解像度描画を避ける） */
const MAX_PIXEL_SCALE = 2.5;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  readonly sprites = new SpriteCache();
  scale = 1;
  frames = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.resize(FIELD_W, FIELD_H, 1);
  }

  /** CSS表示サイズとdevicePixelRatioから内部バッファを決める */
  resize(cssW: number, cssH: number, dpr: number): void {
    const s = Math.max(0.5, Math.min(MAX_PIXEL_SCALE, Math.min(cssW / FIELD_W, cssH / FIELD_H) * Math.min(dpr, 2)));
    const bw = Math.round(FIELD_W * s);
    const bh = Math.round(FIELD_H * s);
    if (bw === this.canvas.width && bh === this.canvas.height && Math.abs(s - this.scale) < 1e-3 && this.bg) return;
    this.scale = s;
    this.canvas.width = bw;
    this.canvas.height = bh;
    this.sprites.setScale(s);
    this.bg = this.buildBackground(s);
  }

  private buildBackground(s: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(FIELD_W * s);
    c.height = Math.round(FIELD_H * s);
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    g.addColorStop(0, '#1b1f2a');
    g.addColorStop(1, '#10131a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    // 危険ゾーン
    ctx.fillStyle = 'rgba(255,70,90,0.08)';
    ctx.fillRect(0, 0, FIELD_W, DANGER_Y);
    // グリッド
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1 / s;
    ctx.beginPath();
    for (let c2 = 1; c2 < COLS; c2++) {
      ctx.moveTo(c2 * CELL, 0);
      ctx.lineTo(c2 * CELL, FIELD_H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(FIELD_W, r * CELL);
    }
    ctx.stroke();
    // 床
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, FIELD_H - 2, FIELD_W, 2);
    return c;
  }

  draw(st: RenderState): void {
    const ctx = this.ctx;
    const s = this.scale;
    this.frames++;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    let ox = 0;
    let oy = 0;
    if (st.shake > 0) {
      ox = (Math.random() - 0.5) * st.shake;
      oy = (Math.random() - 0.5) * st.shake;
    }
    ctx.setTransform(s, 0, 0, s, ox * s, oy * s);

    // 行消しフラッシュ
    for (const f of st.flashes) {
      ctx.fillStyle = `rgba(255,240,170,${Math.min(0.75, f.life * 1.5)})`;
      ctx.fillRect(0, f.row * CELL, FIELD_W, CELL);
    }

    // 落下ガイド
    if (st.guide) {
      ctx.fillStyle = 'rgba(127,211,255,0.07)';
      ctx.fillRect(st.guide.minX, st.guide.top, st.guide.maxX - st.guide.minX, FIELD_H - st.guide.top);
    }

    // デバイス
    for (const it of st.items) {
      const sp = this.sprites.get(it.key);
      const w = it.key.wCells * CELL;
      const h = it.key.hCells * CELL;
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.angle !== 0) ctx.rotate(it.angle);
      ctx.drawImage(sp, -w / 2, -h / 2, w, h);
      if (it.active) {
        ctx.strokeStyle = 'rgba(127,211,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
      }
      ctx.restore();
    }

    // 危険ライン
    const blink = st.dangerRatio > 0 ? 0.5 + 0.5 * Math.sin(st.timeMs / 70) : 0;
    ctx.strokeStyle = st.dangerRatio > 0 ? `rgba(255,70,90,${0.6 + 0.4 * blink})` : 'rgba(255,70,90,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(FIELD_W, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (st.dangerRatio > 0) {
      ctx.fillStyle = 'rgba(255,70,90,0.85)';
      ctx.fillRect(0, DANGER_Y - 5, FIELD_W * st.dangerRatio, 4);
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('積みすぎ警告', FIELD_W / 2, DANGER_Y - 8);
    }

    // フロートテキスト
    for (const f of st.floaters) {
      const a = Math.max(0, Math.min(1, f.life / Math.min(0.4, f.maxLife)));
      ctx.globalAlpha = a;
      ctx.font = `900 ${f.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}

/** 次のデバイス表示用の小さなプレビュー描画 */
export function drawPreview(canvas: HTMLCanvasElement, key: SpriteKey | null, dpr: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cssW = canvas.clientWidth || 80;
  const cssH = canvas.clientHeight || 80;
  const k = Math.min(dpr, 2);
  if (canvas.width !== Math.round(cssW * k)) canvas.width = Math.round(cssW * k);
  if (canvas.height !== Math.round(cssH * k)) canvas.height = Math.round(cssH * k);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!key) return;
  const w = key.wCells * CELL;
  const h = key.hCells * CELL;
  const fit = Math.min((cssW - 8) / w, (cssH - 8) / h, 1.2);
  ctx.setTransform(fit * k, 0, 0, fit * k, ((cssW - w * fit) / 2) * k, ((cssH - h * fit) / 2) * k);
  // プレビューはキャッシュを使わず直接描画（呼び出し頻度が低い）
  drawDevice(ctx, key);
}

/**
 * デバイスのオリジナル・イラスト（Canvasで手続き的に描画）。
 * 実製品の画像・ロゴは使用しない。描画結果は寸法・状態ごとにキャッシュし、毎フレームは drawImage のみ。
 */
import { CELL } from '../config';
import { DEVICES, type DeviceKind } from '../../data/devices';
import { drawMacPro2013Body } from './macPro2013Sprite';
import type { FragmentGeometry,GameMode } from '../../data/gameModes';

export interface SpriteKey {
  mode?:GameMode;
  geometry?:FragmentGeometry;
  kind: DeviceKind;
  wCells: number;
  hCells: number;
  refurb: boolean;
  cutTop: boolean;
  cutBottom: boolean;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** ローカル座標（左上0,0、幅w・高さh、論理px）でデバイスを描く */
export function drawDevice(ctx: CanvasRenderingContext2D, key: SpriteKey): void {
  if(key.mode==='real'){drawRealDevice(ctx,key);return;}
  const spec = DEVICES[key.kind];
  const w = key.wCells * CELL;
  const h = key.hCells * CELL;
  const classicM4=key.kind==='miniM4'; // Real mode returned above.
  const pad = classicM4?.7:1.2;
  const r = classicM4?1.5:key.kind === 'pro' ? 7 : key.kind === 'studio' ? 8 : 6;

  if (key.kind === 'macPro2013') {
    // 黒い円筒：正面は円筒を真横から見たシルエット＋曲面の光沢（アルミ本体・上面ハイライトは描かない）
    drawMacPro2013Body(ctx, w, h, CELL);
  } else {
    // 本体（アルミ風グラデーション）
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, spec.body);
    g.addColorStop(1, spec.bodyDark);
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(20,24,30,0.75)';
    ctx.stroke();

    // 上面ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, pad + 3, pad + 2, w - pad * 2 - 6, classicM4?.9:Math.min(5, h * 0.12), 3);
    ctx.fill();
  }

  switch (key.kind) {
    case 'miniM1':
    case 'miniM2': {
      // 薄型ボックス：底面の黒いベースとステータスLED
      ctx.fillStyle = 'rgba(30,34,40,0.55)';
      roundRect(ctx, w * 0.12, h - 8, w * 0.76, 5, 2);
      ctx.fill();
      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(w - 10, h * 0.45, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'miniM4': {
      // Keep the classic cell size; horizontal USB-C openings and headphone
      // jack use the same normalized locations as the solid renderer.
      ctx.fillStyle = 'rgba(30,34,40,0.6)';
      for(const x of [-20/127,-1/127]){roundRect(ctx,w*(.5+x-3.85/127),h*.63-w*1.45/127,w*7.7/127,w*2.9/127,w*.65/127);ctx.fill();}
      ctx.beginPath();ctx.arc(w*(.5+24/127),h*.63,w*1.75/127,0,Math.PI*2);ctx.fill();
      ctx.fillRect(w*.12,h-1.5,w*.76,.8);
      ctx.fillStyle='#def5e4';ctx.beginPath();ctx.arc(w*.85,h*.62,.6,0,Math.PI*2);ctx.fill();
      break;
    }
    case 'studio': {
      // 前面ポート列＋カードスロット
      ctx.fillStyle = 'rgba(28,32,38,0.6)';
      const py = h - Math.min(22, h * 0.45);
      for (let i = 0; i < 2; i++) {
        roundRect(ctx, 12 + i * 10, py, 5, 10, 2);
        ctx.fill();
      }
      roundRect(ctx, 38, py + 3, 18, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(w - 12, py + 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // 底面の通気リング
      ctx.strokeStyle = 'rgba(30,34,40,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, h - 5);
      ctx.lineTo(w - 10, h - 5);
      ctx.stroke();
      break;
    }
    case 'pro': {
      // タワー：格子状の通気パターン＋上部ハンドル
      ctx.fillStyle = 'rgba(25,28,34,0.55)';
      const top = key.cutTop ? 6 : 16;
      const bottom = key.cutBottom ? 6 : 12;
      for (let y = top; y < h - bottom; y += 7) {
        const off = (Math.round(y / 7) % 2) * 3.5;
        for (let x = 8 + off; x < w - 7; x += 7) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!key.cutTop) {
        ctx.strokeStyle = 'rgba(30,34,40,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, 10);
        ctx.lineTo(w - 8, 10);
        ctx.stroke();
      }
      break;
    }
  }

  // ラベル（製品ロゴではなく、ゲーム内の識別用テキスト）
  if (w >= 30 && h >= 24) {
    // 黒い筐体では暗い文字が見えないため、Late 2013 だけ明るい文字にする
    ctx.fillStyle = key.kind === 'macPro2013' ? 'rgba(220,226,236,0.85)' : 'rgba(25,28,34,0.8)';
    ctx.font = `bold ${key.kind === 'miniM4' ? 8 : 9}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const ly = key.kind === 'pro' ? Math.min(h - 6, h * 0.92) : key.kind === 'macPro2013' ? Math.min(h - 8, h * 0.82) : h * 0.4;
    ctx.fillText(spec.label, 6, ly);
  }

  // 整備済タグ
  if (key.refurb) {
    ctx.fillStyle = '#21a366';
    roundRect(ctx, w - 26, 4, 22, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('整備済', w - 15, 9.5);
  }

  // 断片の切断面（ギザギザ）
  const jag = (y: number, dir: number) => {
    ctx.strokeStyle = '#ff6e8a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 2, i = 0; x <= w - 2; x += 5, i++) {
      const yy = y + (i % 2 === 0 ? 0 : 3 * dir);
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  };
  if (key.cutTop) jag(2.5, 1);
  if (key.cutBottom) jag(h - 2.5, -1);
}

/** Front projection in the same real-world XY coordinates as the collider. */
function drawRealDevice(ctx:CanvasRenderingContext2D,key:SpriteKey):void {
 const w=key.wCells*CELL,h=key.hCells*CELL;
 if(key.kind==='macPro2013'){drawMacPro2013Body(ctx,w,h,CELL);return;}
 const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d2d6dc');g.addColorStop(1,'#a8aeb8');ctx.fillStyle=g;
 roundRect(ctx,.15,.15,w-.3,h-.3,Math.min(1.2,h*.08));ctx.fill();
 ctx.fillStyle='#4d535c';ctx.fillRect(w*.1,h-.7,w*.8,.55);
 if(key.kind==='pro'){
   ctx.fillStyle='#4e5661';for(let y=8;y<h-7;y+=4)for(let x=6+(Math.round(y/4)%2)*2;x<w-5;x+=4){ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill();}
   ctx.strokeStyle='#e4e6eb';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(w*.12,1);ctx.lineTo(w*.88,1);ctx.stroke();
 } else {
   ctx.fillStyle='#2a3039';
   if(key.kind==='miniM4'||key.kind==='studio'){
     const py=h*.63;
     for(const x of [w*.23,w*.38]){roundRect(ctx,x,py-1,w*.065,1.5,.5);ctx.fill();}
     if(key.kind==='miniM4'){ctx.beginPath();ctx.arc(w*.69,py,.65,0,Math.PI*2);ctx.fill();}
     else ctx.fillRect(w*.52,py,w*.2,.7);
   }
   ctx.fillStyle='#e3f6e8';ctx.beginPath();ctx.arc(w*.85,h*.6,.55,0,Math.PI*2);ctx.fill();
 }
 if(key.refurb){ctx.fillStyle='#21a366';roundRect(ctx,w-10,1,8,3,1);ctx.fill();}
}

export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private scale = 1;

  setScale(s: number): void {
    if (Math.abs(s - this.scale) > 1e-3) {
      this.scale = s;
      this.cache.clear();
    }
  }

  get(key: SpriteKey): HTMLCanvasElement {
    const id = `${key.mode??'classic'}|${key.kind}|${key.wCells}x${key.hCells}|${key.refurb ? 1 : 0}${key.cutTop ? 1 : 0}${key.cutBottom ? 1 : 0}`;
    let c = this.cache.get(id);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(key.wCells * CELL * this.scale));
      c.height = Math.max(1, Math.ceil(key.hCells * CELL * this.scale));
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.scale(this.scale, this.scale);
        drawDevice(ctx, key);
      }
      this.cache.set(id, c);
    }
    return c;
  }

  get size(): number {
    return this.cache.size;
  }
}

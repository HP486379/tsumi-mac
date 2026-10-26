/**
 * Mac Pro (Late 2013) の正面イラスト本体（Canvas手続き描画・実製品の画像やロゴは不使用）。
 * 正面は円筒を真横から見るのでシルエットは角丸の矩形（直径×高さ）。
 * 曲面は横グラデーション（左右の暗部、左寄りの細い光沢帯、右の弱い反射）で表す。
 * ラベル・整備済タグ・切断面は drawDevice の共通処理で重ねる。座標は drawDevice と同じ（左上0,0）。
 */
export function drawMacPro2013Body(ctx: CanvasRenderingContext2D, w: number, h: number, cell: number): void {
  const pad = 1.2, r = Math.min(10, w / 4, h / 3);
  const x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
  ctx.lineTo(x1, y1 - r); ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.lineTo(x0 + r, y1); ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
  ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#06070a'); g.addColorStop(0.18, '#1b1e25'); g.addColorStop(0.3, '#6f788a');
  g.addColorStop(0.36, '#2a2e37'); g.addColorStop(0.7, '#15171c'); g.addColorStop(0.86, '#3c424e'); g.addColorStop(1, '#050608');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.stroke();
  // 天面の縁（リップ）と下端の暗部
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x0 + r * 0.6, y0 + 1.5, (x1 - x0) - r * 1.2, Math.min(4, h * 0.05));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x0 + r * 0.6, y1 - Math.min(7, h * 0.07), (x1 - x0) - r * 1.2, Math.min(5, h * 0.05));
  // 上部の吸排気スリット（高さが十分なときだけ）
  if (h >= 2 * cell) {
    ctx.strokeStyle = 'rgba(160,170,190,0.18)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = y0 + h * 0.18 + i * 3.2;
      ctx.beginPath(); ctx.moveTo(x0 + w * 0.22, y); ctx.lineTo(x1 - w * 0.12, y); ctx.stroke();
    }
  }
}

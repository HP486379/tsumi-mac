import { WIDTH, HEIGHT, CELL, DANGER } from "../../data/devices";
import type { Game } from "../engine/Game";
export function draw(ctx: CanvasRenderingContext2D, game: Game) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#202a30";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#ffffff09";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += CELL) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = 0; y <= HEIGHT; y += CELL) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();
  ctx.fillStyle = game.danger.elapsed > 0 ? "#ed785d2a" : "#ed785d09";
  ctx.fillRect(0, 0, WIDTH, DANGER);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = game.danger.elapsed > 0 ? "#ff8c70" : "#d1897280";
  ctx.beginPath();
  ctx.moveTo(0, DANGER);
  ctx.lineTo(WIDTH, DANGER);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "9px monospace";
  ctx.fillStyle = "#db9d87";
  ctx.fillText("置きすぎ注意 / DANGER", 12, DANGER - 9);
  for (const entry of game.entries) {
    const b = entry.body,
      d = entry.device,
      w = d.cols * 36 - 0.6,
      h = d.rows * 36 - 0.6;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.shadowColor = "#00000040";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, Math.min(5, h / 5));
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = entry === game.active ? "#fffc" : "#1b27304a";
    ctx.lineWidth = entry === game.active ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff55";
    ctx.fillRect(-w / 2 + 5, -h / 2 + 3, w - 10, 1);
    if (d.id === "pro") {
      ctx.fillStyle = "#66717a";
      for (let y = -h / 2 + 16; y < h / 2 - 20; y += 8)
        for (let x = -w / 2 + 10; x < w / 2 - 5; x += 8) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, 7);
          ctx.fill();
        }
    }
    ctx.fillStyle = "#34454e";
    ctx.font = `600 ${w < 40 ? 9 : 11}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(d.name, 0, d.id === "pro" ? h / 2 - 12 : 3);
    ctx.fillStyle = "#457965";
    ctx.beginPath();
    ctx.arc(w / 2 - 8, h / 2 - 7, 1.7, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  if (!game.entries.length) {
    ctx.textAlign = "center";
    ctx.font = "12px monospace";
    ctx.fillStyle = "#b9c1be55";
    ctx.fillText("YOUR DESK. YOUR CHOICES.", 180, HEIGHT - 22);
  }
}

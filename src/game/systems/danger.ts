/**
 * 危険ライン監視。操作対象（出現直後〜確定前）を除くボディの上端が
 * 危険ラインを超えた状態が連続して timeout 秒続いたらゲームオーバー。
 * 一時的な跳ね上がり（途中で解消）はタイマーをリセットする。
 */
import { DANGER_TIMEOUT_S, DANGER_Y } from '../config';

export class DangerMonitor {
  elapsed = 0;
  constructor(private readonly lineY = DANGER_Y, private readonly timeoutS = DANGER_TIMEOUT_S) {}

  /** @param tops 判定対象ボディの上端Y（操作対象は呼び出し側で除外） */
  update(dtS: number, tops: number[]): boolean {
    const over = tops.some((t) => t < this.lineY);
    if (over) this.elapsed += dtS;
    else this.elapsed = 0;
    return this.elapsed >= this.timeoutS - 1e-9;
  }

  get ratio(): number {
    return Math.min(1, this.elapsed / this.timeoutS);
  }

  reset(): void {
    this.elapsed = 0;
  }
}

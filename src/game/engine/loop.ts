/**
 * 固定時間ステップ・アキュムレータ。描画（rAF）と物理更新（60Hz）を分離し、
 * フレーム遅延時は1フレームあたりのステップ数を上限で打ち切る（スパイラル・オブ・デス防止）。
 */
import { MAX_STEPS_PER_FRAME, STEP_MS } from '../config';

export class FixedStepper {
  private acc = 0;
  /** 打ち切られた（捨てた）時間の累計。デバッグ用 */
  dropped = 0;

  constructor(private readonly stepMs = STEP_MS, private readonly maxSteps = MAX_STEPS_PER_FRAME) {}

  /** 経過時間を加算し、今フレームで実行すべきステップ数を返す */
  advance(frameMs: number): number {
    if (!Number.isFinite(frameMs) || frameMs < 0) frameMs = 0;
    // タブ復帰などの巨大な差分は丸める
    this.acc += Math.min(frameMs, 250);
    let steps = Math.floor(this.acc / this.stepMs);
    if (steps > this.maxSteps) {
      this.dropped += (steps - this.maxSteps) * this.stepMs;
      steps = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc -= steps * this.stepMs;
    }
    return steps;
  }

  /** 補間係数（0..1） */
  get alpha(): number {
    return this.acc / this.stepMs;
  }

  reset(): void {
    this.acc = 0;
  }
}

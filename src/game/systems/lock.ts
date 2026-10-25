/** 接地後の配置確定判定：位置と速度が LOCK_DELAY 秒連続で安定したら確定 */
import { LOCK_ANGULAR_EPS, LOCK_DELAY_S, LOCK_FORCE_S, LOCK_SPEED_EPS } from '../config';

export class LockMonitor {
  stable = 0;
  total = 0;
  private lastX = NaN;
  private lastY = NaN;

  constructor(
    private readonly delayS = LOCK_DELAY_S,
    private readonly speedEps = LOCK_SPEED_EPS,
    private readonly angEps = LOCK_ANGULAR_EPS,
    private readonly forceS = LOCK_FORCE_S,
  ) {}

  reset(): void {
    this.stable = 0;
    this.total = 0;
    this.lastX = NaN;
    this.lastY = NaN;
  }

  /** @returns true なら配置確定 */
  update(dtS: number, x: number, y: number, speed: number, angularSpeed: number): boolean {
    this.total += dtS;
    const moved = Number.isNaN(this.lastX) ? 0 : Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x;
    this.lastY = y;
    if (speed < this.speedEps && angularSpeed < this.angEps && moved < this.speedEps) this.stable += dtS;
    else this.stable = 0;
    return this.stable >= this.delayS - 1e-9 || this.total >= this.forceS;
  }
}

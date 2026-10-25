/**
 * スコア台帳。散財総額・整理額・積みMac指数（盤面残存価値）を二重計上なく管理する。
 * 不変条件： spent = fieldValue + clearedValue （誤差1円未満）
 */
import { LINES_PER_LEVEL, MAX_LEVEL } from '../config';

export interface ScoreSnapshot {
  spent: number;
  cleared: number;
  fieldValue: number;
  lines: number;
  combo: number;
  maxCombo: number;
  level: number;
  timeMs: number;
  devices: number;
}

export class ScoreLedger {
  private spentIds = new Set<number>();
  private values = new Map<number, number>();
  spent = 0;
  cleared = 0;
  lines = 0;
  combo = 0;
  maxCombo = 0;
  timeMs = 0;
  devices = 0;

  /** デバイス出現時に1回だけ計上。同じIDを再登録しても二重計上しない */
  registerPurchase(id: number, price: number): boolean {
    if (this.spentIds.has(id)) return false;
    this.spentIds.add(id);
    this.spent += price;
    this.devices += 1;
    this.values.set(id, price);
    return true;
  }

  /** 行消去でボディが分割されたとき：元ボディの価値を断片へ移し、消えた分を整理額へ */
  applySplit(sourceId: number, fragments: Array<{ id: number; value: number }>): number {
    const before = this.values.get(sourceId);
    if (before === undefined) return 0; // 既に処理済み（二重計上防止）
    this.values.delete(sourceId);
    let rest = 0;
    for (const f of fragments) {
      this.values.set(f.id, f.value);
      rest += f.value;
    }
    // 按分誤差を整理額側で吸収して不変条件を保つ
    const clearedActual = before - rest;
    this.cleared += clearedActual;
    return clearedActual;
  }

  /** ボディ全体を整理（簡易方式・盤面外落下時の安全策）。散財総額は取り消さない */
  removeEntity(id: number): number {
    const v = this.values.get(id);
    if (v === undefined) return 0;
    this.values.delete(id);
    this.cleared += v;
    return v;
  }

  valueOf(id: number): number {
    return this.values.get(id) ?? 0;
  }

  get fieldValue(): number {
    let s = 0;
    for (const v of this.values.values()) s += v;
    return s;
  }

  /** 直前の配置で行消去が起きたか */
  private clearedThisPlacement = false;

  /**
   * 新しいデバイスが配置確定した瞬間に呼ぶ。
   * 直前の配置（前回確定〜今回確定まで）で行消去が起きていなければコンボを切る。
   */
  beginPlacement(): void {
    if (!this.clearedThisPlacement) this.combo = 0;
    this.clearedThisPlacement = false;
  }

  /** 行消去イベント。1配置につきコンボは最大1加算（連鎖消去は同一配置の成果として扱う） */
  registerClear(rows: number): number {
    if (rows <= 0) return this.combo;
    this.lines += rows;
    if (!this.clearedThisPlacement) {
      this.clearedThisPlacement = true;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }
    return this.combo;
  }

  get level(): number {
    return Math.min(MAX_LEVEL, 1 + Math.floor(this.lines / LINES_PER_LEVEL));
  }

  snapshot(): ScoreSnapshot {
    return {
      spent: this.spent,
      cleared: this.cleared,
      fieldValue: this.fieldValue,
      lines: this.lines,
      combo: this.combo,
      maxCombo: this.maxCombo,
      level: this.level,
      timeMs: this.timeMs,
      devices: this.devices,
    };
  }
}

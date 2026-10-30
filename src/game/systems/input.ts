/** 入力アクション定義とキーボード割り当て */
export type Action = 'left' | 'right' | 'rotateR' | 'rotateL' | 'soft' | 'hard' | 'pause' | 'fine';

export const KEY_MAP: Record<string, Action> = {
  ShiftLeft: 'fine',
  ShiftRight: 'fine',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'rotateR',
  KeyX: 'rotateR',
  KeyZ: 'rotateL',
  ArrowDown: 'soft',
  Space: 'hard',
  KeyP: 'pause',
  Escape: 'pause',
};

export function actionForKey(code: string): Action | undefined {
  return KEY_MAP[code];
}

/** 押下状態とワンショット入力のキュー */
export class InputState {
  held = new Set<Action>();
  queue: Action[] = [];
  /** 左右オートリピート用タイマー（ms） */
  repeatTimer = 0;
  repeatDir: 'left' | 'right' | null = null;
  repeating = false;

  press(a: Action): void {
    if (this.held.has(a) && (a === 'left' || a === 'right' || a === 'soft' || a === 'fine')) return;
    this.held.add(a);
    if (a === 'fine') return;
    if (a === 'left' || a === 'right') {
      this.repeatDir = a;
      this.repeatTimer = 0;
      this.repeating = false;
    }
    this.queue.push(a);
  }

  release(a: Action): void {
    this.held.delete(a);
    if (this.repeatDir === a) {
      const other = a === 'left' ? 'right' : 'left';
      this.repeatDir = this.held.has(other) ? other : null;
      this.repeatTimer = 0;
      this.repeating = false;
    }
  }

  clear(): void {
    this.held.clear();
    this.queue = [];
    this.repeatDir = null;
    this.repeatTimer = 0;
    this.repeating = false;
  }
}

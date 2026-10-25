import { describe, expect, it } from 'vitest';
import { DangerMonitor } from '../game/systems/danger';
import { LockMonitor } from '../game/systems/lock';
import { FixedStepper } from '../game/engine/loop';
import { Spawner } from '../game/systems/spawner';
import { DEVICE_KINDS, DEVICES } from '../data/devices';
import { DANGER_Y, STEP_MS } from '../game/config';
import { InputState, actionForKey } from '../game/systems/input';

const DT = STEP_MS / 1000;

describe('危険ライン（2秒判定）', () => {
  it('2秒未満では終了せず、2秒継続で終了', () => {
    const d = new DangerMonitor();
    let over = false;
    for (let i = 0; i < 119; i++) over = d.update(DT, [DANGER_Y - 10]);
    expect(over).toBe(false);
    over = d.update(DT, [DANGER_Y - 10]);
    expect(over).toBe(true);
  });

  it('一時的な跳ね上がり（途中で解消）ではリセットされる', () => {
    const d = new DangerMonitor();
    for (let i = 0; i < 100; i++) d.update(DT, [DANGER_Y - 5]);
    d.update(DT, [DANGER_Y + 5]);
    expect(d.elapsed).toBe(0);
    let over = false;
    for (let i = 0; i < 100; i++) over = d.update(DT, [DANGER_Y - 5]);
    expect(over).toBe(false);
  });

  it('ラインちょうどは超過ではない', () => {
    const d = new DangerMonitor();
    for (let i = 0; i < 200; i++) d.update(DT, [DANGER_Y]);
    expect(d.elapsed).toBe(0);
  });
});

describe('配置確定（0.8秒安定）', () => {
  it('静止0.8秒で確定、途中で動くとリセット', () => {
    const l = new LockMonitor();
    let locked = false;
    for (let i = 0; i < 47; i++) locked = l.update(DT, 100, 100, 0, 0);
    expect(locked).toBe(false);
    l.update(DT, 100, 100, 1.0, 0);
    expect(l.stable).toBe(0);
    for (let i = 0; i < 48; i++) locked = l.update(DT, 100, 100, 0, 0);
    expect(locked).toBe(true);
  });

  it('転がり続けても5秒で強制確定', () => {
    const l = new LockMonitor();
    let locked = false;
    let i = 0;
    while (!locked && i < 1000) {
      locked = l.update(DT, i, 100, 1, 0);
      i++;
    }
    expect(i).toBeLessThan(310);
  });
});

describe('固定時間ステップ', () => {
  it('16.67msで1ステップ、遅延時は上限4ステップ', () => {
    const s = new FixedStepper();
    expect(s.advance(STEP_MS)).toBe(1);
    expect(s.advance(STEP_MS * 0.5)).toBe(0);
    expect(s.advance(STEP_MS * 0.5)).toBe(1);
    expect(s.advance(200)).toBe(4);
    expect(s.dropped).toBeGreaterThan(0);
    expect(s.advance(-5)).toBe(0);
  });
});

describe('出現（Spawner）', () => {
  it('5種類すべてが出現する', () => {
    const sp = new Spawner(1);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add(sp.next().kind);
    for (const k of DEVICE_KINDS) expect(seen.has(k)).toBe(true);
  });

  it('どのシードでも10個以内に全種類が出る（未出現保証）', () => {
    for (let seed = 1; seed < 40; seed++) {
      const sp = new Spawner(seed);
      const seen = new Set<string>();
      for (let i = 0; i < 14; i++) seen.add(sp.next().kind);
      expect(seen.size).toBe(5);
    }
  });

  it('整備済製品入荷：次以降の3台が15%オフ', () => {
    const sp = new Spawner(3);
    sp.next();
    sp.triggerEvent('refurb');
    sp.next(); // 表示中だったNEXTはそのまま
    const t = [sp.next(), sp.next(), sp.next()];
    for (const x of t) {
      expect(x.refurb).toBe(true);
      expect(x.price).toBe(Math.round(DEVICES[x.kind].price * 0.85));
    }
    expect(sp.next().refurb).toBe(false);
  });

  it('新製品発表：高額機が入荷する', () => {
    const sp = new Spawner(5);
    sp.triggerEvent('launch');
    sp.next();
    const a = sp.next();
    const b = sp.next();
    expect(['pro', 'studio']).toContain(a.kind);
    expect(['pro', 'studio']).toContain(b.kind);
  });

  it('force で次のデバイスを指定できる', () => {
    const sp = new Spawner(9);
    sp.force('pro');
    expect(sp.next().kind).toBe('pro');
  });
});

describe('入力', () => {
  it('キー割り当て', () => {
    expect(actionForKey('ArrowLeft')).toBe('left');
    expect(actionForKey('ArrowUp')).toBe('rotateR');
    expect(actionForKey('KeyX')).toBe('rotateR');
    expect(actionForKey('KeyZ')).toBe('rotateL');
    expect(actionForKey('ArrowDown')).toBe('soft');
    expect(actionForKey('Space')).toBe('hard');
    expect(actionForKey('KeyP')).toBe('pause');
    expect(actionForKey('Escape')).toBe('pause');
    expect(actionForKey('KeyQ')).toBe(undefined);
  });

  it('押しっぱなしの重複押下は無視、離すとリピート解除', () => {
    const s = new InputState();
    s.press('left');
    s.press('left');
    expect(s.queue).toEqual(['left']);
    s.release('left');
    expect(s.repeatDir).toBe(null);
  });
});

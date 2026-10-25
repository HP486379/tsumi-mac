import Matter from 'matter-js';
/**
 * Matter.js を使った統合テスト（GameSim を Node 上で直接動かす）。
 */
import { describe, expect, it } from 'vitest';
import { GameSim } from '../game/engine/GameSim';
import { CELL, COLS, DANGER_Y, FIELD_H, FIELD_W } from '../game/config';
import { DEVICE_KINDS, DEVICES, type DeviceKind } from '../data/devices';

function newSim(opts: { autoSpawn?: boolean } = {}) {
  const over: string[] = [];
  const sim = new GameSim({ onGameOver: (r) => over.push(r) }, { seed: 42, autoSpawn: opts.autoSpawn ?? false, randomEvents: false });
  return { sim, over };
}

function steps(sim: GameSim, n: number) {
  for (let i = 0; i < n; i++) sim.step();
}

/** 操作対象が確定するまで進める */
function runUntilLocked(sim: GameSim, max = 1200): number {
  const a = sim.active;
  let i = 0;
  while (sim.active === a && a && i < max && sim.status === 'running') {
    sim.step();
    i++;
  }
  return i;
}

function spawn(sim: GameSim, kind: DeviceKind) {
  sim.spawner.force(kind);
  const e = sim.spawnNext();
  if (!e) throw new Error('spawn failed');
  return e;
}

function invariant(sim: GameSim) {
  const s = sim.score();
  expect(Math.abs(s.spent - (s.fieldValue + s.cleared))).toBeLessThan(1);
}

describe('デバイス出現', () => {
  it('5種類すべてが正しい寸法・質量・価格で出現する', () => {
    for (const k of DEVICE_KINDS) {
      const { sim } = newSim();
      const e = spawn(sim, k);
      const spec = DEVICES[k];
      const b = e.body.bounds;
      expect(b.max.x - b.min.x).toBeCloseTo(spec.w * CELL, 3);
      expect(b.max.y - b.min.y).toBeCloseTo(spec.h * CELL, 3);
      expect(b.min.y).toBeCloseTo(0, 3);
      expect(e.body.mass).toBeCloseTo(spec.mass, 3);
      expect(sim.score().spent).toBe(spec.price);
      sim.destroy();
    }
  });
});

describe('物理挙動', () => {
  it('床を突き抜けない（最重量の Mac Pro をハードドロップ）', () => {
    const { sim } = newSim();
    const e = spawn(sim, 'pro');
    sim.hardDrop();
    runUntilLocked(sim);
    expect(sim.escaped).toBe(0);
    expect(e.body.bounds.max.y).toBeLessThan(FIELD_H + 2);
    expect(e.body.bounds.max.y).toBeGreaterThan(FIELD_H - 3);
  });

  it('壁を突き抜けない（左右に押し続けても盤面内）', () => {
    for (const dir of [-1, 1] as const) {
      const { sim } = newSim();
      const e = spawn(sim, 'studio');
      for (let i = 0; i < 20; i++) sim.tryMove(dir);
      sim.hardDrop();
      runUntilLocked(sim);
      expect(e.body.bounds.min.x).toBeGreaterThan(-2);
      expect(e.body.bounds.max.x).toBeLessThan(FIELD_W + 2);
      expect(sim.escaped).toBe(0);
    }
  });

  it('回転後の当たり判定：縦にしたMac miniは1列幅になり、壁際で回転できる', () => {
    const { sim } = newSim();
    const e = spawn(sim, 'miniM1');
    expect(sim.tryRotate(1)).toBe(true);
    const b = e.body.bounds;
    expect(b.max.x - b.min.x).toBeCloseTo(CELL, 1);
    expect(b.max.y - b.min.y).toBeCloseTo(2 * CELL, 1);
    for (let i = 0; i < 20; i++) sim.tryMove(1);
    expect(e.body.bounds.max.x).toBeCloseTo(FIELD_W, 1);
    // 壁際で横向きに戻す → 左へキックされて盤面内に収まる
    expect(sim.tryRotate(1)).toBe(true);
    expect(e.body.bounds.max.x).toBeLessThan(FIELD_W + 0.5);
  });

  it('回転で既存ボディと重なる場合は回転しない（縦穴の中）', () => {
    const { sim } = newSim();
    const m = spawn(sim, 'miniM1');
    expect(sim.tryRotate(1)).toBe(true); // 縦 1x2

    // 物理演算で壁が移動したり行消去が発生したりしないよう、
    // テスト対象を縦穴の中に直接置いて衝突判定だけを検証する。
    Matter.Body.setPosition(m.body, { x: 4.5 * CELL, y: 7 * CELL });
    // キックの最大左右2セル・上1セルを塞ぐ厚い壁を設置する。
    for (let r = 3; r <= 11; r++) {
      for (const c of [2, 3, 5, 6]) {
        const wall = sim.placeLocked('miniM4', c, r);
        Matter.Body.setStatic(wall.body, true);
      }
    }
    expect(sim.tryRotate(1)).toBe(false);
    expect(sim.tryRotate(-1)).toBe(false);
    expect(sim.rotationQuadrant).toBe(1);
    sim.destroy();
  });

  it('デバイス同士が衝突して積み重なる（重なり・すり抜けなし）', () => {
    const { sim } = newSim();
    const a = spawn(sim, 'studio');
    sim.hardDrop();
    runUntilLocked(sim);
    const b = spawn(sim, 'miniM1');
    sim.hardDrop();
    runUntilLocked(sim);
    steps(sim, 60);
    // b は a の上に載る
    expect(b.body.bounds.max.y).toBeLessThan(a.body.bounds.min.y + 3);
    expect(a.body.bounds.max.y).toBeGreaterThan(FIELD_H - 3);
  });

  it('重量差で挙動が変わる：重い Mac Pro は下の軽いデバイスを大きく押し動かす', () => {
    const push = (kind: DeviceKind) => {
      const { sim } = newSim();
      // 盤面中央付近の床に M4 を1つ置き、その上に半分ずらして落とす
      const target = sim.placeLocked('miniM4', 4, 17);
      steps(sim, 30);
      const x0 = target.body.position.x;
      const e = spawn(sim, kind);
      // 右端がtargetの左半分に乗るように配置
      const W = DEVICES[kind].w;
      while (e.body.bounds.max.x > 4 * CELL + CELL / 2 + 1 && sim.tryMove(-1)) { /* move */ }
      while (e.body.bounds.max.x < 4 * CELL + CELL / 2 - 1 && sim.tryMove(1)) { /* move */ }
      void W;
      sim.hardDrop();
      steps(sim, 240);
      const dx = Math.abs(target.body.position.x - x0);
      const dy = target.body.position.y;
      sim.destroy();
      return { dx, dy };
    };
    const light = push('miniM4');
    const heavy = push('pro');
    // 重い方が、ターゲットをより大きく動かす（横方向の変位）
    expect(heavy.dx).toBeGreaterThan(light.dx);
  });
});

describe('行消去（物理と論理グリッドの統合）', () => {
  it('1行消去：床の行が揃うと整理され、価格の二重計上がない', () => {
    const { sim } = newSim();
    for (let c = 0; c < COLS; c += 2) sim.placeLocked('miniM1', c, 17);
    steps(sim, 20);
    const s = sim.score();
    expect(s.lines).toBe(1);
    expect(sim.entities.size).toBe(0);
    expect(s.cleared).toBeCloseTo(250_000, 3);
    expect(s.fieldValue).toBeCloseTo(0, 3);
    invariant(sim);
  });

  it('複数行消去：2行同時に揃うと2行整理される', () => {
    const { sim } = newSim();
    for (const r of [16, 17]) for (let c = 0; c < COLS; c += 2) sim.placeLocked('miniM2', c, r);
    steps(sim, 20);
    expect(sim.score().lines).toBe(2);
    expect(sim.entities.size).toBe(0);
    invariant(sim);
  });

  it('部分消去：Mac Pro は消去行だけ切り取られ、整理額は面積比で按分', () => {
    const { sim } = newSim();
    sim.placeLocked('pro', 0, 14); // 行14..17, 列0..1
    for (let c = 2; c < COLS; c += 2) sim.placeLocked('miniM1', c, 17);
    steps(sim, 20);
    const s = sim.score();
    expect(s.lines).toBe(1);
    expect(sim.entities.size).toBe(1);
    const frag = [...sim.entities.values()][0]!;
    expect(frag.fragment).toBe(true);
    expect(frag.hCells).toBe(3);
    expect(s.cleared).toBeCloseTo(250_000 + 200_000, 3);
    expect(s.fieldValue).toBeCloseTo(750_000, 3);
    invariant(sim);
  });

  it('行消去後の残存ボディは重力で落下して安定し、盤面外へ出ない', () => {
    const { sim } = newSim();
    sim.placeLocked('pro', 0, 14);
    for (let c = 2; c < COLS; c += 2) sim.placeLocked('miniM1', c, 17);
    sim.placeLocked('studio', 3, 15); // 行15..16, 列3..5（行17の上に載る）
    steps(sim, 20);
    expect(sim.score().lines).toBe(1);
    steps(sim, 300);
    for (const e of sim.entities.values()) {
      expect(e.body.speed).toBeLessThan(0.3);
      expect(e.body.bounds.max.y).toBeLessThan(FIELD_H + 2);
    }
    // Studio は1セル分落下して床に着地
    const studio = [...sim.entities.values()].find((e) => e.kind === 'studio')!;
    expect(studio.body.bounds.max.y).toBeGreaterThan(FIELD_H - 3);
    expect(sim.escaped).toBe(0);
    invariant(sim);
  });

  it('9セルしか埋まっていない行は消えない（意図しない大量消去がない）', () => {
    const { sim } = newSim();
    for (let c = 0; c < 8; c += 2) sim.placeLocked('miniM1', c, 17);
    sim.placeLocked('miniM4', 8, 17);
    steps(sim, 60);
    expect(sim.score().lines).toBe(0);
    expect(sim.entities.size).toBe(5);
  });

  it('実際の操作で行を完成させても整理される', () => {
    const { sim } = newSim();
    for (let c = 0; c < 8; c += 2) sim.placeLocked('miniM1', c, 17);
    steps(sim, 30);
    const e = spawn(sim, 'miniM1');
    for (let i = 0; i < 10; i++) sim.tryMove(1);
    expect(e.body.bounds.max.x).toBeCloseTo(FIELD_W, 1);
    sim.hardDrop();
    runUntilLocked(sim);
    steps(sim, 30);
    expect(sim.score().lines).toBe(1);
    invariant(sim);
  });
});

describe('ゲームオーバー', () => {
  it('出現直後の操作対象（危険ライン内）では終了しない', () => {
    const { sim, over } = newSim();
    spawn(sim, 'pro'); // 高さ4セルで危険ラインをまたいで出現
    steps(sim, 10);
    expect(sim.danger.elapsed).toBe(0);
    expect(over).toHaveLength(0);
  });

  it('確定済みボディが危険ラインを2秒超え続けると終了（2秒未満では終了しない）', () => {
    const { sim, over } = newSim();
    // 床から8列幅のレンガ積みで上端を危険ラインより上に（9・10列目は空けて行消去を防ぐ）
    for (let r = 1; r < 18; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < 8; c += 2) sim.placeLocked('miniM1', c, r);
      } else {
        sim.placeLocked('miniM4', 0, r);
        for (let c = 1; c < 7; c += 2) sim.placeLocked('miniM1', c, r);
        sim.placeLocked('miniM4', 7, r);
      }
    }
    steps(sim, 60);
    const top = Math.min(...[...sim.entities.values()].map((e) => e.body.bounds.min.y));
    expect(top).toBeLessThan(DANGER_Y);
    const t0 = sim.danger.elapsed;
    steps(sim, Math.floor((2 - t0) * 60) - 3);
    expect(over).toHaveLength(0);
    steps(sim, 10);
    expect(over).toEqual(['danger']);
    expect(sim.status).toBe('over');
  });

  it('出現位置が塞がっている場合は終了', () => {
    const { sim, over } = newSim();
    sim.placeLocked('studio', 3, 0);
    sim.spawner.force('miniM1');
    expect(sim.spawnNext()).toBe(null);
    expect(over).toEqual(['spawn']);
  });

  it('自動進行でいつか必ず終了し、価格の整合性が保たれる', () => {
    const { sim, over } = newSim({ autoSpawn: true });
    let i = 0;
    while (sim.status === 'running' && i < 60 * 60 * 6) {
      if (sim.active && sim.active.state === 'falling' && i % 7 === 0) {
        sim.tryMove(i % 14 === 0 ? -1 : 1);
        sim.hardDrop();
      }
      sim.step();
      i++;
    }
    expect(over.length).toBe(1);
    expect(sim.escaped).toBe(0);
    invariant(sim);
  });
});

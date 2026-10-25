import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameViews } from '../game/rendering/frameViews';
import { projectedDevice, projectPoint } from '../game/rendering/obliqueRenderer';
import type { RenderItem, RenderState } from '../game/rendering/renderer';
import { DEVICE_KINDS, DEVICES } from '../data/devices';
import { CELL, FIELD_H, FIELD_W } from '../game/config';

const state = (): RenderState => ({ items: [], guide: null, dangerRatio: 0, floaters: [], flashes: [], shake: 0, timeMs: 0 });
describe('same-frame view fan-out', () => {
  it('passes the exact same object once to each view, front first', () => {
    const calls: string[] = [], st = state();
    const front = vi.fn((value: RenderState) => { expect(value).toBe(st); calls.push('front'); });
    const side = vi.fn((value: RenderState) => { expect(value).toBe(st); calls.push('side'); });
    const views = new FrameViews({ draw: front }); views.attach({ draw: side }); views.draw(st);
    expect(calls).toEqual(['front', 'side']); expect(front).toHaveBeenCalledOnce(); expect(side).toHaveBeenCalledOnce();
  });
  it('redraws the last frame immediately when opened while paused', () => {
    const views = new FrameViews({ draw: vi.fn() }), st = state(), draw = vi.fn();
    views.draw(st); views.attach({ draw }); expect(draw).toHaveBeenCalledWith(st); expect(views.lastState).toBe(st);
  });
  it('stops auxiliary rendering when collapsed without dropping front updates', () => {
    const front = vi.fn(), side = vi.fn(), views = new FrameViews({ draw: front });
    views.attach({ draw: side }); views.draw(state()); views.attach(null); views.draw(state());
    expect(front).toHaveBeenCalledTimes(2); expect(side).toHaveBeenCalledOnce();
  });
  it('forwards clearing, danger and final frames without stale items', () => {
    const side = vi.fn(), views = new FrameViews({ draw: vi.fn() }); views.attach({ draw: side });
    const a = state(); a.dangerRatio = 0.5; a.flashes = [{ row: 17, life: 0.3 }]; views.draw(a);
    const cleared = state(); cleared.timeMs = 2000; views.draw(cleared);
    expect(side.mock.calls[1]?.[0]).toBe(cleared); expect(views.lastState?.flashes).toEqual([]);
  });
});

describe('oblique geometry', () => {
  it('keeps the shared contact plane affine, including grid boundaries', () => {
    const top = projectPoint(0, 0), bottom = projectPoint(FIELD_W, FIELD_H), middle = projectPoint(FIELD_W / 2, FIELD_H / 2);
    expect(middle.x).toBeCloseTo((top.x + bottom.x) / 2); expect(middle.y).toBeCloseTo((top.y + bottom.y) / 2);
  });
  it.each(DEVICE_KINDS)('preserves %s dimensions, rotation and source state', kind => {
    const spec = DEVICES[kind];
    const item: RenderItem = { x: 180, y: 300, angle: Math.PI / 2, key: { kind, wCells: spec.w, hCells: spec.h, refurb: true, cutTop: false, cutBottom: false }, active: true };
    const before = JSON.stringify(item); const geometry = projectedDevice(item);
    expect(geometry.front[0]).toEqual(projectPoint(180 + spec.h * CELL / 2, 300 - spec.w * CELL / 2));
    expect(geometry.back[0]!.x).toBeGreaterThan(geometry.front[0]!.x);
    expect(geometry.back[0]!.y).toBeLessThan(geometry.front[0]!.y); expect(JSON.stringify(item)).toBe(before);
  });
  it('uses fragment dimensions after partial row clearing', () => {
    const item: RenderItem = { x: 72, y: 610, angle: 0, active: false, key: { kind: 'pro', wCells: 2, hCells: 1, refurb: false, cutTop: true, cutBottom: false } };
    const geometry = projectedDevice(item);
    expect(geometry.front[0]).toEqual(projectPoint(36, 592)); expect(geometry.front[2]).toEqual(projectPoint(108, 628));
  });
});

afterEach(() => vi.restoreAllMocks());

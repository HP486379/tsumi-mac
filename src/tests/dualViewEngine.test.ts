import { afterEach, expect, it, vi } from 'vitest';
import type { RenderState } from '../game/rendering/renderer';
import { GameEngine } from '../game/engine/GameEngine';
import type { AudioManager } from '../game/systems/audio';

vi.mock('../game/rendering/renderer', () => ({ Renderer: class {
  sprites = {}; frames = 0;
  resize() {}
  draw(_state: RenderState) { this.frames++; }
} }));
vi.mock('../game/rendering/obliqueRenderer', () => ({ ObliqueRenderer: class {
  frames = 0; lastState: RenderState | null = null;
  resize() {}
  draw(state: RenderState) { this.lastState = state; this.frames++; }
} }));

function setup() {
  const pending = new Map<number, FrameRequestCallback>(); let serial = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { pending.set(++serial, cb); return serial; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const audio = { play: vi.fn(), startBgm: vi.fn(), stopBgm: vi.fn(), suspend: vi.fn(), resume: vi.fn() } as unknown as AudioManager;
  const engine = new GameEngine({} as HTMLCanvasElement, { onHud: vi.fn(), onMessage: vi.fn(), onGameOver: vi.fn(), onPauseChange: vi.fn() }, audio, 481);
  const frame = (time: number) => {
    expect(pending.size).toBe(1);
    const next = [...pending.entries()][0]!; pending.delete(next[0]); next[1](time);
  };
  return { engine, pending, frame };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('adding a view does not add an animation loop, physics steps or change input/score', () => {
  const run = (dual: boolean) => {
    const { engine, frame, pending } = setup();
    if (dual) engine.setObliqueView({} as HTMLCanvasElement);
    engine.start();
    for (let i = 1; i <= 180; i++) {
      if (i === 10) engine.press('left');
      if (i === 11) engine.release('left');
      if (i === 20) engine.press('rotateR');
      frame(i * 1000 / 60);
      if (dual) expect(engine.debugApi().views().synchronized).toBe(true);
    }
    const st = engine.sim.renderState(), score = engine.sim.score(), steps = engine.sim.stepCount;
    engine.destroy(); expect(pending.size).toBe(0);
    vi.restoreAllMocks();
    return { st, score, steps };
  };
  expect(run(true)).toEqual(run(false));
});

it('open, close, resize and restart while paused do not advance physics', () => {
  const { engine, frame, pending } = setup(); engine.start(); frame(100); engine.pause();
  const before = engine.sim.stepCount;
  engine.setObliqueView({} as HTMLCanvasElement); engine.resizeOblique(200, 352, 2);
  expect(engine.debugApi().views().synchronized).toBe(true); expect(engine.sim.stepCount).toBe(before); expect(pending.size).toBe(0);
  engine.setObliqueView(null); expect(engine.debugApi().views().oblique).toBeNull();
  engine.resume(); frame(200); expect(pending.size).toBe(1);
  engine.restart(); expect(pending.size).toBe(1); engine.destroy(); expect(pending.size).toBe(0);
});

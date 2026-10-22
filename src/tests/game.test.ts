import { describe, expect, it } from "vitest";
import Matter from "matter-js";
import { Game, type Entry } from "../game/engine/Game";
import { DEVICES, DANGER } from "../data/devices";
import { createWorld, deviceBody } from "../game/physics/world";
import { DangerTimer, Ledger } from "../game/systems/score";
function run(game: Game, n: number) {
  for (let i = 0; i < n; i++) game.step();
}
function empty(game: Game) {
  for (const e of game.entries)
    Matter.Composite.remove(game.world.world, e.body);
  game.entries = [];
  game.active = null;
}
function add(
  game: Game,
  device: (typeof DEVICES)[number],
  x: number,
  y: number,
  locked = true,
) {
  const body = deviceBody(device, x, y);
  const e: Entry = {
    id: ++game.serial,
    body,
    device,
    price: device.price,
    locked,
  };
  game.entries.push(e);
  game.ledger.add(e.id, e.price);
  Matter.Composite.add(game.world.world, body);
  if (!locked) game.active = e;
  return e;
}
describe("physics and controls", () => {
  it("creates all five devices with correct mass, dimensions and a complete bag", () => {
    for (const d of DEVICES) {
      const b = deviceBody(d);
      expect(b.mass).toBeCloseTo(d.mass);
      expect(b.bounds.max.x - b.bounds.min.x).toBeCloseTo(d.cols * 36 - 0.6);
      expect(b.bounds.max.y - b.bounds.min.y).toBeCloseTo(d.rows * 36 - 0.6);
    }
    const g = new Game(() => 0.5);
    expect(new Set(g.queue.slice(0, 5).map((d) => d.id)).size).toBe(5);
    g.dispose();
  });
  it("rotation updates collision geometry and rejects wall tunnelling", () => {
    const g = new Game();
    g.start();
    empty(g);
    const e = add(g, DEVICES[0], 180, 180, false);
    g.command("rotate");
    expect(e.body.bounds.max.y - e.body.bounds.min.y).toBeCloseTo(71.4);
    expect(e.body.bounds.max.x - e.body.bounds.min.x).toBeCloseTo(35.4);
    for (let i = 0; i < 50; i++) g.command("left");
    expect(e.body.bounds.min.x).toBeGreaterThanOrEqual(-0.1);
    for (let i = 0; i < 100; i++) g.command("right");
    expect(e.body.bounds.max.x).toBeLessThanOrEqual(360.1);
    g.dispose();
  });
  it("hard drop cannot pass through another device or the floor", () => {
    const g = new Game();
    g.start();
    empty(g);
    add(g, DEVICES[0], 180, 630);
    const e = add(g, DEVICES[0], 180, 100, false);
    g.command("drop");
    expect(e.body.bounds.max.y).toBeLessThanOrEqual(613);
    run(g, 180);
    expect(e.locked).toBe(true);
    expect(e.body.bounds.max.y).toBeLessThan(614);
    for (const b of g.entries) expect(b.body.bounds.max.y).toBeLessThan(649);
    g.dispose();
  });
  it("mass differences produce different impulse responses", () => {
    const light = deviceBody(DEVICES[2]),
      heavy = deviceBody(DEVICES[4]);
    Matter.Body.applyForce(light, light.position, { x: 0.002, y: 0 });
    Matter.Body.applyForce(heavy, heavy.position, { x: 0.002, y: 0 });
    const world = createWorld();
    Matter.Body.setPosition(light, { x: 60, y: 200 });
    Matter.Body.setPosition(heavy, { x: 270, y: 200 });
    Matter.Composite.add(world.world, [light, heavy]);
    Matter.Engine.update(world, 1000 / 60);
    expect(light.velocity.x).toBeGreaterThan(heavy.velocity.x * 5);
    Matter.Engine.clear(world);
  });
  it("keeps the current device active until it has rested for 0.8 seconds", () => {
    const g = new Game();
    g.start();
    empty(g);
    const e = add(g, DEVICES[2], 180, 630, false);
    run(g, 30);
    expect(e.locked).toBe(false);
    run(g, 60);
    expect(e.locked).toBe(true);
    g.dispose();
  });
});
describe("row clearing and accounting", () => {
  it("does not remove the adjacent upper device after solver penetration", () => {
    const g = new Game();
    g.start();
    empty(g);
    for (let i = 0; i < 5; i++) add(g, DEVICES[0], 36 + i * 72, 630);
    const above = add(g, DEVICES[2], 18, 594);
    run(g, 90);
    expect(g.ledger.rows).toBe(1);
    expect(g.ledger.organized).toBe(250000);
    expect(g.entries.some((e) => e.id === above.id)).toBe(true);
    g.dispose();
  });
  it("clears one row, retains the row above without warping, and lets it fall", () => {
    const g = new Game();
    g.start();
    empty(g);
    for (let i = 0; i < 5; i++) add(g, DEVICES[0], 36 + i * 72, 630);
    const above = add(g, DEVICES[2], 18, 594);
    const oldY = above.body.position.y;
    expect(g.clearRows()).toBe(true);
    expect(g.ledger.rows).toBe(1);
    expect(g.ledger.organized).toBe(250000);
    expect(g.entries).toEqual([above]);
    expect(above.body.position.y).toBe(oldY);
    run(g, 180);
    expect(above.body.position.y).toBeGreaterThan(oldY);
    expect(above.body.bounds.max.y).toBeLessThan(649);
    expect(g.ledger.organized).toBe(250000);
    g.dispose();
  });
  it("clears multiple rows and counts intersecting tall devices only once", () => {
    const g = new Game();
    g.start();
    empty(g);
    for (let i = 0; i < 5; i++) add(g, DEVICES[4], 36 + i * 72, 576);
    expect(g.clearRows()).toBe(true);
    expect(g.ledger.rows).toBe(4);
    expect(g.ledger.organized).toBe(5000000);
    expect(g.entries).toHaveLength(0);
    expect(g.clearRows()).toBe(false);
    expect(g.ledger.organized).toBe(5000000);
    g.dispose();
  });
  it("clears exactly two adjacent rows in one stable event", () => {
    const g = new Game();
    g.start();
    empty(g);
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 5; i++)
        add(g, DEVICES[0], 36 + i * 72, 630 - row * 36);
    expect(g.clearRows()).toBe(true);
    expect(g.ledger.rows).toBe(2);
    expect(g.ledger.organized).toBe(500000);
    expect(g.ledger.combo).toBe(1);
    g.dispose();
  });
  it("does not clear unstable bodies during regular stepping", () => {
    const g = new Game();
    g.start();
    empty(g);
    for (let i = 0; i < 5; i++) {
      const e = add(g, DEVICES[0], 36 + i * 72, 630);
      Matter.Body.setVelocity(e.body, { x: 0, y: -3 });
    }
    run(g, 2);
    expect(g.ledger.rows).toBe(0);
    g.dispose();
  });
  it("keeps the ledger idempotent and spent = organized + remaining", () => {
    const l = new Ledger();
    l.add(1, 50000);
    l.add(1, 50000);
    l.add(2, 115000);
    l.clear([1, 1], 1);
    l.clear([1, 999], 1);
    expect(l.spent).toBe(165000);
    expect(l.organized).toBe(50000);
    expect(l.remaining).toBe(115000);
    expect(l.maxCombo).toBe(2);
  });
  it("queues three new devices and applies exactly one refurbished discount", () => {
    const g = new Game();
    g.start();
    for (let i = 0; i < 5; i++) {
      empty(g);
      g.spawn();
    }
    expect(g.count).toBe(6);
    expect(g.queue.slice(0, 3).map((d) => d.id)).toEqual(["m4", "m4", "m4"]);
    for (let i = 0; i < 6; i++) {
      empty(g);
      g.spawn();
    }
    expect(g.count).toBe(12);
    expect(g.discount).toBe(true);
    const expected = g.queue[0].price * 0.8;
    empty(g);
    g.spawn();
    expect(g.active!.price).toBe(expected);
    expect(g.discount).toBe(false);
    empty(g);
    g.spawn();
    expect(g.active!.price).toBe(g.active!.device.price);
    g.dispose();
  });
});
describe("danger, pause, game over and retry", () => {
  it("requires two continuous seconds and resets after temporary bounce", () => {
    const t = new DangerTimer();
    expect(t.update(true, 1999)).toBe(false);
    expect(t.update(false, 20)).toBe(false);
    expect(t.elapsed).toBe(0);
    expect(t.update(true, 1999)).toBe(false);
    expect(t.update(true, 1)).toBe(true);
  });
  it("excludes a newly spawned body and freezes time while paused", () => {
    const g = new Game();
    g.start();
    expect(g.active!.body.bounds.min.y).toBeLessThan(DANGER);
    run(g, 5);
    expect(g.danger.elapsed).toBe(0);
    g.pause();
    const before = g.snapshot();
    run(g, 120);
    expect(g.snapshot()).toEqual(before);
    g.pause();
    run(g, 1);
    expect(g.elapsed).toBeGreaterThan(before.seconds * 1000);
    g.dispose();
  });
  it("ends after a locked device exceeds danger for two seconds", () => {
    const g = new Game();
    g.start();
    empty(g);
    const top = add(g, DEVICES[0], 60, 50);
    Matter.Body.setStatic(top.body, true);
    const active = add(g, DEVICES[2], 260, 300, false);
    Matter.Body.setStatic(active.body, true);
    run(g, 119);
    expect(g.status).toBe("playing");
    run(g, 2);
    expect(g.status).toBe("over");
    g.start();
    expect(g.status).toBe("playing");
    expect(g.entries).toHaveLength(1);
    expect(g.ledger.organized).toBe(0);
    g.dispose();
  });
  it("ends if the spawn position overlaps the pile", () => {
    const g = new Game();
    g.start();
    empty(g);
    add(g, DEVICES[4], 180, 80);
    g.spawn();
    expect(g.status).toBe("over");
    g.dispose();
  });
});

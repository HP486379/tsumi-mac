// Imported only by Vite's e2e mode. Production builds eliminate this branch.
import Matter from "matter-js";
import { Game, type Command, type Entry } from "../game/engine/Game";
import { DEVICES } from "../data/devices";
import { deviceBody } from "../game/physics/world";
import { Ledger } from "../game/systems/score";
export function attachHarness(game: Game) {
  const state = () => ({
    ...game.snapshot(),
    active: game.active
      ? {
          x: game.active.body.position.x,
          y: game.active.body.position.y,
          angle: game.active.body.angle,
          id: game.active.id,
        }
      : null,
    entries: game.entries.map((e) => ({
      id: e.id,
      x: e.body.position.x,
      y: e.body.position.y,
      locked: e.locked,
    })),
  });
  const scenario = (kind: "row" | "danger" | "blocked") => {
    game.start();
    for (const e of game.entries)
      Matter.Composite.remove(game.world.world, e.body);
    game.entries = [];
    game.active = null;
    game.ledger = new Ledger();
    const add = (
      device: (typeof DEVICES)[number],
      x: number,
      y: number,
      locked = true,
      staticBody = false,
    ) => {
      const body = deviceBody(device, x, y);
      if (staticBody) Matter.Body.setStatic(body, true);
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
    };
    if (kind === "row") {
      for (let i = 0; i < 5; i++) add(DEVICES[0], 36 + 72 * i, 630);
      add(DEVICES[2], 18, 594);
    }
    if (kind === "danger") {
      add(DEVICES[0], 90, 52, true, true);
      add(DEVICES[2], 270, 350, false, true);
    }
    if (kind === "blocked") {
      add(DEVICES[4], 180, 90, true, true);
      game.spawn();
    }
  };
  const triggerDanger = () => {
    const body = deviceBody(DEVICES[0], 90, 52);
    Matter.Body.setStatic(body, true);
    const entry: Entry = {
      id: ++game.serial,
      body,
      device: DEVICES[0],
      price: 50000,
      locked: true,
    };
    game.entries.push(entry);
    game.ledger.add(entry.id, entry.price);
    Matter.Composite.add(game.world.world, body);
    if (game.active) {
      Matter.Body.setPosition(game.active.body, { x: 270, y: 300 });
      Matter.Body.setStatic(game.active.body, true);
    }
  };
  const api = {
    state,
    scenario,
    triggerDanger,
    command: (c: Command) => game.command(c),
  };
  Object.assign(window, { __TSUMI__: api });
  return api;
}
declare global {
  interface Window {
    __TSUMI__?: ReturnType<typeof attachHarness>;
  }
}

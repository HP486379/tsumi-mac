import Matter from "matter-js";
import {
  DEVICES,
  DANGER,
  WIDTH,
  HEIGHT,
  type Device,
} from "../../data/devices";
import { createWorld, deviceBody } from "../physics/world";
import { fullRows, intersectsRow } from "../grid/occupancy";
import { DangerTimer, Ledger } from "../systems/score";
export type Status = "title" | "playing" | "paused" | "over";
export type Command =
  | "left"
  | "right"
  | "rotate"
  | "counterRotate"
  | "soft"
  | "drop";
export type Entry = {
  id: number;
  body: Matter.Body;
  device: Device;
  price: number;
  locked: boolean;
};
export type Snapshot = {
  status: Status;
  spent: number;
  organized: number;
  remaining: number;
  rows: number;
  maxCombo: number;
  level: number;
  seconds: number;
  next: Device;
  discount: boolean;
  message: string;
  danger: number;
  count: number;
};
export class Game {
  world = createWorld();
  entries: Entry[] = [];
  active: Entry | null = null;
  ledger = new Ledger();
  danger = new DangerTimer();
  status: Status = "title";
  queue: Device[] = [];
  elapsed = 0;
  stable = 0;
  settleWait = 0;
  count = 0;
  discount = false;
  message = "";
  messageUntil = 0;
  lastClear = 0;
  serial = 0;
  onSound: (kind: "hit" | "clear" | "over" | "spawn") => void = () => {};
  constructor(public random: () => number = Math.random) {
    this.fillQueue();
  }
  fillQueue() {
    while (this.queue.length < 5) {
      const bag: Device[] = [...DEVICES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }
  announce(message: string) {
    this.message = message;
    this.messageUntil = this.elapsed + 3000;
  }
  start() {
    Matter.Composite.clear(this.world.world, false);
    Matter.Engine.clear(this.world);
    this.world = createWorld();
    this.entries = [];
    this.active = null;
    this.ledger = new Ledger();
    this.danger = new DangerTimer();
    this.queue = [];
    this.fillQueue();
    this.elapsed = 0;
    this.stable = 0;
    this.settleWait = 0;
    this.count = 0;
    this.discount = false;
    this.lastClear = 0;
    this.status = "playing";
    this.announce("最初の1台。置き場所は、ありますか？");
    this.spawn();
  }
  spawn() {
    const device = this.queue.shift()!;
    this.fillQueue();
    const body = deviceBody(device, 180, device.rows * 18 + 2);
    if (
      Matter.Query.collides(
        body,
        this.entries.map((e) => e.body),
      ).length
    ) {
      this.finish();
      return;
    }
    const price = Math.round(device.price * (this.discount ? 0.8 : 1));
    this.discount = false;
    const entry: Entry = {
      id: ++this.serial,
      body,
      device,
      price,
      locked: false,
    };
    this.entries.push(entry);
    this.active = entry;
    this.ledger.add(entry.id, price);
    Matter.Composite.add(this.world.world, body);
    this.stable = 0;
    this.count++;
    if (price >= 330000) {
      this.announce("大きな買い物、小さな置き場所。");
      this.onSound("spawn");
    }
    if (this.count % 12 === 6) {
      this.queue.splice(0, 3, DEVICES[2], DEVICES[2], DEVICES[2]);
      this.announce("新製品発表！ 次の3台は mini M4");
    }
    if (this.count % 12 === 0) {
      this.discount = true;
      this.announce("整備済製品入荷！ 次の1台は20% OFF");
    }
  }
  finish() {
    this.status = "over";
    this.active = null;
    this.onSound("over");
    this.announce("積みMac崩壊");
  }
  pause() {
    if (this.status === "playing") this.status = "paused";
    else if (this.status === "paused") this.status = "playing";
  }
  canPlace(body: Matter.Body) {
    return (
      body.bounds.min.x >= -0.1 &&
      body.bounds.max.x <= WIDTH + 0.1 &&
      body.bounds.min.y >= -1 &&
      body.bounds.max.y <= HEIGHT + 0.2 &&
      !Matter.Query.collides(
        body,
        this.entries.filter((e) => e.body !== body).map((e) => e.body),
      ).some((c) => c.depth > 0.5)
    );
  }
  command(command: Command) {
    if (this.status !== "playing" || !this.active) return;
    const body = this.active.body;
    Matter.Sleeping.set(body, false);
    if (command === "rotate" || command === "counterRotate") {
      const angle = body.angle;
      const pos = { ...body.position };
      Matter.Body.setAngle(
        body,
        (Math.round(angle / (Math.PI / 2)) * Math.PI) / 2 +
          ((command === "rotate" ? 1 : -1) * Math.PI) / 2,
      );
      // Small wall kicks; never accept an overlapping rotated body.
      let placed = false;
      for (const dx of [0, -18, 18, -36, 36]) {
        Matter.Body.setPosition(body, { x: pos.x + dx, y: pos.y });
        if (this.canPlace(body)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        Matter.Body.setAngle(body, angle);
        Matter.Body.setPosition(body, pos);
      } else {
        Matter.Body.setAngularVelocity(body, 0);
        this.stable = 0;
      }
    } else if (command === "left" || command === "right") {
      // Swept 18px nudge avoids tunnelling through thin or rotated bodies.
      const dx = command === "left" ? -3 : 3;
      for (let i = 0; i < 6; i++) {
        const pos = { ...body.position };
        Matter.Body.translate(body, { x: dx, y: 0 });
        if (!this.canPlace(body)) {
          Matter.Body.setPosition(body, pos);
          break;
        }
      }
      Matter.Body.setVelocity(body, { x: 0, y: body.velocity.y });
      this.stable = 0;
    } else if (command === "soft")
      Matter.Body.setVelocity(body, {
        x: body.velocity.x,
        y: Math.max(body.velocity.y, 6),
      });
    else {
      // Sweep to first contact rather than teleporting through the pile.
      for (let i = 0; i < HEIGHT / 2; i++) {
        const pos = { ...body.position };
        Matter.Body.translate(body, { x: 0, y: 2 });
        if (!this.canPlace(body)) {
          Matter.Body.setPosition(body, pos);
          break;
        }
      }
      Matter.Body.setVelocity(body, { x: 0, y: 0.5 });
      this.onSound("hit");
    }
  }
  clearRows() {
    const locked = this.entries.filter((e) => e.locked);
    const rows = fullRows(locked.map((e) => e.body.vertices));
    if (!rows.length) return false;
    const removed = locked.filter((e) =>
      rows.some((row) => intersectsRow(e.body.vertices, row)),
    );
    this.ledger.clear(
      removed.map((e) => e.id),
      rows.length,
    );
    this.lastClear = this.elapsed;
    const ids = new Set(removed.map((e) => e.id));
    for (const e of removed) Matter.Composite.remove(this.world.world, e.body);
    this.entries = this.entries.filter((e) => !ids.has(e.id));
    for (const e of this.entries) Matter.Sleeping.set(e.body, false);
    this.danger.elapsed = 0;
    this.settleWait = 0;
    this.announce(
      this.ledger.combo > 1 ? "断捨離成功！ 資産整理！" : "資産整理！",
    );
    this.onSound("clear");
    return true;
  }
  step(dt = 1000 / 60) {
    if (this.status !== "playing") return;
    this.elapsed += dt;
    // More expensive geometric checks only run after the pile has settled.
    this.world.gravity.y =
      0.8 + Math.min(0.5, Math.floor(this.ledger.rows / 5) * 0.04);
    Matter.Engine.update(this.world, dt);
    if (this.active) {
      const b = this.active.body;
      const contacts = Matter.Query.collides(
        b,
        Matter.Composite.allBodies(this.world.world).filter((v) => v !== b),
      );
      const supported = contacts.some((c) => {
        const other = c.bodyA === b ? c.bodyB : c.bodyA;
        return other.position.y > b.position.y;
      });
      if (supported && b.speed < 0.35 && Math.abs(b.angularVelocity) < 0.012)
        this.stable += dt;
      else this.stable = 0;
      if (this.stable >= 800) {
        this.active.locked = true;
        this.active = null;
        this.stable = 0;
        this.settleWait = 0;
        this.onSound("hit");
      }
    }
    const locked = this.entries.filter((e) => e.locked);
    const stable = locked.every(
      (e) => e.body.speed < 0.35 && Math.abs(e.body.angularVelocity) < 0.012,
    );
    if (!this.active) {
      this.settleWait = stable ? this.settleWait + dt : 0;
      if (this.settleWait >= 250) {
        if (!this.clearRows()) {
          if (this.elapsed - this.lastClear > 1500) this.ledger.combo = 0;
          this.spawn();
        }
      }
    }
    const dangerous = locked.some((e) => e.body.bounds.min.y < DANGER);
    if (this.danger.update(dangerous, dt)) this.finish();
    if (this.message && this.elapsed > this.messageUntil) this.message = "";
  }
  snapshot(): Snapshot {
    return {
      status: this.status,
      spent: this.ledger.spent,
      organized: this.ledger.organized,
      remaining: this.ledger.remaining,
      rows: this.ledger.rows,
      maxCombo: this.ledger.maxCombo,
      level: 1 + Math.floor(this.ledger.rows / 5),
      seconds: Math.floor(this.elapsed / 1000),
      next: this.queue[0],
      discount: this.discount,
      message: this.message,
      danger: this.danger.elapsed,
      count: this.count,
    };
  }
  dispose() {
    Matter.Composite.clear(this.world.world, false);
    Matter.Engine.clear(this.world);
  }
}

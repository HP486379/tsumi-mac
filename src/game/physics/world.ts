/** Matter.js ワールドの生成とボディファクトリ */
import Matter from 'matter-js';
import { CELL, FIELD_H, FIELD_W, WALL_THICKNESS } from '../config';
import { DEVICES, type DeviceKind } from '../../data/devices';

// matter-js は CommonJS/UMD のため default import から取り出す（Vite の dev/build 双方で確実に動く形）
const { Bodies, Body, Composite, Engine } = Matter;

export interface PhysicsWorld {
  engine: Matter.Engine;
  walls: Matter.Body[];
}

export function createPhysicsWorld(): PhysicsWorld {
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  engine.gravity.scale = 0.001;
  engine.enableSleeping = true;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  engine.constraintIterations = 2;

  const t = WALL_THICKNESS;
  const wallOpts = { isStatic: true, friction: 0.4, frictionStatic: 0.6, restitution: 0, label: 'wall' };
  const floor = Bodies.rectangle(FIELD_W / 2, FIELD_H + t / 2, FIELD_W + t * 2, t, { ...wallOpts, label: 'floor' });
  // 左右の壁は上方向に十分高くし、跳ね上がったボディも外に出ないようにする
  const wallH = FIELD_H * 3;
  const left = Bodies.rectangle(-t / 2, FIELD_H - wallH / 2, t, wallH, { ...wallOpts, friction: 0.05, label: 'wallL' });
  const right = Bodies.rectangle(FIELD_W + t / 2, FIELD_H - wallH / 2, t, wallH, { ...wallOpts, friction: 0.05, label: 'wallR' });
  const walls = [floor, left, right];
  Composite.add(engine.world, walls);
  return { engine, walls };
}

export interface DeviceBodyOptions {
  kind: DeviceKind;
  cx: number;
  cy: number;
  wCells: number;
  hCells: number;
  angle: number;
}

/**
 * Mac Pro (Late 2013) の角丸半径。
 * 2D では円筒を真横から見た矩形（直径×高さ）になる。上下面は平らなので起立して積め、
 * 角を丸めることで傾いたときに円筒の縁のように転がって倒れやすくする。
 * 画面奥方向への転がりは2D物理では表せないため、円（転がり続ける）ではなく矩形で近似する。
 */
export function macPro2013ChamferRadius(wCells: number, hCells: number): number {
  return Math.min(10, (wCells * CELL) / 4, (hCells * CELL) / 3);
}

/** デバイスの物理ボディを作る。断片の場合は面積比で質量を按分する */
export function createDeviceBody(o: DeviceBodyOptions): Matter.Body {
  const spec = DEVICES[o.kind];
  const body = Bodies.rectangle(o.cx, o.cy, o.wCells * CELL, o.hCells * CELL, {
    friction: spec.friction,
    frictionStatic: spec.frictionStatic,
    frictionAir: 0.004,
    restitution: spec.restitution,
    slop: 0.04,
    ...(o.kind === 'macPro2013' ? { chamfer: { radius: macPro2013ChamferRadius(o.wCells, o.hCells) } } : {}),
    label: `device:${o.kind}`,
  });
  const areaRatio = (o.wCells * o.hCells) / (spec.w * spec.h);
  Body.setMass(body, spec.mass * areaRatio);
  if (o.angle !== 0) Body.setAngle(body, o.angle);
  return body;
}

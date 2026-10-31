/** Matter.js ワールドの生成とボディファクトリ */
import Matter from 'matter-js';
import { CELL, WALL_THICKNESS } from '../config';
import { CLASSIC_BOARD,type BoardSpec } from '../board';
import { DEVICES, type DeviceKind } from '../../data/devices';
import { deviceCells,realSize,type GameMode,type FragmentGeometry } from '../../data/gameModes';

// matter-js は CommonJS/UMD のため default import から取り出す（Vite の dev/build 双方で確実に動く形）
const { Bodies, Body, Composite, Engine } = Matter;

export interface PhysicsWorld {
  engine: Matter.Engine;
  walls: Matter.Body[];
}

export function createPhysicsWorld(board:Readonly<BoardSpec>=CLASSIC_BOARD): PhysicsWorld {
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  engine.gravity.scale = 0.001;
  engine.enableSleeping = false;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  engine.constraintIterations = 2;

  const t = WALL_THICKNESS;
  const wallOpts = { isStatic: true, friction: 0.32, frictionStatic: 0.5, restitution: 0, label: 'wall' };
  const floor = Bodies.rectangle(board.width / 2, board.height + t / 2, board.width + t * 2, t, { ...wallOpts, label: 'floor' });
  // 左右の壁は上方向に十分高くし、跳ね上がったボディも外に出ないようにする
  const wallH = board.height * 3;
  const left = Bodies.rectangle(-t / 2, board.height - wallH / 2, t, wallH, { ...wallOpts, friction: 0.05, label: 'wallL' });
  const right = Bodies.rectangle(board.width + t / 2, board.height - wallH / 2, t, wallH, { ...wallOpts, friction: 0.05, label: 'wallR' });
  const walls = [floor, left, right];
  Composite.add(engine.world, walls);
  return { engine, walls };
}

export interface DeviceBodyOptions {
  mode?:GameMode;
  geometry?:FragmentGeometry;
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
  const options = {
    // 着地後の横滑りを少し強める。機種間の摩擦の大小関係は維持する。
    friction: spec.friction * 0.8,
    frictionStatic: spec.frictionStatic * 0.8,
    frictionAir: 0.003,
    restitution: spec.restitution,
    slop: 0.04,
    ...(o.kind === 'macPro2013'&&!o.geometry ? { chamfer: { radius: o.mode==='real'?Math.min(o.wCells*CELL*.024,o.hCells*CELL*.15):macPro2013ChamferRadius(o.wCells, o.hCells) } } : {}),
    label: `device:${o.kind}`,
  };
  let body:Matter.Body;
  if(o.geometry)body=Bodies.fromVertices(o.cx,o.cy,[o.geometry.outline.map(p=>({...p}))],options,false,0,0,0);
  else if(o.mode==='real'&&o.kind==='pro'){
    const w=o.wCells*CELL,h=o.hCells*CELL;
    const parts=[Bodies.rectangle(o.cx,o.cy+2,w,h-10,options)];
    for(const x of [-w*.39,w*.39]){
      parts.push(Bodies.rectangle(o.cx+x,o.cy-h/2+3.5,2.4,7,options));
      parts.push(Bodies.rectangle(o.cx+x,o.cy+h/2-1.5,3,3,options));
    }
    body=Body.create({...options,parts});Body.setCentre(body,{x:o.cx,y:o.cy});
  }else body=Bodies.rectangle(o.cx,o.cy,o.wCells*CELL,o.hCells*CELL,options);
  const cells=deviceCells(o.kind,o.mode??'classic'),full=o.mode==='real'?realSize(o.kind):{w:cells.w*CELL,h:cells.h*CELL};
  const areaRatio = o.geometry?body.area/(full.w*full.h):(o.wCells * o.hCells) / (cells.w * cells.h);
  Body.setMass(body, spec.mass * areaRatio);
  if (o.angle !== 0) Body.setAngle(body, o.angle);
  return body;
}

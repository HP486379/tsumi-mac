import { describe,it,expect } from 'vitest';
import Matter from 'matter-js';
import { GameSim } from '../game/engine/GameSim';
import { CountSim } from '../game/count/CountSim';
import { DEVICE_KINDS,type DeviceKind } from '../data/devices';
import { deviceCells } from '../data/gameModes';
import { MOVE_STEP_PX,FINE_MOVE_STEP_PX,STEP_MS } from '../game/config';
import { polygonArea,clipPolygonToRect } from '../game/physics/geometry';
const modes=['classic','real','count'] as const;
type Mode=typeof modes[number];
const sim=(mode:Mode):GameSim=>mode==='count'?new CountSim({}, {autoSpawn:false,randomEvents:false,seed:42}):new GameSim({}, {mode,autoSpawn:false,randomEvents:false,seed:42});
const steps=(s:GameSim,n:number)=>{for(let i=0;i<n;i++)s.step();};
const spawn=(s:GameSim,kind:DeviceKind)=>{s.spawner.force(kind);const e=s.spawnNext()!;Matter.Body.setPosition(e.body,{x:e.body.position.x,y:140});return e;};
function channel(s:GameSim,gap:number){
 const d=deviceCells('pro',s.mode),y=(s.board.height-d.h*36)/36;
 const walls=[s.placeLocked('pro',(204-d.w*36)/36,y),s.placeLocked('pro',(204+gap)/36,y)];for(const e of walls)Matter.Body.setStatic(e.body,true);return walls;
}
describe.each(modes)('%s fine placement',mode=>{
 it.each(DEVICE_KINDS)('%s moves 36px from the actual post-rotation position at every quadrant',kind=>{
  const s=sim(mode),e=spawn(s,kind);Matter.Body.setPosition(e.body,{x:s.board.width/2+1.375,y:260});
  for(let q=0;q<4;q++){const before=e.body.position.x;expect(s.tryMove(-1)).toBe(true);expect(e.body.position.x).toBeCloseTo(before-36,9);expect(s.tryMove(1)).toBe(true);expect(e.body.position.x).toBeCloseTo(before,9);expect(s.tryRotate(1)).toBe(true);expect(e.body.position.x).toBeCloseTo(before,9);}
  s.destroy();
 });
 it('holds and releases with the same repeat timing, clamps the last fractional wall step',()=>{
  const s=sim(mode),e=spawn(s,'miniM1'),x=e.body.position.x;s.press('fine');s.press('left');steps(s,18);s.release('left');const end=e.body.position.x;expect(x-end).toBeGreaterThanOrEqual(2);expect(x-end).toBeCloseTo(Math.round(x-end),7);steps(s,10);expect(e.body.position.x).toBeCloseTo(end,7);
  expect(s.tryRotate(1)).toBe(true);for(let i=0;i<Math.ceil(s.board.width/FINE_MOVE_STEP_PX)+10;i++)s.tryMove(-1);expect(Math.min(...e.body.vertices.map(v=>v.x))).toBeCloseTo(0,8);expect(s.tryMove(-1)).toBe(false);expect(s.tryRotate(1)).toBe(true);expect(Math.min(...e.body.vertices.map(v=>v.x))).toBeGreaterThanOrEqual(-1e-8);s.destroy();
 });
 it.each(['miniM1','miniM2'] as const)('%s fits the measured 18px channel and settles vertically without interpenetration',kind=>{
  const s=sim(mode),walls=channel(s,18),e=spawn(s,kind);expect(s.tryRotate(1)).toBe(true);const target=mode==='real'?214:212;
  s.press('fine');for(let n=0;n<200&&Math.abs(e.body.position.x-target)>.01;n++)expect(s.tryMove(e.body.position.x>target?-1:1)).toBe(true);s.release('fine');
  expect(e.body.position.x).toBeCloseTo(target,8);s.hardDrop();for(let i=0;i<1000&&s.active;i++)s.step();
  expect(e.state).toBe('locked');expect(Math.max(...e.body.vertices.map(v=>v.y))).toBeCloseTo(s.board.height,0);expect(Math.min(...e.body.vertices.map(v=>v.x))).toBeGreaterThan(204);expect(Math.max(...e.body.vertices.map(v=>v.x))).toBeLessThan(222);
  for(const w of walls){const b=w.body.bounds;expect(polygonArea(clipPolygonToRect(e.body.vertices,{minX:b.min.x,minY:b.min.y,maxX:b.max.x,maxY:b.max.y}))).toBeLessThan(1e-7);}
  if(s instanceof CountSim)expect(s.count()).toMatchObject({current:3,peak:3});s.destroy();
 });
 it.each(['miniM1','miniM2'] as const)('%s cannot descend into a 12px channel',kind=>{
  const s=sim(mode);channel(s,12);const e=spawn(s,kind);s.tryRotate(1);const target=mode==='real'?210:212;
  s.press('fine');for(let n=0;n<200&&Math.abs(e.body.position.x-target)>.01;n++)s.tryMove(e.body.position.x>target?-1:1);s.release('fine');
  s.hardDrop();for(let i=0;i<1000&&s.active;i++)s.step();expect(e.state).toBe('locked');expect(Math.max(...e.body.vertices.map(v=>v.y))).toBeLessThan(s.board.height-100);s.destroy();
 });
 it('does not admit positive overlap through the input collision test',()=>{
  const s=sim(mode),e=spawn(s,'miniM1');s.tryRotate(1);Matter.Body.setPosition(e.body,{x:156,y:140});const d=deviceCells('pro',s.mode),wall=s.placeLocked('pro',200/36,(140-d.h*18)/36);Matter.Body.setStatic(wall.body,true);
  s.press('fine');for(let i=0;i<100&&s.tryMove(1);i++){/* approach the obstacle */}
  const x=e.body.position.x;expect(s.tryMove(1)).toBe(false);expect(e.body.position.x).toBe(x);s.release('fine');expect(Math.max(...e.body.vertices.map(v=>v.x))).toBeLessThanOrEqual(200+1e-8);s.destroy();
 });
});
it('measures the 16px real-mode lattice miss without changing the collider',()=>{
 const width=deviceCells('miniM1','real').h*36,min=204+width/2,max=220-width/2;
 expect(width).toBeCloseTo(13.15736040609137,10);expect(max-min).toBeLessThan(MOVE_STEP_PX);expect(max-min).toBeGreaterThan(FINE_MOVE_STEP_PX);
 expect(210).toBeLessThan(min);expect(214).toBeGreaterThan(max);expect((214-270)/4).toBe(-14);expect(212).toBeGreaterThan(min);expect(212).toBeLessThan(max);
 expect(STEP_MS).toBeCloseTo(1000/60,10);
});
it('keeps the classic full-row threshold for off-grid vertical minis and exact remaining value',()=>{
 const s=sim('classic');for(let col=0;col<8;col+=2)s.placeLocked('pro',col,14);
 for(let n=0;n<5;n++)s.placeLocked('miniM1',(288+14.4*(n+.5)-deviceCells('miniM1','classic').h*18)/36,16,1);
 expect(s.checkRows()).toBe(2);expect(s.score().spent).toBeCloseTo(s.score().cleared+s.score().fieldValue,4);expect(s.score().lines).toBe(2);s.destroy();
});
it('rejects an offset full-width row with a 4px edge hole instead of rounding it to the grid',()=>{
 const s=sim('classic');for(let c=0;c<10;c+=2)s.placeLocked('miniM4',c+4/36,17);expect(s.checkRows()).toBe(0);expect(s.score().lines).toBe(0);s.destroy();
});


describe.each(modes)('%s dual-speed controls',mode=>{
 it('moves 36px normally, 1px with fine held, and retains offset',()=>{
  const s=sim(mode),e=spawn(s,'miniM1');Matter.Body.setPosition(e.body,{x:s.board.width/2,y:120});
  const start=e.body.position.x;
  expect(s.tryMove(1)).toBe(true);expect(e.body.position.x).toBeCloseTo(start+36,8);
  s.press('fine');expect(s.tryMove(-1)).toBe(true);expect(e.body.position.x).toBeCloseTo(start+35,8);
  s.release('fine');expect(s.tryMove(-1)).toBe(true);expect(e.body.position.x).toBeCloseTo(start-1,8);
  s.destroy();
 });
});

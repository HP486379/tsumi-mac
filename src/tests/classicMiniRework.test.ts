import { describe,it,expect } from 'vitest';
import Matter from 'matter-js';
import { GameSim } from '../game/engine/GameSim';
import { classicMiniSize,deviceCells } from '../data/gameModes';
import { DEVICES,type DeviceKind } from '../data/devices';
import { chassisMesh } from '../game/rendering/chassisMesh';
import { chassisPose,worldFromLocal } from '../game/rendering/chassisProjection';
import { planClassicRowClear } from '../game/grid/classicRowClear';
import { planRowClear } from '../game/grid/rowClear';
const kinds:DeviceKind[]=['miniM1','miniM2','miniM4'];
const sim=()=>new GameSim({}, {autoSpawn:false,randomEvents:false,seed:42});
const steps=(s:GameSim,n=700)=>{for(let i=0;i<n;i++)s.step();};
const ledger=(s:GameSim)=>expect(s.score().spent).toBeCloseTo(s.score().cleared+s.score().fieldValue,5);
describe('classic mini model transfer and thin colliders',()=>{
 it.each(kinds)('%s uses matching body, mesh and front dimensions at all quadrants',kind=>{
  const d=classicMiniSize(kind);expect(d.w).toBe(72);expect(d.h).toBe(kind==='miniM4'?36:72*36/197);expect(d.depth).toBe(72);
  for(let q=0;q<4;q++){const s=sim(),e=s.placeLocked(kind,3,8,q),p=s.renderState().items[0]!,vertices=chassisMesh(p).map(v=>worldFromLocal(chassisPose(p),v.p));
   const x=vertices.map(v=>v[0]),y=vertices.map(v=>v[1]);expect(Math.min(...x)).toBeCloseTo(Math.min(...e.body.vertices.map(v=>v.x)),8);expect(Math.max(...x)).toBeCloseTo(Math.max(...e.body.vertices.map(v=>v.x)),8);expect(Math.min(...y)).toBeCloseTo(Math.min(...e.body.vertices.map(v=>v.y)),8);expect(Math.max(...y)).toBeCloseTo(Math.max(...e.body.vertices.map(v=>v.y)),8);expect(chassisPose(p).sx).toBe(1);expect(chassisPose(p).sy).toBe(1);expect(e.body.mass).toBeCloseTo(DEVICES[kind].mass,8);s.destroy();
  }
 });
 it.each(kinds)('%s stacks three actual meshes on the floor without a visual gap',kind=>{
  const s=sim(),d=classicMiniSize(kind),bodies=[0,1,2].map(i=>s.placeLocked(kind,3,(648-(i+1)*d.h)/36));steps(s);
  expect(s.escaped).toBe(0);expect(s.entities.size).toBe(3);const state=s.renderState();
  const ranges=state.items.map(p=>{const y=chassisMesh(p).map(v=>worldFromLocal(chassisPose(p),v.p)[1]);return {min:Math.min(...y),max:Math.max(...y)};}).sort((a,b)=>b.max-a.max);
  expect(Math.abs(ranges[0]!.max-648)).toBeLessThan(.2);for(let i=1;i<3;i++)expect(Math.abs(ranges[i]!.max-ranges[i-1]!.min)).toBeLessThan(.2);for(const b of bodies)expect(Math.abs(b.body.angle)).toBeLessThan(.01);ledger(s);s.destroy();
 });
 it.each(kinds)('%s keeps 1px fine movement, clamps the last fractional wall step and rotates safely',kind=>{
  const s=sim();s.spawner.force(kind);const e=s.spawnNext()!;Matter.Body.setPosition(e.body,{x:e.body.position.x,y:250});const x=e.body.position.x;s.press('fine');expect(s.tryMove(-1)).toBe(true);expect(e.body.position.x).toBeCloseTo(x-1,8);
  for(const dir of [-1,1] as const){for(let i=0;i<160;i++)s.tryMove(dir);for(let q=0;q<4;q++){expect(s.tryRotate(1)).toBe(true);expect(e.body.bounds.min.x).toBeGreaterThanOrEqual(-1e-8);expect(e.body.bounds.max.x).toBeLessThanOrEqual(360+1e-8);}}
  s.hardDrop();steps(s);expect(s.escaped).toBe(0);expect(Math.abs(Math.max(...e.body.vertices.map(v=>v.y))-648)).toBeLessThan(.2);s.destroy();
 });
 it('two thin layers do not fill a 36px row, and three layers do',()=>{
  const s=sim(),h=classicMiniSize('miniM1').h;for(let layer=0;layer<2;layer++)for(let col=0;col<10;col+=2)s.placeLocked('miniM1',col,(648-(layer+1)*h)/36);
  expect(s.checkRows()).toBe(0);for(let col=0;col<10;col+=2)s.placeLocked('miniM1',col,(648-3*h)/36);expect(s.checkRows()).toBe(1);expect(s.entities.size).toBe(5);expect([...s.entities.values()].every(e=>e.fragment&&e.geometry)).toBe(true);ledger(s);s.destroy();
 });
 it('preserves fractional remnants, their value and proportional mass after settling',()=>{
  const s=sim(),h=classicMiniSize('miniM2').h;for(let layer=0;layer<3;layer++)for(let col=0;col<10;col+=2)s.placeLocked('miniM2',col,(648-(layer+1)*h)/36);
  s.checkRows();const remaining=3*h-36;expect(s.score().spent).toBe(15*70000);expect(s.score().fieldValue).toBeCloseTo(5*70000*remaining/h,4);
  for(const e of s.entities.values()){expect(e.hCells*36).toBeCloseTo(remaining,8);expect(e.body.mass).toBeCloseTo(1.3*remaining/h,8);}
  steps(s);expect(s.escaped).toBe(0);for(const e of s.entities.values())expect(Math.abs(Math.max(...e.body.vertices.map(v=>v.y))-648)).toBeLessThan(.2);ledger(s);s.destroy();
 });
 it('the transferred two-column M4 needs five units for one full-width row',()=>{
  const s=sim();for(let col=0;col<10;col+=2)s.placeLocked('miniM4',col,17);expect(s.checkRows()).toBe(1);expect(s.entities.size).toBe(0);expect(s.score().cleared).toBe(575000);ledger(s);s.destroy();
 });
 it('retains classic half-area whole-removal for a highly tilted thin mini',()=>{
  const s=sim(),e=s.placeLocked('miniM1',3,15);Matter.Body.setPosition(e.body,{x:180,y:590});Matter.Body.setAngle(e.body,.33);s.checkRows([16]);expect(s.entities.size).toBe(0);expect(s.score().cleared).toBe(50000);ledger(s);s.destroy();
 });
 it('keeps the original row planner exactly for Studio, Pro and 2013',()=>{
  for(const kind of ['studio','pro','macPro2013'] as const)for(const angle of [0,.33,Math.PI/2]){const d=deviceCells(kind,'classic'),pieces=[{id:1,kind,refurb:false,cx:140,cy:600,angle,wCells:d.w,hCells:d.h,value:DEVICES[kind].price,vx:0,vy:0}];expect(planClassicRowClear(pieces,[16,17])).toEqual(planRowClear(pieces,[16,17]));}
 });
});

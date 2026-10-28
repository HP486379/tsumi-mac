import { describe,it,expect } from 'vitest';
import Matter from 'matter-js';
import { GameSim } from '../game/engine/GameSim';
import { DEVICES,DEVICE_KINDS } from '../data/devices';
import { realSize,REAL_MM,REAL_PX_PER_MM } from '../data/gameModes';
import { modelDimensions,chassisMesh } from '../game/rendering/chassisMesh';
import { chassisPose,worldFromLocal } from '../game/rendering/chassisProjection';
import { planRealRowClear } from '../game/grid/realRowClear';
import { polygonArea } from '../game/physics/geometry';
import { CELL } from '../game/config';
import { REAL_BOARD } from '../game/board';
const FIELD_H=REAL_BOARD.height,FIELD_W=REAL_BOARD.width;
import { createDeviceBody } from '../game/physics/world';
import { loadHighScore,submitResult } from '../game/systems/highscore';

const sim=()=>new GameSim({}, {mode:'real',seed:42,autoSpawn:false,randomEvents:false});
describe('real scale game mode',()=>{
 it.each(DEVICE_KINDS)('%s shares one physical, mesh and projection scale',kind=>{
   const s=sim(),e=s.placeLocked(kind,3,8),item=s.renderState().items[0]!,d=modelDimensions(item),size=realSize(kind),mm=REAL_MM[kind];
   expect(d.w).toBeCloseTo(mm.w*REAL_PX_PER_MM,10);expect(d.h).toBeCloseTo(mm.h*REAL_PX_PER_MM,10);expect(d.depth).toBeCloseTo(mm.d*REAL_PX_PER_MM,10);
   const mesh=chassisMesh(item);
   for(const [axis,extent] of [[0,size.w],[1,size.h],[2,size.depth]] as const){
     const values=mesh.map(v=>v.p[axis]);expect(Math.max(...values)-Math.min(...values)).toBeCloseTo(extent,8);
   }
   expect(e.body.bounds.max.x-e.body.bounds.min.x).toBeCloseTo(size.w,8);expect(e.body.bounds.max.y-e.body.bounds.min.y).toBeCloseTo(size.h,8);
   expect(chassisPose(item).sx).toBe(1);expect(chassisPose(item).sy).toBe(1);s.destroy();
 });
 it.each(DEVICE_KINDS)('%s settles without tunneling at both upright and quarter-turn orientations',kind=>{
   for(const q of [0,1]){const s=sim(),e=s.placeLocked(kind,3,5,q);for(let i=0;i<600;i++)s.step();
     expect(s.escaped).toBe(0);expect(Math.abs(Math.max(...e.body.vertices.map(v=>v.y))-FIELD_H)).toBeLessThan(.2);s.destroy();}
 });
 it('M1/M2 are wide/thin while M4 is narrower and taller at the SAME scale',()=>{
   const a=realSize('miniM1'),b=realSize('miniM2'),c=realSize('miniM4');expect(a).toEqual(b);
   expect(c.w/a.w).toBeCloseTo(127/197,12);expect(c.h/a.h).toBeCloseTo(50/36,12);
 });
 it('two thin mini bodies and their actual mesh caps meet, with solver tolerance only',()=>{
   const s=sim(),a=s.placeLocked('miniM2',3,17),b=s.placeLocked('miniM2',3,16);for(let i=0;i<700;i++)s.step();
   expect(Math.abs(a.body.position.y-b.body.position.y-realSize('miniM2').h)).toBeLessThan(.2);
   const items=s.renderState().items,lower=items.find(i=>i.y===a.body.position.y)!;
   expect(Math.abs(Math.max(...chassisMesh(lower).map(v=>worldFromLocal(chassisPose(lower),v.p)[1]))-FIELD_H)).toBeLessThan(.2);s.destroy();
 });
 it('a small M4 rests on the Pro shell between handles, rather than floating on a bounding box',()=>{
   const s=sim(),a=s.placeLocked('pro',3,12),b=s.placeLocked('miniM4',3,8);
   Matter.Body.setPosition(a.body,{x:180,y:752});Matter.Body.setPosition(b.body,{x:180,y:572});
   for(let i=0;i<700;i++)s.step();
   expect(a.body.parts.length).toBe(6);
   // Contact can naturally tilt the mini onto one handle. Measure its actual
   // support vertex in the tower's local frame, not an unrotated center±h/2.
   const shellTop=-realSize('pro').h/2+7,c=Math.cos(a.body.angle),sn=Math.sin(a.body.angle);
   const miniBottom=Math.max(...b.body.vertices.map(v=>-sn*(v.x-a.body.position.x)+c*(v.y-a.body.position.y)));
   expect(Math.abs(shellTop-miniBottom)).toBeLessThan(.3);expect(s.escaped).toBe(0);s.destroy();
 });
 it.each([0,Math.PI/2,Math.PI,.33,-.41])('cuts tilted/rotated real pieces at angle %s without losing value or filling cleared bands',angle=>{
   const size=realSize('pro'),p={id:1,kind:'pro' as const,refurb:false,cx:180,cy:400,angle,wCells:size.w/CELL,hCells:size.h/CELL,value:1_000_000,vx:0,vy:0};
   const plan=planRealRowClear([p],[10,12]);expect(plan.removeIds).toEqual([1]);
   expect(plan.clearedValue+plan.create.reduce((sum,f)=>sum+f.value,0)).toBeCloseTo(p.value,5);
   for(const f of plan.create){const body=createDeviceBody({kind:f.kind,cx:f.cx,cy:f.cy,wCells:f.wCells,hCells:f.hCells,angle:f.angle,mode:'real',geometry:f.geometry});
     const expected=f.geometry.outline.map(v=>({x:f.cx+Math.cos(angle)*v.x-Math.sin(angle)*v.y,y:f.cy+Math.sin(angle)*v.x+Math.cos(angle)*v.y}));
     expect(polygonArea(body.vertices)).toBeCloseTo(polygonArea(expected),6);
     for(const v of body.vertices)expect(expected.some(p=>Math.hypot(p.x-v.x,p.y-v.y)<1e-6)).toBe(true);
     const item={x:f.cx,y:f.cy,angle:f.angle,active:false,key:{kind:f.kind,wCells:f.wCells,hCells:f.hCells,mode:'real' as const,geometry:f.geometry,cutTop:true,cutBottom:true,refurb:false}};
     for(const v of chassisMesh(item)){const point=worldFromLocal(chassisPose(item),v.p);expect(point.every(Number.isFinite)).toBe(true);for(const r of [10,12])expect(point[1]<=r*CELL+1e-6||point[1]>=(r+1)*CELL-1e-6).toBe(true);}
   }
 });
 it('clears a naturally filled real Studio row and preserves the ledger',()=>{
   const s=sim();for(let col=0;col<14;col+=2)s.placeLocked('studio',col,24);s.placeLocked('studio',14,23,1);
   expect(s.checkRows()).toBe(1);expect(s.score().lines).toBe(1);expect(s.score().spent).toBeCloseTo(s.score().cleared+s.score().fieldValue,6);expect(s.entities.size).toBe(1);s.destroy();
 });
 it('repeated cuts of fractional fragments conserve source offsets and value',()=>{
   const size=realSize('pro'),p={id:7,kind:'pro' as const,refurb:false,cx:180,cy:400,angle:.2,wCells:size.w/CELL,hCells:size.h/CELL,value:100,vx:0,vy:0};
   const first=planRealRowClear([p],[10]);let remaining=0,cleared=first.clearedValue;
   first.create.forEach((f,i)=>{const second=planRealRowClear([{...f,id:20+i}],[12]);cleared+=second.clearedValue;remaining+=second.removeIds.length?second.create.reduce((s,f)=>s+f.value,0):f.value;});
   expect(cleared+remaining).toBeCloseTo(100,9);
 });
 it('a separated Pro foot does not acquire a zero-volume sheet connecting front/back feet',()=>{
   const size=realSize('pro'),r=1.5,geometry={outline:[{x:-r,y:-r},{x:r,y:-r},{x:r,y:r},{x:-r,y:r}],source:{w:size.w,h:size.h,offsetX:size.w*.39,offsetY:size.h/2-r}};
   const item={x:180,y:600,angle:0,active:false,key:{kind:'pro' as const,wCells:3/CELL,hCells:3/CELL,mode:'real' as const,geometry,cutTop:true,cutBottom:true,refurb:false}};
   const mesh=chassisMesh(item);expect(mesh.length).toBeGreaterThan(0);
   for(let i=0;i<mesh.length;i+=3){const z=mesh.slice(i,i+3).map(v=>v.p[2]);expect(Math.max(...z)-Math.min(...z)).toBeLessThan(4);}
 });
 it.each(DEVICE_KINDS)('%s moves/rotates at walls using real extents',kind=>{
   const s=new GameSim({}, {mode:'real',seed:42,autoSpawn:false,randomEvents:false});s.spawner.force(kind);const e=s.spawnNext()!;
   Matter.Body.setPosition(e.body,{x:e.body.position.x,y:250});for(let i=0;i<15;i++)s.tryMove(-1);expect(s.tryRotate(1)).toBe(true);
   expect(Math.min(...e.body.vertices.map(v=>v.x))).toBeGreaterThanOrEqual(-1e-6);expect(Math.max(...e.body.vertices.map(v=>v.x))).toBeLessThanOrEqual(FIELD_W+1e-6);s.destroy();
 });
 it('real high scores never overwrite or migrate classic v1 saves',()=>{
   const map=new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
   const classic=JSON.stringify({bestSpent:987654,bestLines:8,plays:4});map.set('tsumimac.highscore.v1',classic);
   const s=sim();s.placeLocked('miniM4',2,17);submitResult(s.score(),store,'real');
   expect(map.get('tsumimac.highscore.v1')).toBe(classic);expect(loadHighScore(store).bestSpent).toBe(987654);expect(loadHighScore(store,'real').plays).toBe(1);s.destroy();
 });
 it('default and explicit classic produce identical dimensions, physics and score',()=>{
   const a=new GameSim({}, {seed:123,randomEvents:false}),b=new GameSim({}, {mode:'classic',seed:123,randomEvents:false});
   for(let i=0;i<100;i++){a.step();b.step();}expect(a.renderState()).toEqual(b.renderState());expect(a.score()).toEqual(b.score());
   expect(a.active!.wCells).toBe(DEVICES[a.active!.kind].w);a.destroy();b.destroy();
 });
});

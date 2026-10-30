import { describe,it,expect } from 'vitest';
import Matter from 'matter-js';
import { CountSim,SPAWN_BLOCK_TIMEOUT_S } from '../game/count/CountSim';
import { StackCounter } from '../game/count/StackCounter';
import { loadCountRecord,saveCountPeak,COUNT_RECORD_KEY } from '../game/count/records';
import { GameSim } from '../game/engine/GameSim';
import { DEVICE_KINDS } from '../data/devices';
import { deviceCells } from '../data/gameModes';
import { CLASSIC_BOARD } from '../game/board';
import { STEP_MS } from '../game/config';
const make=()=>new CountSim({}, {autoSpawn:false,randomEvents:false,seed:42});
const step=(s:GameSim,n=1)=>{for(let i=0;i<n;i++)s.step();};

describe('maximum simultaneous stack challenge',()=>{
 it.each(DEVICE_KINDS)('%s retains exact classic body, mesh key and physics',kind=>{
  const a=make(),b=new GameSim({}, {autoSpawn:false,randomEvents:false,seed:42}),x=a.placeLocked(kind,2,7),y=b.placeLocked(kind,2,7);
  expect(a.board).toEqual(CLASSIC_BOARD);expect(deviceCells(kind,a.mode)).toEqual(deviceCells(kind,b.mode));
  step(a,30);step(b,30);expect(x.body.vertices.map(v=>[v.x,v.y])).toEqual(y.body.vertices.map(v=>[v.x,v.y]));expect(x.body.mass).toBe(y.body.mass);expect(x.body.angle).toBe(y.body.angle);expect(a.renderState()).toEqual(b.renderState());expect(a.count().current).toBe(1);a.destroy();b.destroy();
 });
 it('never clears a full row, including explicit/periodic/lock clear paths',()=>{
  const a=make(),b=new GameSim({}, {autoSpawn:false,randomEvents:false});
  for(let c=0;c<10;c+=2){a.placeLocked('miniM4',c,17);b.placeLocked('miniM4',c,17);}
  expect(a.checkRows([17])).toBe(0);expect(b.checkRows()).toBe(1);step(a,180);
  expect(a.entities.size).toBe(5);expect(a.count()).toMatchObject({current:5,peak:5});expect(a.score().lines).toBe(0);expect([...a.entities.values()].every(e=>!e.fragment)).toBe(true);a.destroy();b.destroy();
 });
 it('excludes falling and landing, then counts the root once when locked',()=>{
  const a=make();a.spawner.force('miniM1');const e=a.spawnNext()!;expect(a.count().current).toBe(0);a.hardDrop();let landing=false;
  for(let i=0;i<800&&a.active;i++){a.step();if(e.state==='landing'){landing=true;expect(a.count().current).toBe(0);}}
  expect(landing).toBe(true);expect(e.state).toBe('locked');expect(a.count()).toMatchObject({current:1,peak:1});step(a,300);expect(a.count().current).toBe(1);a.destroy();
 });
 it('keeps moving/collapsed bodies inside and does not end at the danger line',()=>{
  const a=make(),e=a.placeLocked('studio',0,0);Matter.Body.setAngle(e.body,.65);Matter.Body.setVelocity(e.body,{x:1,y:0});
  step(a,140);expect(a.status).toBe('running');expect(a.count().current).toBe(1);expect(e.body.position.y).toBeGreaterThan(72);expect(a.danger.ratio).toBe(0);a.destroy();
 });
 it('retains partially protruding bodies; complete exit removes only current count',()=>{
  const a=make(),e=a.placeLocked('miniM4',2,17);step(a,100);const peak=a.count().peak;
  Matter.Body.setPosition(e.body,{x:-10,y:400});a.counter.update(a.entities.values(),a.board);expect(a.counter.current).toBe(1);expect(a.entities.has(e.id)).toBe(true);
  Matter.Body.setPosition(e.body,{x:-600,y:400});step(a);expect(a.count().current).toBe(0);expect(a.count().peak).toBe(peak);expect(a.entities.has(e.id)).toBe(false);step(a,30);expect(a.escaped).toBe(1);expect(a.count().current).toBe(0);a.destroy();
 });
 it('keeps playing with a persistent fixed body above the classic danger line',()=>{
  const a=make(),e=a.placeLocked('studio',0,0);Matter.Body.setStatic(e.body,true);step(a,240);
  expect(a.status).toBe('running');expect(a.danger.ratio).toBe(0);expect(a.count()).toMatchObject({current:1,peak:1});a.destroy();
 });
 it('removes a fully below-floor body and retains one above the ceiling',()=>{
  const a=make(),e=a.placeLocked('miniM4',2,5);Matter.Body.setPosition(e.body,{x:150,y:-100});step(a);expect(a.entities.has(e.id)).toBe(true);expect(a.count().current).toBe(0);
  Matter.Body.setPosition(e.body,{x:150,y:1000});step(a);expect(a.entities.has(e.id)).toBe(false);expect(a.escaped).toBe(1);a.destroy();
 });
 it('deduplicates fragments by individual ID and never resurrects a retired root',()=>{
  const a=make(),e=a.placeLocked('miniM4',1,15),f=a.placeLocked('miniM1',4,16);f.individualId=e.individualId;
  const c=new StackCounter();c.update(a.entities.values(),a.board);expect(c.current).toBe(1);c.retire(e.individualId);c.update(a.entities.values(),a.board);expect(c.current).toBe(0);expect(c.peak).toBe(1);a.destroy();
 });
 it('retries the same unpaid ticket, resets the timeout and resumes after a temporary block',()=>{
  const a=make(),block=a.placeLocked('studio',4,0);Matter.Body.setStatic(block.body,true);a.spawner.force('miniM1');const ticket=a.nextTicket(),spent=a.score().spent;
  expect(a.spawnNext()).toBeNull();step(a,60);expect(a.status).toBe('running');expect(a.nextTicket()).toBe(ticket);expect(a.score().spent).toBe(spent);expect(a.count().blockedSeconds).toBeCloseTo(1,6);
  Matter.Body.setPosition(block.body,{x:40,y:500});step(a);expect(a.active?.kind).toBe(ticket.kind);expect(a.count().blockedSeconds).toBe(0);expect(a.score().spent).toBe(spent+ticket.price);a.destroy();
 });
 it('ends only after three continuous simulation seconds of blocked spawning',()=>{
  const a=make(),block=a.placeLocked('studio',4,0);Matter.Body.setStatic(block.body,true);a.spawner.force('miniM1');a.spawnNext();
  const n=Math.round(SPAWN_BLOCK_TIMEOUT_S*1000/STEP_MS);step(a,n-1);expect(a.status).toBe('running');step(a);expect(a.status).toBe('over');expect(a.overReason).toBe('spawn');expect(a.count().peak).toBe(1);a.destroy();
 });
 it('propagates root identity to legacy fragments without changing row scores',()=>{
  const a=new GameSim({}, {autoSpawn:false,randomEvents:false}),e=a.placeLocked('pro',2,12);a.checkRows([13]);
  expect(a.entities.size).toBeGreaterThan(1);expect([...a.entities.values()].every(p=>p.individualId===e.individualId)).toBe(true);expect(a.score().spent).toBeCloseTo(a.score().cleared+a.score().fieldValue,4);a.destroy();
 });
 it('writes only its own record and persists peaks even before completion',()=>{
  const values=new Map([['tsumimac.highscore.v1','classic'],['tsumimac.highscore.v1.real.540x900.v1','real'],['tsumimac.settings.v1','settings']]);
  const store={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
  expect(saveCountPeak(6,store)).toEqual({best:6,plays:0});expect(saveCountPeak(4,store,true)).toEqual({best:6,plays:1});expect(loadCountRecord(store)).toEqual({best:6,plays:1});expect(values.get('tsumimac.highscore.v1')).toBe('classic');expect(values.get('tsumimac.highscore.v1.real.540x900.v1')).toBe('real');expect(values.get('tsumimac.settings.v1')).toBe('settings');expect(values.has(COUNT_RECORD_KEY)).toBe(true);
 });
 it('handles malformed/unavailable storage',()=>{
  expect(loadCountRecord({getItem:()=>'{',setItem:()=>{}})).toEqual({best:0,plays:0});expect(saveCountPeak(5,{getItem:()=>null,setItem:()=>{throw Error('disabled');}}).best).toBe(5);
 });
});

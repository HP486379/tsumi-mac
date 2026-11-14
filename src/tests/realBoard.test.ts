import { describe,it,expect } from 'vitest';
import Matter from 'matter-js';
import { GameSim } from '../game/engine/GameSim';
import { REAL_BOARD,CLASSIC_BOARD,obliqueViewport } from '../game/board';
import { DEVICE_KINDS } from '../data/devices';
import { REAL_PX_PER_MM,realSize } from '../data/gameModes';
import { chassisMesh } from '../game/rendering/chassisMesh';
import { chassisPose,worldFromLocal,projectWorld } from '../game/rendering/chassisProjection';
import { loadHighScore,submitResult } from '../game/systems/highscore';
const make=()=>new GameSim({}, {mode:'real',autoSpawn:false,randomEvents:false,seed:1});
const steps=(s:GameSim,n=900)=>{for(let i=0;i<n;i++)s.step();};
describe('540×900 real board',()=>{
 it('owns 15×25 cells, independent walls/floor and unchanged classic defaults',()=>{
  const real=make(),classic=new GameSim({}, {autoSpawn:false});
  expect(real.board).toEqual({width:540,height:900,cols:15,rows:25,cell:36,dangerY:72});
  expect(classic.board).toEqual(CLASSIC_BOARD);expect(classic.board.width).toBe(360);expect(classic.board.height).toBe(648);
  const [floor,left,right]=real.world.walls;
  expect(floor!.bounds.min.y).toBe(900);expect(left!.bounds.max.x).toBe(0);expect(right!.bounds.min.x).toBe(540);
  expect(real.occupancy().length).toBe(375);expect(classic.occupancy().length).toBe(180);
  expect(REAL_PX_PER_MM).toBe(72/197);real.destroy();classic.destroy();
 });
 it.each(DEVICE_KINDS)('%s spawns at the new center, traverses both walls and rotates all quadrants',kind=>{
  const s=make();s.spawner.force(kind);const e=s.spawnNext()!;expect(e.body.position.x).toBe(270);
  Matter.Body.setPosition(e.body,{x:270,y:400});
  for(const dir of [-1,1] as const){for(let i=0;i<200;i++)s.tryMove(dir);
   expect(dir<0?e.body.bounds.min.x:e.body.bounds.max.x).toBeCloseTo(dir<0?0:540,6);
   for(let i=0;i<4;i++){expect(s.tryRotate(1)).toBe(true);expect(e.body.bounds.min.x).toBeGreaterThanOrEqual(-1e-6);expect(e.body.bounds.max.x).toBeLessThanOrEqual(540+1e-6);}
  }
  s.hardDrop();steps(s);expect(s.escaped).toBe(0);expect(e.state).toBe('locked');expect(e.body.bounds.max.y).toBeCloseTo(900,1);s.destroy();
 });
 it('the old 10-column width does not clear a 15-column row; rightmost cells participate',()=>{
  const s=make();for(let c=0;c<10;c+=2)s.placeLocked('studio',c,24);
  expect(s.checkRows()).toBe(0);for(let c=10;c<14;c+=2)s.placeLocked('studio',c,24);s.placeLocked('studio',14,23,1);
  expect(s.occupancy()[24*15+14]).toBeGreaterThan(.9);expect(s.checkRows()).toBe(1);
  const fragment=[...s.entities.values()][0]!;expect(fragment.fragment).toBe(true);expect(fragment.body.bounds.max.y).toBeLessThanOrEqual(864+1e-6);
  steps(s);expect(s.escaped).toBe(0);expect(s.score().spent).toBeCloseTo(s.score().cleared+s.score().fieldValue,6);s.destroy();
 });
 it('cuts a tilted Pro in column 14 / row 24 with matching physical and mesh vertices',()=>{
  const s=make(),e=s.placeLocked('pro',12,20);Matter.Body.setPosition(e.body,{x:475,y:810});Matter.Body.setAngle(e.body,.22);
  expect(s.checkRows([24])).toBe(1);expect([...s.entities.values()].every(e=>e.fragment)).toBe(true);
  for(const item of s.renderState().items)for(const v of chassisMesh(item)){const p=worldFromLocal(chassisPose(item),v.p);expect(p[1]<=864+1e-6||p[1]>=900-1e-6).toBe(true);}
  expect(s.score().spent).toBeCloseTo(s.score().cleared+s.score().fieldValue,5);s.destroy();
 });
 it('three full-size Pro towers settle in the extra vertical space without a lost body or artificial mini gap',()=>{
  const s=make(),d=realSize('pro');
  const bodies=[0,1,2].map(i=>s.placeLocked('pro',6,(900-d.h*(i+1))/36));steps(s,1200);
  expect(s.status).toBe('running');expect(s.escaped).toBe(0);expect(s.entities.size).toBe(3);
  for(const e of bodies){expect(e.body.bounds.max.x-e.body.bounds.min.x).toBeCloseTo(d.w,1);expect(e.body.bounds.max.y).toBeLessThan(900.2);}
  expect(bodies[0]!.body.bounds.max.y).toBeCloseTo(900,1);
  for(let i=1;i<3;i++)expect(Math.abs(bodies[i-1]!.body.bounds.min.y-bodies[i]!.body.bounds.max.y)).toBeLessThan(.2);
  const state=s.renderState();for(const item of state.items){const pose=chassisPose(item);expect(pose.x).toBe(item.x);expect(pose.y).toBe(item.y);expect(pose.angle).toBe(item.angle);}
  s.destroy();
 });
 it('danger uses y=72 and its timeout; a blocked new center ends via spawn',()=>{
  const s=make(),e=s.placeLocked('studio',1,1);Matter.Body.setStatic(e.body,true);
  steps(s,119);expect(s.status).toBe('running');steps(s,1);expect(s.overReason).toBe('danger');s.destroy();
  const blocked=make();blocked.placeLocked('studio',6.5,0);blocked.spawner.force('miniM1');expect(blocked.spawnNext()).toBeNull();expect(blocked.overReason).toBe('spawn');blocked.destroy();
 });
 it('danger starts strictly above the same rendered line, not at its boundary',()=>{
  const s=make(),e=s.placeLocked('studio',0,2);Matter.Body.setStatic(e.body,true);steps(s,130);expect(s.status).toBe('running');expect(s.danger.ratio).toBe(0);s.destroy();
 });
 it('fits all board corners and unscaled Pro depth into the new oblique viewport',()=>{
  const v=obliqueViewport(REAL_BOARD),d=realSize('pro');
  for(const x of [0,540])for(const y of [0,900])for(const z of [0,d.depth]){
   const p=projectWorld(x,y,z);expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(v.width);expect(p.y+v.offsetY).toBeGreaterThan(0);expect(p.y+v.offsetY).toBeLessThan(v.height);
  }
 });
 it('retains both old record payloads byte-for-byte and saves the new board independently',()=>{
  const classic=JSON.stringify({bestSpent:123456,plays:3}),old=JSON.stringify({bestSpent:99999999,plays:8});
  const map=new Map([['tsumimac.highscore.v1',classic],['tsumimac.highscore.v1.real',old]]),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
  expect(loadHighScore(store,'real').plays).toBe(0);const s=make();s.placeLocked('pro',0,19);submitResult(s.score(),store,'real');
  expect(map.get('tsumimac.highscore.v1')).toBe(classic);expect(map.get('tsumimac.highscore.v1.real')).toBe(old);
  expect(loadHighScore(store,'real').plays).toBe(1);expect(map.has('tsumimac.highscore.v1.real.540x900.v1')).toBe(true);s.destroy();
 });
});

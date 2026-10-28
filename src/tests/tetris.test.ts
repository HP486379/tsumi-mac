import { describe,it,expect } from 'vitest';
import { DEVICE_KINDS } from '../data/devices';
import { realSize,REAL_MM,REAL_PX_PER_MM } from '../data/gameModes';
import { TetrisSim } from '../game/tetris/TetrisSim';
import { polygons,bounds,canPlace,landing,findRegions,cutPiece,DEFAULT_LINE_RULES,overlapping,type SnapPiece } from '../game/tetris/geometry';
import { polygonArea } from '../game/physics/geometry';
import { chassisMesh } from '../game/rendering/chassisMesh';
import { worldFromLocal,chassisPose } from '../game/rendering/chassisProjection';
import { loadTetrisRecord,saveTetrisResult,TETRIS_RECORD_KEY } from '../game/tetris/records';
const mini=(id:number,x:number,y=900-realSize('miniM1').h/2):SnapPiece=>({id,kind:'miniM1',x,y,angle:0});
const row=(y=900-realSize('miniM1').h/2,offset=0)=>Array.from({length:5},(_,i)=>mini(i+1,36+i*72+offset,y));
const area=(p:SnapPiece)=>polygons(p).reduce((s,p)=>s+polygonArea(p),0);
describe('independent real-dimension Tetris engine',()=>{
 it.each(DEVICE_KINDS)('%s retains real dimensions and all four orientations, including depth',kind=>{
  const sim=new TetrisSim(1,false),p=sim.spawn(kind)!,d=realSize(kind),mm=REAL_MM[kind];p.y=350;
  for(let q=0;q<4;q++){const item=sim.renderItem(p),mesh=chassisMesh(item),pose=chassisPose(item),world=mesh.map(v=>worldFromLocal(pose,v.p)),b=bounds(p);
   expect(b.maxX-b.minX).toBeCloseTo((q%2?mm.h:mm.w)*REAL_PX_PER_MM,6);expect(b.maxY-b.minY).toBeCloseTo((q%2?mm.w:mm.h)*REAL_PX_PER_MM,6);
   expect(Math.max(...world.map(v=>v[2]))-Math.min(...world.map(v=>v[2]))).toBeCloseTo(d.depth,6);
   expect(Math.max(...world.map(v=>v[0]))-Math.min(...world.map(v=>v[0]))).toBeCloseTo(b.maxX-b.minX,6);
   expect(sim.rotate(1)).toBe(true);Object.assign(p,sim.active);
  }
 });
 it.each(DEVICE_KINDS)('%s snaps to the floor and both walls without overlap, then never drifts',kind=>{
  const sim=new TetrisSim(2,false);sim.spawn(kind);sim.active!.y=350;
  sim.move(-1000);expect(bounds(sim.active!).minX).toBeCloseTo(0,8);expect(sim.rotate(1)).toBe(true);sim.move(1000);expect(bounds(sim.active!).maxX).toBeCloseTo(540,8);
  const ghost=sim.ghost()!;expect(bounds(ghost).maxY).toBeCloseTo(900,8);expect(canPlace(ghost,[])).toBe(true);sim.hardDrop();expect(sim.locked[0]!.x).toBeCloseTo(ghost.x,8);expect(sim.locked[0]!.y).toBeCloseTo(ghost.y,8);
  const fixed=JSON.stringify(sim.locked);for(let i=0;i<600;i++)sim.step(1000/60);expect(JSON.stringify(sim.locked.filter(p=>p.id===1))).toBe(fixed);
 });
 it('attracts a 4px side gap to the nearest stable face, not to a 36px cell',()=>{
  const fixed=[mini(1,36)],p=mini(2,112,100),g=landing(p,fixed);expect(g.x).toBeCloseTo(108,9);expect(bounds(g).minX-bounds(fixed[0]!).maxX).toBeCloseTo(0,9);expect(canPlace(g,fixed)).toBe(true);
  const off=mini(3,111.125,100);expect(landing(off,[],0).x).toBe(111.125);
 });
 it('lands an M4 on the Pro shell between its handles, with exact contact',()=>{
  const sim=new TetrisSim(1,false),d=realSize('pro');const pro=sim.place('pro',270,900-d.h/2);sim.spawn('miniM4');sim.active!.x=272;
  const g=sim.ghost()!,top=pro.y-d.h/2+7;expect(bounds(g).maxY).toBeCloseTo(top,8);expect(canPlace(g,sim.locked)).toBe(true);
 });
 it('sweeps a falling thin mini to contact instead of tunneling on a large soft-drop step',()=>{
  const sim=new TetrisSim(2,false);sim.place('miniM1',270,880);sim.spawn('miniM1');sim.step(10000,true);
  expect(sim.devices).toBe(1);expect(sim.locked.length).toBe(2);expect(bounds(sim.locked[1]!).maxY).toBeCloseTo(bounds(sim.locked[0]!).minY,8);
 });
 it('allows continuous movement and rejects rotation through a blocking Mac',()=>{
  const s=new TetrisSim(1,false);s.spawn('pro');s.active!.y=400;s.move(7.125);expect(s.active!.x).toBe(277.125);
  s.place('pro',160,400);expect(s.rotate(1)).toBe(false);expect(s.active!.angle).toBe(0);
 });
 it('finds 360px away from the board edge and removes only that filled interval',()=>{
  const s=new TetrisSim(1,false);s.locked=[...row(undefined,40),mini(8,490)];const r=findRegions(s.locked);expect(r).toHaveLength(1);expect(r[0]!.x0).toBeCloseTo(40);expect(r[0]!.x1).toBeCloseTo(400);
  expect(s.resolve()).toBe(1);expect(s.locked).toHaveLength(1);expect(s.locked[0]!.id).toBe(8);expect(s.points).toBeGreaterThan(100);
 });
 it('plays five legal sequential drops into a 360px line and awards fixed value plus clear points',()=>{
  const s=new TetrisSim(1,false);s.spawner.force('miniM1');s.spawn();
  for(let i=0;i<5;i++){s.move(36+i*72-s.active!.x);s.spawner.force('miniM1');s.hardDrop();}
  expect(s.devices).toBe(5);expect(s.lines).toBe(1);expect(s.locked).toHaveLength(0);expect(s.points).toBe(482);expect(s.active).not.toBeNull();expect(s.over).toBe(false);
 });
 it('does not mistake overlapping polygons or 358.8px of union width for 360px',()=>{
  const p=row();p[4]!.x-=1.2;expect(findRegions([...p,p[0]!])).toEqual([]);
 });
 it.each([358,358.99,359,359.74,359.8,360])('checks the exact %s px threshold with only the configured tolerance',width=>{const p=row();p[4]!.x-=360-width;expect(findRegions(p).length>0).toBe(width>=360-DEFAULT_LINE_RULES.gapTolerance);});
 it('has adjustable micro-gap tolerance and never fills an obvious opening',()=>{
  const p=row();p.forEach((p,i)=>p.x+=i*.2);expect(findRegions(p)).toHaveLength(1);expect(findRegions(p,{...DEFAULT_LINE_RULES,gapTolerance:.05})).toEqual([]);
  p[4]!.x+=2;expect(findRegions(p)).toEqual([]);
 });
 it('handles multiple vertical runs, and scores simultaneous lines with a bonus',()=>{
  const h=realSize('miniM1').h,s=new TetrisSim(1,false);s.locked=[...row(),...row(900-h*1.5,180).map(p=>({...p,id:p.id+10}))];
  expect(findRegions(s.locked)).toHaveLength(2);expect(s.resolve()).toBe(1);expect(s.lines).toBe(2);expect(s.locked).toHaveLength(0);expect(s.points).toBeGreaterThan(400);
 });
 it('ignores unrelated external vertices when counting a run, but retains two real stacked rows',()=>{
  const h=realSize('miniM1').h;expect(findRegions([...row(),{id:20,kind:'miniM4',x:450,y:886,angle:0}])).toHaveLength(1);
  expect(findRegions([...row(),...row(900-h*1.5).map(p=>({...p,id:p.id+10}))])).toHaveLength(2);
 });
 it('subtracts overlapping clear rectangles once, retaining real mesh offsets and area',()=>{
  const p:SnapPiece={id:5,kind:'studio',x:180,y:500,angle:.25},before=area(p);let id=20;
  const regions=[{x0:150,x1:185,y0:485,y1:510},{x0:170,x1:205,y0:490,y1:515}];
  const cut=cutPiece(p,regions,()=>id++);expect(cut.pieces.length).toBeGreaterThan(1);expect(cut.removedArea+cut.pieces.reduce((s,p)=>s+area(p),0)).toBeCloseTo(before,6);
  const sim=new TetrisSim(1,false);for(const f of cut.pieces){expect(f.angle).toBe(p.angle);expect(f.geometry!.source.w).toBe(realSize('studio').w);for(const v of chassisMesh(sim.renderItem(f))){const world=worldFromLocal(chassisPose(sim.renderItem(f)),v.p);for(const r of regions)expect(world[0]<=r.x0+1e-6||world[0]>=r.x1-1e-6||world[1]<=r.y0+1e-6||world[1]>=r.y1-1e-6).toBe(true);}}
 });
 it('re-fixes fragments downward without rotation and triggers a second chain',()=>{
  const s=new TetrisSim(1,false),h=realSize('miniM1').h;
  // First full row lies above two half rows. It is removed, then both half
  // rows descend onto the floor and align into the second complete run.
  s.locked=[...row(750),...row().slice(0,3).map(p=>({...p,id:p.id+10})),...row(700).slice(3).map(p=>({...p,id:p.id+20}))];
  expect(s.resolve()).toBe(2);expect(s.maxChain).toBe(2);expect(s.lines).toBe(2);expect(s.locked).toHaveLength(0);expect(h).toBeGreaterThan(0);
 });
 it('settles actual severed fragments, preserves their angles and source geometry, and leaves no overlap',()=>{
  const s=new TetrisSim(1,false),p:SnapPiece={id:1,kind:'studio',x:220,y:400,angle:.2};let id=10;
  s.locked=cutPiece(p,[{x0:200,x1:240,y0:395,y1:405}],()=>id++).pieces;expect(s.locked.length).toBeGreaterThan(1);const before=s.area;
  s.settle();expect(s.area).toBeCloseTo(before,8);for(const q of s.locked){expect(q.angle).toBe(.2);expect(q.geometry!.source.w).toBe(realSize('studio').w);expect(bounds(q).maxY).toBeLessThanOrEqual(900+1e-7);expect(canPlace(q,s.locked.filter(p=>p.id!==q.id))).toBe(true);}
  const fixed=JSON.stringify(s.locked);s.settle();expect(JSON.stringify(s.locked)).toBe(fixed);
 });
 it('spawns a new piece after a lock, gives fixed-value points and ends at a blocked spawn',()=>{
  const s=new TetrisSim(1,false);s.spawn('miniM1');s.hardDrop();expect(s.devices).toBe(1);expect(s.points).toBeGreaterThan(0);expect(s.active).not.toBeNull();
  const b=new TetrisSim(1,false);b.place('studio',270,realSize('studio').h/2);expect(b.spawn('miniM1')).toBeNull();expect(b.over).toBe(true);
 });
 it('only writes the new Tetris record key, preserving all old records and settings bytes',()=>{
  const keys=['tsumimac.highscore.v1','tsumimac.highscore.v1.real','tsumimac.highscore.v1.real.540x900.v1','tsumimac.settings.v1'],map=new Map(keys.map(k=>[k,'{"legacy":123}'])),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
  saveTetrisResult(1234,5,2,store);saveTetrisResult(100,2,1,store);expect(loadTetrisRecord(store)).toEqual({bestScore:1234,bestLines:5,bestChain:2,plays:2});expect(map.has(TETRIS_RECORD_KEY)).toBe(true);for(const k of keys)expect(map.get(k)).toBe('{"legacy":123}');
 });
 it('never creates interpenetrating locked pieces in a seeded 50-piece move/rotate/drop run',()=>{
  const s=new TetrisSim(123);for(let i=0;i<50&&!s.over;i++){s.move((i%7-3)*47.125);if(i%2){s.active!.y=Math.max(s.active!.y,110);s.rotate(1);}s.hardDrop();for(let a=0;a<s.locked.length;a++)for(let b=a+1;b<s.locked.length;b++)for(const p of polygons(s.locked[a]!))for(const q of polygons(s.locked[b]!))expect(overlapping(p,q)).toBe(false);}
 });
});

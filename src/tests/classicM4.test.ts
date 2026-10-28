import { describe,it,expect } from 'vitest';
import { chassisMesh } from '../game/rendering/chassisMesh';
import { chassisPose,worldFromLocal } from '../game/rendering/chassisProjection';
import type { RenderItem } from '../game/rendering/renderer';
const item=(angle=0):RenderItem=>({x:180,y:630,angle,active:false,key:{kind:'miniM4',wCells:1,hCells:1,refurb:false,cutTop:false,cutBottom:false}});
describe('classic M4 appearance without a new collision envelope',()=>{
 it.each([0,Math.PI/2,Math.PI,Math.PI*1.5])('retains 36×36×36, floor contact and the physical pivot at angle %s',angle=>{
  const p=item(angle),pose=chassisPose(p),mesh=chassisMesh(p),vertices=mesh.map(v=>worldFromLocal(pose,v.p));
  for(const axis of [0,1,2]){const values=vertices.map(v=>v[axis]!);expect(Math.max(...values)-Math.min(...values)).toBeCloseTo(36,9);}
  expect(Math.max(...vertices.map(v=>v[1]))).toBeCloseTo(648,9);expect(pose.x).toBe(180);expect(pose.y).toBe(630);expect(pose.angle).toBe(angle);
  expect(mesh.every(v=>v.n.every(Number.isFinite))).toBe(true);for(const v of mesh)expect(Math.hypot(...v.n)).toBeCloseTo(1,10);
 });
 it('has a circular 0.72px world-space shoulder instead of a Y-stretched fillet',()=>{
  const p=item(),pose=chassisPose(p),b=.72,shoulder=chassisMesh(p).filter(v=>Math.abs(v.n[0])<1e-9&&v.n[1]<-1e-9&&v.n[2]<-1e-9);
  expect(shoulder.length).toBeGreaterThan(20);
  for(const v of shoulder){const y=v.p[1]*pose.sy+18;expect(Math.hypot(v.p[2]-b,y-b)).toBeCloseTo(b,9);}
 });
 it('keeps both chassis contact caps aligned when stacked, including cut variants',()=>{
  for(const flags of [{cutTop:false,cutBottom:false},{cutTop:true,cutBottom:false},{cutTop:false,cutBottom:true}]){
   const lower=item(),upper={...item(),y:594,key:{...item().key,...flags}};
   const lowerY=chassisMesh(lower).map(v=>worldFromLocal(chassisPose(lower),v.p)[1]),upperY=chassisMesh(upper).map(v=>worldFromLocal(chassisPose(upper),v.p)[1]);
   expect(Math.min(...lowerY)-Math.max(...upperY)).toBeCloseTo(0,9);
  }
 });
});

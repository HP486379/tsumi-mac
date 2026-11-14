import { DEVICE_KINDS, type DeviceKind } from '../../src/data/devices';
import { deviceCells } from '../../src/data/gameModes';
import { CELL, FIELD_H } from '../../src/game/config';
import { chassisMesh, modelDimensions } from '../../src/game/rendering/chassisMesh';
import { chassisPose, projectWorld, worldFromLocal, type Pose } from '../../src/game/rendering/chassisProjection';
import { makeItem, ANGLES } from '../sync/audit';
import type { RenderItem } from '../../src/game/rendering/renderer';

const meshes=new Map<DeviceKind,ReturnType<typeof chassisMesh>>();
const mesh=(kind:DeviceKind)=>{let m=meshes.get(kind);if(!m){m=chassisMesh(makeItem(kind));meshes.set(kind,m);}return m;};
/** Intersect actual triangles with a line parallel to local Y. This measures
 * real surfaces, not the nominal +/- height/2 contact envelope. */
export function surfaceY(kind:DeviceKind,x:number,z:number) {
  const m=mesh(kind),hits:number[]=[];
  for(let i=0;i<m.length;i+=3) {
    const a=m[i]!.p,b=m[i+1]!.p,c=m[i+2]!.p;
    const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(area)<1e-10)continue;
    const u=((b[0]-x)*(c[2]-z)-(b[2]-z)*(c[0]-x))/area;
    const v=((c[0]-x)*(a[2]-z)-(c[2]-z)*(a[0]-x))/area,t=1-u-v;
    if(Math.min(u,v,t)>=-1e-9)hits.push(u*a[1]+v*b[1]+t*c[1]);
  }
  if(!hits.length)throw Error(`No surface ${kind} ${x} ${z}`);
  return {top:Math.min(...hits),bottom:Math.max(...hits)};
}
export function fittedPose(item:RenderItem):Pose {
  const d=modelDimensions(item),offset=(item.key.hCells*CELL-d.h)/2;
  return {x:item.x-Math.sin(item.angle)*offset,y:item.y+Math.cos(item.angle)*offset,angle:item.angle,sx:1,sy:1};
}
export const FLAT_KINDS=DEVICE_KINDS.filter(k=>k!=='pro');
export function surfacePair(lowerKind:DeviceKind,upperKind:DeviceKind,angle:number,legacy=false) {
  const lower=makeItem(lowerKind,160,FIELD_H-deviceCells(lowerKind,'classic').h*CELL/2,angle);
  const distance=(deviceCells(lowerKind,'classic').h+deviceCells(upperKind,'classic').h)*CELL/2;
  const upper=makeItem(upperKind,lower.x+Math.sin(angle)*distance,lower.y-Math.cos(angle)*distance,angle);
  const dl=modelDimensions(lower),du=modelDimensions(upper),z=Math.min(dl.depth,du.depth)/2;
  const l=surfaceY(lowerKind,0,z),u=surfaceY(upperKind,0,z),pose=legacy?fittedPose:chassisPose;
  const lowerSurface=worldFromLocal(pose(lower),[0,l.top,z]),upperSurface=worldFromLocal(pose(upper),[0,u.bottom,z]);
  const a=projectWorld(...lowerSurface),b=projectWorld(...upperSurface);
  return {lowerKind,upperKind,angle,z,localLowerTop:l.top,localUpperBottom:u.bottom,lowerSurface,upperSurface,
    worldGap:Math.hypot(...lowerSurface.map((v,i)=>v-upperSurface[i]!)),screenGap:Math.hypot(a.x-b.x,a.y-b.y),screenLower:a,screenUpper:b};
}
export function auditSurfaces() {
  const pairs=FLAT_KINDS.flatMap(l=>FLAT_KINDS.flatMap(u=>ANGLES.slice(0,6).map(a=>surfacePair(l,u,a))));
  const ground=DEVICE_KINDS.flatMap(kind=>[0,Math.PI/2,Math.PI,3*Math.PI/2].map(angle=>{
    const item=makeItem(kind,180,0,angle),halfHeight=(Math.abs(Math.sin(angle))*item.key.wCells+Math.abs(Math.cos(angle))*item.key.hCells)*CELL/2;
    item.y=FIELD_H-halfHeight;
    const ys=mesh(kind).map(v=>worldFromLocal(chassisPose(item),v.p)[1]);
    return {kind,angle,maxWorldY:Math.max(...ys),floorGap:FIELD_H-Math.max(...ys),pivotError:Math.hypot(chassisPose(item).x-item.x,chassisPose(item).y-item.y)};
  }));
  const morphology=DEVICE_KINDS.map(kind=>{
    const item=makeItem(kind),m=mesh(kind),d=modelDimensions(item);
    const curvedNormals=new Set(m.filter(v=>Math.abs(v.n[0])>.01&&Math.abs(v.n[2])>.01).map(v=>v.n.map(n=>n.toFixed(5)).join(','))).size;
    const bevelNormals=m.filter(v=>Math.abs(v.n[1])>.01&&Math.abs(v.n[1])<.99).length;
    return {kind,depth:d.depth,minZ:Math.min(...m.map(v=>v.p[2])),maxZ:Math.max(...m.map(v=>v.p[2])),curvedNormals,bevelNormals,triangles:m.length/3};
  });
  return {pairs,ground,morphology,maxSurfaceGap:Math.max(...pairs.map(p=>p.worldGap)),maxGroundGap:Math.max(...ground.map(g=>Math.abs(g.floorGap))),
    oldMiniGap:surfacePair('miniM2','miniM2',0,true),miniGap:surfacePair('miniM2','miniM2',0)};
}

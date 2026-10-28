import { polygonAABB,polygonArea,clipPolygonToRect,rectVertices,type Polygon } from '../physics/geometry';
import { realSize,type FragmentGeometry } from '../../data/gameModes';
import type { DeviceKind } from '../../data/devices';
import { centroid } from '../grid/realRowClear';

export const EPS=1e-7;
export interface SnapPiece {id:number;kind:DeviceKind;x:number;y:number;angle:number;geometry?:FragmentGeometry}
export interface ClearRegion {x0:number;x1:number;y0:number;y1:number}
export interface LineRules {minimum:number;gapTolerance:number;minimumHeight:number}
export const DEFAULT_LINE_RULES:Readonly<LineRules>={minimum:360,gapTolerance:.25,minimumHeight:.5};
export function polygons(piece:SnapPiece):Polygon[]{
 const d=realSize(piece.kind),c=Math.cos(piece.angle),s=Math.sin(piece.angle);
 const transform=(p:Polygon)=>p.map(v=>({x:piece.x+c*v.x-s*v.y,y:piece.y+s*v.x+c*v.y}));
 if(piece.geometry)return [transform(piece.geometry.outline)];
 // The same two-dimensional contact silhouette as the real chassis: shell,
 // rails and feet for Pro. Depth remains an independent, unscaled mesh axis.
 if(piece.kind==='pro'){
  const p=[rectVertices(0,2,d.w,d.h-10,0)];for(const x of [-d.w*.39,d.w*.39])p.push(rectVertices(x,-d.h/2+3.5,2.4,7,0),rectVertices(x,d.h/2-1.5,3,3,0));return p.map(transform);
 }
 if(piece.kind==='macPro2013'){
  const r=d.w*.024,w=d.w/2,h=d.h/2;
  return [transform([{x:-w+r,y:-h},{x:w-r,y:-h},{x:w,y:-h+r},{x:w,y:h-r},{x:w-r,y:h},{x:-w+r,y:h},{x:-w,y:h-r},{x:-w,y:-h+r}])];
 }
 return [rectVertices(piece.x,piece.y,d.w,d.h,piece.angle)];
}
export function bounds(p:SnapPiece){return polygonAABB(polygons(p).flat());}
/** Exact swept SAT. Returns the first contact distance along a unit direction.
 * A zero-width tangency on an orthogonal axis permits sliding past a side. */
export function sweep(a:Polygon,b:Polygon,dx:number,dy:number):number{
 let enter=-Infinity,exit=Infinity;
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i]!,q=poly[(i+1)%poly.length]!,nx=q.y-p.y,ny=p.x-q.x,len=Math.hypot(nx,ny);if(len<EPS)continue;
  const x=nx/len,y=ny/len,av=a.map(v=>v.x*x+v.y*y),bv=b.map(v=>v.x*x+v.y*y),amin=Math.min(...av),amax=Math.max(...av),bmin=Math.min(...bv),bmax=Math.max(...bv),v=dx*x+dy*y;
  if(Math.abs(v)<EPS){if(Math.min(amax,bmax)-Math.max(amin,bmin)<=EPS)return Infinity;continue;}
  const t1=(bmin-amax)/v,t2=(bmax-amin)/v;enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));if(enter>exit-EPS)return Infinity;
 }
 if(exit<=EPS)return Infinity;return Math.max(0,enter);
}
export function overlapping(a:Polygon,b:Polygon):boolean{
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i]!,q=poly[(i+1)%poly.length]!,nx=q.y-p.y,ny=p.x-q.x,len=Math.hypot(nx,ny);if(len<EPS)continue;
  const av=a.map(v=>(v.x*nx+v.y*ny)/len),bv=b.map(v=>(v.x*nx+v.y*ny)/len);
  if(Math.min(Math.max(...av),Math.max(...bv))-Math.max(Math.min(...av),Math.min(...bv))<=EPS)return false;
 }return true;
}
export function canPlace(p:SnapPiece,locked:readonly SnapPiece[],width=540,height=900){
 const a=polygons(p),b=polygonAABB(a.flat());return b.minX>=-EPS&&b.maxX<=width+EPS&&b.maxY<=height+EPS&&!locked.some(q=>polygons(q).some(y=>a.some(x=>overlapping(x,y))));
}
export function travel(p:SnapPiece,locked:readonly SnapPiece[],dx:number,dy:number,height=900):number{
 let distance=dy>0?height-bounds(p).maxY:Infinity;
 for(const a of polygons(p))for(const q of locked)for(const b of polygons(q))distance=Math.min(distance,sweep(a,b,dx,dy));return Math.max(0,distance);
}
function interval(poly:Polygon,y:number):[number,number]|null{
 const xs:number[]=[];for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!;
  if(Math.abs(a.y-y)<EPS)xs.push(a.x);
  if((a.y<y&&b.y>y)||(a.y>y&&b.y<y))xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));
 }return xs.length?[Math.min(...xs),Math.max(...xs)]:null;
}
function merge(intervals:[number,number][],gap:number):[number,number][]{
 const out:[number,number][]=[];for(const [a,b] of intervals.sort((a,b)=>a[0]-b[0])){const last=out.at(-1);if(last&&a-last[1]<=gap+EPS)last[1]=Math.max(last[1],b);else out.push([a,b]);}return out;
}
/** Vertex-height slabs use continuous polygon cross sections. Intersecting the
 * top/bottom runs yields rectangles that are filled across the entire slab. */
export function findRegions(pieces:readonly SnapPiece[],rules:Readonly<LineRules>=DEFAULT_LINE_RULES):ClearRegion[]{
 const polys=pieces.flatMap(polygons),ys=[...new Set(polys.flatMap(p=>p.map(v=>Math.max(0,Math.min(900,v.y)))))].sort((a,b)=>a-b),out:ClearRegion[]=[];
 const runs=(y:number)=>merge(polys.flatMap(p=>{const r=interval(p,y);return r&&r[1]-r[0]>EPS?[r]:[];}),rules.gapTolerance);
 for(let i=0;i<ys.length-1;i++){
  const y0=ys[i]!,y1=ys[i+1]!;if(y1-y0<rules.minimumHeight-EPS)continue;
  for(const a of runs(y0+EPS*2))for(const b of runs(y1-EPS*2)){
   const x0=Math.max(a[0],b[0],0),x1=Math.min(a[1],b[1],540);if(x1-x0+rules.gapTolerance<rules.minimum-EPS)continue;
   out.push({x0,x1,y0,y1});
  }
 }
 // Unrelated vertex heights outside a run must not inflate its line count.
 // Keep a genuine stacked-row seam only when top AND bottom contact edges
 // cover the run; otherwise adjacent identical rectangles are one region.
 const seam=(r:ClearRegion,y:number)=>{
  const covers=(bottom:boolean)=>{const edges:[number,number][]=[];for(const p of polys){const cy=p.reduce((s,v)=>s+v.y,0)/p.length;for(let i=0;i<p.length;i++){const a=p[i]!,b=p[(i+1)%p.length]!;if(Math.abs(a.y-y)<EPS&&Math.abs(b.y-y)<EPS&&(bottom?cy<y:cy>y))edges.push([Math.min(a.x,b.x),Math.max(a.x,b.x)]);}}return merge(edges,rules.gapTolerance).some(([a,b])=>a<=r.x0+rules.gapTolerance&&b>=r.x1-rules.gapTolerance);};
  return covers(true)&&covers(false);
 };
 const merged:ClearRegion[]=[];for(const r of out){const prev=merged.find(p=>Math.abs(p.y1-r.y0)<EPS&&Math.abs(p.x0-r.x0)<EPS&&Math.abs(p.x1-r.x1)<EPS);if(prev&&!seam(r,r.y0))prev.y1=r.y1;else merged.push({...r});}return merged;
}
function outside(poly:Polygon,r:ClearRegion):Polygon[]{
 const box=polygonAABB(poly),mid={minX:box.minX-1,maxX:box.maxX+1,minY:r.y0,maxY:r.y1};
 return [clipPolygonToRect(poly,{minX:box.minX-1,maxX:box.maxX+1,minY:box.minY-1,maxY:r.y0}),clipPolygonToRect(poly,{minX:box.minX-1,maxX:box.maxX+1,minY:r.y1,maxY:box.maxY+1}),clipPolygonToRect(poly,{...mid,minX:box.minX-1,maxX:r.x0}),clipPolygonToRect(poly,{...mid,minX:r.x1,maxX:box.maxX+1})].filter(p=>p.length>=3&&polygonArea(p)>.001);
}
/** Subtract the union sequentially; overlapping regions never remove value
 * twice. Each retained convex piece keeps its original mesh coordinates. */
export function cutPiece(piece:SnapPiece,regions:readonly ClearRegion[],nextId:()=>number):{pieces:SnapPiece[];removedArea:number}{
 const original=polygons(piece),area=original.reduce((s,p)=>s+polygonArea(p),0);let parts=original;
 for(const region of regions)parts=parts.flatMap(poly=>{const overlap=clipPolygonToRect(poly,{minX:region.x0,maxX:region.x1,minY:region.y0,maxY:region.y1});return polygonArea(overlap)>EPS?outside(poly,region):[poly];});
 const remaining=parts.reduce((s,p)=>s+polygonArea(p),0);if(area-remaining<EPS)return {pieces:[piece],removedArea:0};
 const c=Math.cos(piece.angle),s=Math.sin(piece.angle),d=realSize(piece.kind),source=piece.geometry?.source??{w:d.w,h:d.h,offsetX:0,offsetY:0};
 const kept=parts.filter(p=>{const b=polygonAABB(p);return polygonArea(p)>.1&&b.maxX-b.minX>=.1&&b.maxY-b.minY>=.1;});
 return {pieces:kept.map(poly=>{const center=centroid(poly),dx=c*(center.x-piece.x)+s*(center.y-piece.y),dy=-s*(center.x-piece.x)+c*(center.y-piece.y);return {id:nextId(),kind:piece.kind,x:center.x,y:center.y,angle:piece.angle,geometry:{outline:poly.map(v=>({x:c*(v.x-center.x)+s*(v.y-center.y),y:-s*(v.x-center.x)+c*(v.y-center.y)})),source:{...source,offsetX:source.offsetX+dx,offsetY:source.offsetY+dy}}};}),removedArea:area-kept.reduce((sum,p)=>sum+polygonArea(p),0)};
}
function supportStability(p:SnapPiece,locked:readonly SnapPiece[]):number{
 const contacts:number[]=[];for(const poly of polygons(p)){
  for(const v of poly)if(Math.abs(v.y-900)<1e-5)contacts.push(v.x);
  for(const q of locked)for(const other of polygons(q)){
   const bb=polygonAABB(poly),qb=polygonAABB(other),left=Math.max(bb.minX,qb.minX),right=Math.min(bb.maxX,qb.maxX);if(right<left-EPS)continue;
   const xs=[left,right,...poly.map(v=>v.x),...other.map(v=>v.x)].filter(x=>x>=left-EPS&&x<=right+EPS);
   for(const x of xs){const vertical=(a:Polygon)=>interval(a.map(v=>({x:v.y,y:v.x})),x);const a=vertical(poly),b=vertical(other);if(a&&b&&Math.abs(a[1]-b[0])<1e-5)contacts.push(x);}
  }
 }return contacts.length?Math.max(0,Math.min(...contacts)-p.x,p.x-Math.max(...contacts)):Infinity;
}
export function landing(p:SnapPiece,locked:readonly SnapPiece[],snapDistance=10):SnapPiece{
 const b=bounds(p),xs=[p.x-b.minX,p.x+540-b.maxX];
 for(const q of locked){const a=bounds(q);xs.push(p.x+a.minX-b.maxX,p.x+a.maxX-b.minX,p.x+a.minX-b.minX,p.x+a.maxX-b.maxX);}
 const make=(x:number)=>{const start={...p,x};if(!canPlace(start,locked)||travel(p,locked,Math.sign(x-p.x),0)<Math.abs(x-p.x)-EPS)return null;const result={...start,y:start.y+travel(start,locked,0,1)};return canPlace(result,locked)?result:null;};
 const aligned=[...new Set(xs)].filter(x=>Math.abs(x-p.x)<=snapDistance+EPS).map(make).filter((p):p is SnapPiece=>!!p);
 // Stable face alignments within the small attraction radius beat a free
 // position. The nearest stable candidate wins; otherwise keep the cursor X.
 aligned.sort((a,b)=>Number(supportStability(a,locked)>EPS)-Number(supportStability(b,locked)>EPS)||Math.abs(a.x-p.x)-Math.abs(b.x-p.x)||Math.abs(a.y-p.y)-Math.abs(b.y-p.y));
 return aligned.find(a=>supportStability(a,locked)<=EPS)??make(p.x)??aligned[0]??p;
}

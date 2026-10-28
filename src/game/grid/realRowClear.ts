import type { FragmentGeometry } from '../../data/gameModes';
import type { PieceState,FragmentSpec,RowClearPlan } from './rowClear';
import { CELL } from '../config';
import { polygonArea,rectVertices,type Polygon } from '../physics/geometry';

export type RealPiece=PieceState & {geometry?:FragmentGeometry;vertices?:Polygon;polygons?:Polygon[]};
export type RealFragment=FragmentSpec & {geometry:FragmentGeometry};
/** Half-plane clipping; horizontal cut bands can leave convex polygon pieces. */
function clip(poly:Polygon,y:number,keepBelow:boolean):Polygon {
    const out:Polygon=[];for(let i=0;i<poly.length;i++){
    const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=(a.y-y)*(keepBelow?1:-1),db=(b.y-y)*(keepBelow?1:-1);
    if(da>=-1e-9)out.push({...a});
    if((da>1e-9&&db< -1e-9)||(da< -1e-9&&db>1e-9)){const t=(y-a.y)/(b.y-a.y);out.push({x:a.x+(b.x-a.x)*t,y});}
  }return out;
}
export function centroid(poly:Polygon){let area=0,x=0,y=0;for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,k=a.x*b.y-b.x*a.y;area+=k;x+=(a.x+b.x)*k;y+=(a.y+b.y)*k;}return {x:x/(3*area),y:y/(3*area)};}
export function planRealRowClear(pieces:RealPiece[],rows:number[],cell=CELL):RowClearPlan & {create:RealFragment[]} {
  const plan:RowClearPlan & {create:RealFragment[]}={removeIds:[],create:[],clearedValue:0,clearedCells:0,wholeRemovedIds:[]};
  for(const p of pieces){
    const c=Math.cos(p.angle),s=Math.sin(p.angle);
    const original=p.vertices??(p.geometry?p.geometry.outline.map(v=>({x:p.cx+c*v.x-s*v.y,y:p.cy+s*v.x+c*v.y})):rectVertices(p.cx,p.cy,p.wCells*CELL,p.hCells*CELL,p.angle));
    const originals=p.polygons??[original],area=originals.reduce((sum,poly)=>sum+polygonArea(poly),0);let parts=originals;
    for(const row of [...new Set(rows)].sort((a,b)=>a-b)){
      const next:Polygon[]=[];for(const poly of parts)for(const piece of [clip(poly,row*cell,false),clip(poly,(row+1)*cell,true)])if(piece.length>=3&&polygonArea(piece)>.1&&Math.max(...piece.map(v=>v.x))-Math.min(...piece.map(v=>v.x))>=.5&&Math.max(...piece.map(v=>v.y))-Math.min(...piece.map(v=>v.y))>=.5)next.push(piece);parts=next;
    }
    const remaining=parts.reduce((sum,poly)=>sum+polygonArea(poly),0);if(area-remaining<1e-7)continue;
    plan.removeIds.push(p.id);plan.clearedValue+=p.value*Math.max(0,1-remaining/area);plan.clearedCells+=(area-remaining)/(cell*cell);
    for(const poly of parts){
      const center=centroid(poly),outline=poly.map(v=>({x:c*(v.x-center.x)+s*(v.y-center.y),y:-s*(v.x-center.x)+c*(v.y-center.y)}));
      const dx=c*(center.x-p.cx)+s*(center.y-p.cy),dy=-s*(center.x-p.cx)+c*(center.y-p.cy);
      const source=p.geometry?.source??{w:p.wCells*CELL,h:p.hCells*CELL,offsetX:0,offsetY:0};
      const w=Math.max(...outline.map(v=>v.x))-Math.min(...outline.map(v=>v.x)),h=Math.max(...outline.map(v=>v.y))-Math.min(...outline.map(v=>v.y));
      plan.create.push({kind:p.kind,refurb:p.refurb,sourceId:p.id,cx:center.x,cy:center.y,angle:p.angle,wCells:w/CELL,hCells:h/CELL,value:p.value*polygonArea(poly)/area,vx:p.vx,vy:p.vy,cutTop:true,cutBottom:true,
        geometry:{outline,source:{...source,offsetX:source.offsetX+dx,offsetY:source.offsetY+dy}}});
    }
  }return plan;
}

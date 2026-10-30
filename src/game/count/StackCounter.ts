import type { DeviceEntity } from '../entities/DeviceEntity';
import type { BoardSpec } from '../board';
import { clipPolygonToRect,polygonArea } from '../physics/geometry';

export function overlapsBoard(e:DeviceEntity,board:Readonly<BoardSpec>):boolean {
 const parts=e.body.parts.length>1?e.body.parts.slice(1):[e.body];
 return parts.some(p=>polygonArea(clipPolygonToRect(p.vertices,{minX:0,minY:0,maxX:board.width,maxY:board.height}))>1e-7);
}

export class StackCounter {
 current=0;peak=0;
 private retired=new Set<number>();
 retire(id:number){this.retired.add(id);}
 update(entities:Iterable<DeviceEntity>,board:Readonly<BoardSpec>){
  const ids=new Set<number>();
  for(const e of entities){
   if(e.state!=='locked'||this.retired.has(e.individualId))continue;
   if(overlapsBoard(e,board))ids.add(e.individualId);
  }
  this.current=ids.size;this.peak=Math.max(this.peak,this.current);
 }
}

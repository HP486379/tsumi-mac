import Matter from 'matter-js';
import { GameSim } from '../../src/game/engine/GameSim';
import { CountSim } from '../../src/game/count/CountSim';
import { deviceCells } from '../../src/data/gameModes';
import type { DeviceEntity } from '../../src/game/entities/DeviceEntity';
import { polygonArea,clipPolygonToRect } from '../../src/game/physics/geometry';

export function auditChannel(mode:'classic'|'real'|'count',kind:'miniM1'|'miniM2',gap:number,unswept=false){
 const opts={autoSpawn:false,randomEvents:false,seed:42},s=mode==='count'?new CountSim({},opts):new GameSim({}, {...opts,mode});
 if(unswept)(s as unknown as {safeFallSpeed:(e:DeviceEntity,speed:number)=>number}).safeFallSpeed=(_e,speed)=>speed;
 const d=deviceCells('pro',s.mode),row=(s.board.height-d.h*36)/36,L=204,R=L+gap;
 const walls=[s.placeLocked('pro',(L-d.w*36)/36,row),s.placeLocked('pro',R/36,row)];for(const w of walls)Matter.Body.setStatic(w.body,true);
 s.spawner.force(kind);const e=s.spawnNext()!;s.tryRotate(1);const start=e.body.position.x,target=start+Math.round(((L+R)/2-start)/4)*4;
 for(let n=0;n<150&&Math.abs(e.body.position.x-target)>1e-8;n++)s.tryMove(e.body.position.x>target?-1:1);
 const width=e.hCells*36,reachable={min:L+width/2,max:R-width/2,step:4,start,target};let maxIntersectionArea=0,steps=0;
 s.hardDrop();for(;steps<1000&&s.active;steps++){
  s.step();for(const w of walls)for(const part of w.body.parts.length>1?w.body.parts.slice(1):[w.body]){const b=part.bounds;maxIntersectionArea=Math.max(maxIntersectionArea,polygonArea(clipPolygonToRect(e.body.vertices,{minX:b.min.x,minY:b.min.y,maxX:b.max.x,maxY:b.max.y})));}
 }
 const result={mode,kind,gap,unswept,width,reachable,steps,state:e.state,x:e.body.position.x,y:e.body.position.y,angle:e.body.angle,bottom:Math.max(...e.body.vertices.map(v=>v.y)),floor:s.board.height,wallTop:row*36,maxIntersectionArea,escaped:s.escaped};s.destroy();return result;
}

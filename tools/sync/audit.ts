import Matter from 'matter-js';
import { DEVICES, DEVICE_KINDS, type DeviceKind } from '../../src/data/devices';
import { CELL, FIELD_H } from '../../src/game/config';
import { GameSim } from '../../src/game/engine/GameSim';
import { modelDimensions, type V3 } from '../../src/game/rendering/chassisMesh';
import { chassisPose, projectLocal, projectWorld, worldFromLocal } from '../../src/game/rendering/chassisProjection';
import type { RenderItem } from '../../src/game/rendering/renderer';

export const ANGLES=[0,Math.PI/2,Math.PI,3*Math.PI/2,-.41,.33,2*Math.PI];
export const makeItem=(kind:DeviceKind,x=180,y=400,angle=0):RenderItem=>({x,y,angle,active:false,
  key:{kind,wCells:DEVICES[kind].w,hCells:DEVICES[kind].h,refurb:false,cutTop:false,cutBottom:false}});
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const inverse=(p:{x:number;y:number})=>{const x=(p.x-28)/.84;return {x,y:(p.y-38-.12*x)/.9};};
export function auditAll() {
  const sim=new GameSim({}, {seed:42,autoSpawn:false,randomEvents:false});
  const rows=[];
  for(const kind of DEVICE_KINDS) for(const angle of ANGLES) {
    const entity=sim.placeLocked(kind,3,9);Matter.Body.setAngle(entity.body,angle);
    const item=sim.renderState().items.at(-1)!,dim=modelDimensions(item),pose=chassisPose(item);
    const anchor=worldFromLocal(pose,[0,0,0]),anchorScreen=projectLocal(item,[0,0,0]);
    const axis=inverse(projectLocal(item,[dim.w/2,0,0])),origin=inverse(anchorScreen);
    const measuredAngle=Math.atan2(axis.y-origin.y,axis.x-origin.x);
    let maxMathError=0,maxMatterVertexProjectionError=0;
    const points:V3[]=[[0,0,0],[-dim.w/2,-dim.h/2,0],[dim.w/2,dim.h/2,0],[dim.w/2,0,dim.depth],[0,dim.h/2,dim.depth/2]];
    for(const p of points) {
      const c=Math.cos(angle),s=Math.sin(angle),x=pose.x+c*p[0]*pose.sx-s*p[1]*pose.sy,y=pose.y+s*p[0]*pose.sx+c*p[1]*pose.sy;
      const reference={x:28+.84*x+.42*p[2],y:38+.12*x+.9*y-.273*p[2]};
      maxMathError=Math.max(maxMathError,distance(reference,projectLocal(item,p)));
    }
    for(const v of entity.body.vertices) {
      const dx=v.x-item.x,dy=v.y-item.y,c=Math.cos(angle),s=Math.sin(angle);
      const local:V3=[(c*dx+s*dy)/pose.sx,(-s*dx+c*dy)/pose.sy,0];
      maxMatterVertexProjectionError=Math.max(maxMatterVertexProjectionError,distance(projectLocal(item,local),projectWorld(v.x,v.y)));
    }
    rows.push({kind,angle,bodyX:entity.body.position.x,bodyY:entity.body.position.y,
      stateCenterError:distance(item,entity.body.position),stateAngleError:Math.abs(item.angle-entity.body.angle),
      modelAnchorError:Math.hypot(anchor[0]-item.x,anchor[1]-item.y),
      anchorScreenError:distance(anchorScreen,projectWorld(item.x,item.y)),
      widthError:dim.w*pose.sx-item.key.wCells*CELL,heightError:dim.h*pose.sy-item.key.hCells*CELL,
      rotationError:Math.abs(Math.atan2(Math.sin(measuredAngle-angle),Math.cos(measuredAngle-angle))),maxMathError,maxMatterVertexProjectionError,
      anchorScreen,physicalCenterScreen:projectWorld(item.x,item.y),points});
  }
  sim.destroy();
  const contacts=DEVICE_KINDS.flatMap(kind=>ANGLES.slice(0,6).map(angle=>{
    const lower=makeItem(kind),h=lower.key.hCells*CELL,w=lower.key.wCells*CELL,c=Math.cos(angle),s=Math.sin(angle);
    lower.angle=angle;
    const upper=makeItem(kind,lower.x+s*h,lower.y-c*h,angle);
    const left=makeItem(kind,lower.x-c*w,lower.y-s*w,angle);
    const d=modelDimensions(lower);
    const a=projectLocal(lower,[0,-d.h/2,0]),b=projectLocal(upper,[0,d.h/2,0]);
    const l=projectLocal(lower,[-d.w/2,0,0]),r=projectLocal(left,[d.w/2,0,0]);
    return {kind,angle,physicalContactError:distance(projectWorld(lower.x+s*h/2,lower.y-c*h/2),projectWorld(upper.x-s*h/2,upper.y+c*h/2)),
      verticalSilhouetteGap:distance(a,b),horizontalSilhouetteGap:distance(l,r),lowerTop:a,upperBottom:b};
  }));
  const settled=[];
  for(const kind of DEVICE_KINDS)for(let q=0;q<4;q++) {
    const sim=new GameSim({}, {seed:42,autoSpawn:false,randomEvents:false}),e=sim.placeLocked(kind,4,1,q);
    for(let i=0;i<300;i++)sim.step();
    const item=sim.renderState().items[0]!,maxVertexY=Math.max(...e.body.vertices.map(v=>v.y));
    settled.push({kind,q,x:item.x,y:item.y,angle:item.angle,steps:sim.stepCount,centerError:distance(item,e.body.position),angleError:item.angle-e.body.angle,
      floorPenetration:maxVertexY-FIELD_H,broadPhasePadding:e.body.bounds.max.y-maxVertexY});sim.destroy();
  }
  return {rows,contacts,settled,maxStateCenterError:Math.max(...rows.map(r=>r.stateCenterError)),maxStateAngleError:Math.max(...rows.map(r=>r.stateAngleError)),
    maxRotationError:Math.max(...rows.map(r=>r.rotationError)),maxProjectionMathError:Math.max(...rows.map(r=>r.maxMathError)),
    maxMatterVertexProjectionError:Math.max(...rows.map(r=>r.maxMatterVertexProjectionError)),
    maxModelAnchorError:Math.max(...rows.map(r=>r.modelAnchorError)),maxContactGap:Math.max(...contacts.map(r=>Math.max(r.verticalSilhouetteGap,r.horizontalSilhouetteGap)))};
}

/** Real Matter bodies, frozen at one engine timestamp; no gameplay mutation. */
export function scene(name:string) {
  const sim=new GameSim({}, {seed:42,autoSpawn:false,randomEvents:false});
  const add=(kind:DeviceKind,x:number,y:number,angle=0)=>{const e=sim.placeLocked(kind,0,0);Matter.Body.setPosition(e.body,{x,y});Matter.Body.setAngle(e.body,angle);return e;};
  if(name==='normal') {
    add('miniM1',45,FIELD_H-18+.02);add('miniM2',45,FIELD_H-54+.04);add('miniM4',109,FIELD_H-18+.02);
    add('studio',191,FIELD_H-36+.02);add('pro',290,FIELD_H-72+.02);add('macPro2013',180,440);
  } else if(name==='tilted') {
    DEVICE_KINDS.forEach((kind,i)=>add(kind,80+(i%2)*170,140+Math.floor(i/2)*175,[Math.PI/2,Math.PI,3*Math.PI/2,-.41,.33,Math.PI/2][i]!));
  } else if(name==='separated') {
    add('pro',100,470);add('miniM2',180,375);
  } else {
    add('pro',70,FIELD_H-72+.02);add('macPro2013',145,FIELD_H-54+.02);add('studio',245,FIELD_H-36+.02);
    add('miniM1',220,FIELD_H-90+.04);add('miniM2',220,FIELD_H-126+.06);add('miniM4',282,FIELD_H-90+.04);
    add('studio',100,440,-.2);add('pro',230,350,Math.PI/2);add('macPro2013',80,260,Math.PI/2);
  }
  // Matter collision detection updates actual pair contacts without advancing the
  // simulation or resolving the carefully specified measurement fixture.
  const bodies=[...sim.entities.values()].map(e=>e.body),all=[...bodies,...sim.world.walls];
  const collisions=Matter.Detector.collisions(Matter.Detector.create({bodies:all}));
  const contacts=collisions.filter(c=>bodies.includes(c.bodyA)||bodies.includes(c.bodyB)).flatMap(c=>c.supports.filter((p):p is Matter.Vector=>!!p).map(p=>({x:p.x,y:p.y,a:c.bodyA.label,b:c.bodyB.label,penetration:c.depth})));
  const state=sim.renderState();
  return {sim,state,bodies:bodies.map(b=>({x:b.position.x,y:b.position.y,angle:b.angle,vertices:b.vertices.map(v=>({x:v.x,y:v.y}))})),contacts,timestamp:sim.engine.timing.timestamp};
}

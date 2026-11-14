import Matter from 'matter-js';
import { GameSim } from '../../src/game/engine/GameSim';
import { Renderer } from '../../src/game/rendering/renderer';
import { ObliqueRenderer } from '../../src/game/rendering/obliqueRenderer';
import { FrameViews } from '../../src/game/rendering/frameViews';
import { realSize,REAL_MM,REAL_PX_PER_MM } from '../../src/data/gameModes';
import { DEVICE_KINDS,type DeviceKind } from '../../src/data/devices';
import { modelDimensions } from '../../src/game/rendering/chassisMesh';
import { chassisPose } from '../../src/game/rendering/chassisProjection';
import { gpuProbe } from '../sync/gpuProbe';
import { depthAudit } from '../sync/depthAudit';
import { REAL_BOARD,REAL_VIEW } from '../../src/game/board';
const FIELD_H=REAL_BOARD.height;
const contacts: {kind:string;angle:number;floorErrorPx:number}[]=[];
for(const kind of DEVICE_KINDS)for(const q of [0,1]){
  const test=new GameSim({}, {mode:'real',autoSpawn:false,randomEvents:false});
  const body=test.placeLocked(kind,3,5,q).body;
  for(let i=0;i<600;i++)test.step();
  contacts.push({kind,angle:q*Math.PI/2,floorErrorPx:Math.max(...body.vertices.map(v=>v.y))-FIELD_H});test.destroy();
}
const stack=new GameSim({}, {mode:'real',autoSpawn:false,randomEvents:false});
const lower=stack.placeLocked('miniM2',3,17),upper=stack.placeLocked('miniM2',3,16);
for(let i=0;i<700;i++)stack.step();
const miniStackGapPx=lower.body.position.y-upper.body.position.y-realSize('miniM2').h;
stack.destroy();
const name=new URLSearchParams(location.search).get('scene')??'models';
const sim=new GameSim({}, {mode:'real',seed:42,autoSpawn:false,randomEvents:false});
const add=(kind:DeviceKind,x:number,y:number,angle=0)=>{const e=sim.placeLocked(kind,0,0);Matter.Body.setPosition(e.body,{x,y});Matter.Body.setAngle(e.body,angle);return e;};
if(name==='models'||name==='rotated'){
  DEVICE_KINDS.forEach((kind,i)=>{const points=[[80,180],[250,180],[440,180],[80,420],[250,650],[440,720]];
    add(kind,points[i]![0]!,points[i]![1]!,name==='rotated'?[Math.PI/2,Math.PI,3*Math.PI/2,-.33,Math.PI/2,.4][i]!:0);});
}else if(name==='dense'){
  add('macPro2013',65,850);add('miniM4',65,720);add('studio',205,870);add('studio',205,820);add('miniM1',205,770);add('miniM2',205,730);for(let i=0;i<3;i++)add('pro',380,900-realSize('pro').h*(i+.5));add('miniM4',380,300);
  for(let i=0;i<700;i++)sim.step();
}else{
  add('pro',440,810,.33);add('studio',75,870);add('macPro2013',285,820);add('miniM4',75,810);add('miniM1',130,840);add('miniM2',230,880);
  sim.checkRows([22,24]);if(name==='cleared-settled')for(let i=0;i<500;i++)sim.step();
}
const state=sim.renderState(),front=new Renderer(document.querySelector('#front')!,REAL_BOARD);front.resize(540,900,2);
const side=new ObliqueRenderer(document.querySelector('#side')!,front.sprites,REAL_BOARD);side.resize(600,1000,2);
const views=new FrameViews(front);views.attach(side);const snapshot=JSON.stringify(state);views.draw(state);
if(snapshot!==JSON.stringify(state)||side.lastState!==state)throw Error('Shared state mismatch');
const depth=depthAudit(state.items,REAL_VIEW),gpu=gpuProbe('real');
const first=document.querySelector<HTMLCanvasElement>('#side')!.toDataURL();side.draw({...state,items:[...state.items].reverse()});const orderIndependent=first===document.querySelector<HTMLCanvasElement>('#side')!.toDataURL();side.draw(state);
const dimensions=DEVICE_KINDS.map(kind=>{const d=realSize(kind),mm=REAL_MM[kind];return {kind,mm,width:d.w,height:d.h,depth:d.depth,scale:REAL_PX_PER_MM};});
const centers=state.items.map(item=>({kind:item.key.kind,x:item.x,y:item.y,angle:item.angle,pose:chassisPose(item),dimensions:modelDimensions(item),fragment:!!item.key.geometry}));
const score=sim.score(),ledgerError=Math.abs(score.spent-score.cleared-score.fieldValue);
document.querySelector('#summary')!.textContent=`${name} / ${state.items.length} bodies / ${state.items.filter(i=>i.key.geometry).length} fragments / depth ${depth.samples} samples, ${depth.mismatches} mismatches / GPU ${gpu.maxError.toExponential(3)}px / escaped ${sim.escaped}`;
Object.assign(window,{realValidation:{name,dimensions,board:REAL_BOARD,viewport:REAL_VIEW,centers,contacts,miniStackGapPx,score,ledgerError,depth,gpu,orderIndependent,escaped:sim.escaped,sameFrame:true,state}});
sim.destroy();

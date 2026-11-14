import Matter from 'matter-js';
import { GameSim } from '../../src/game/engine/GameSim';
import { ChassisRenderer } from '../../src/game/rendering/chassisRenderer';
import { modelDimensions } from '../../src/game/rendering/chassisMesh';
import { projectWorld } from '../../src/game/rendering/chassisProjection';
import { surfacePair,auditSurfaces } from './audit';
import type { DeviceKind } from '../../src/data/devices';

const renderer=new ChassisRenderer(),results=[];
for(const kind of ['miniM1','miniM2','miniM4'] as DeviceKind[]) {
  const sim=new GameSim({}, {seed:42,autoSpawn:false,randomEvents:false});
  const lower=sim.placeLocked(kind,3,17),upper=sim.placeLocked(kind,3,16);
  Matter.Body.setPosition(lower.body,{x:160,y:630});Matter.Body.setPosition(upper.body,{x:160,y:594});
  const state=sim.renderState(),before=JSON.stringify(state),d=modelDimensions(state.items[0]!);
  const audit=auditSurfaces(),pair=audit.pairs.find(p=>p.lowerKind===kind&&p.upperKind===kind&&p.angle===0)!;
  // Read the actual current transform, including the legacy transform when
  // the capture script temporarily restores the old fitting policy.
  const actual=surfacePair(kind,kind,0);
  const full=document.createElement('canvas');full.width=1200;full.height=2112;
  const ctx=full.getContext('2d')!;ctx.scale(3,3);ctx.fillStyle='#111620';ctx.fillRect(0,0,400,704);
  const corners=[[100,648,0],[220,648,0],[220,648,d.depth],[100,648,d.depth]].map(p=>projectWorld(p[0]!,p[1]!,p[2]!));
  ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#223146';ctx.fill();ctx.strokeStyle='#638ba8';ctx.lineWidth=.6;ctx.stroke();
  ctx.drawImage(renderer.draw(state.items,1200,2112),0,0,400,704);
  ctx.lineWidth=1;ctx.strokeStyle=actual.worldGap<1e-8?'#71f6ac':'#ff6c7c';
  ctx.beginPath();ctx.moveTo(actual.screenLower.x,actual.screenLower.y);ctx.lineTo(actual.screenUpper.x,actual.screenUpper.y);ctx.stroke();
  ctx.fillStyle=ctx.strokeStyle;
  for(const p of [actual.screenLower,actual.screenUpper]) {ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,Math.PI*2);ctx.fill();}
  const section=document.createElement('section'),canvas=document.createElement('canvas');canvas.width=960;canvas.height=864;
  canvas.getContext('2d')!.drawImage(full,100*3,525*3,160*3,144*3,0,0,960,864);
  section.innerHTML=`<h2>${kind}</h2>`;section.append(canvas);
  const text=document.createElement('p');text.textContent=`Surface gap: ${actual.worldGap.toFixed(9)} px; projected gap: ${actual.screenGap.toFixed(9)} px; depth: ${d.depth.toFixed(6)} px`;section.append(text);document.querySelector('main')!.append(section);
  if(JSON.stringify(state)!==before)throw Error('Renderer mutated Matter snapshot');
  results.push({kind,actual,depth:d.depth,snapshot:state,reference:pair});sim.destroy();
}
Object.assign(window,{surfaceAudit:{results,audit:auditSurfaces()}});

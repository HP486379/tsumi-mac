import { scene, auditAll } from './audit';
import { gpuProbe } from './gpuProbe';
import { depthAudit } from './depthAudit';
import { makeItem } from './audit';
import { Renderer } from '../../src/game/rendering/renderer';
import { ObliqueRenderer } from '../../src/game/rendering/obliqueRenderer';
import { projectWorld, chassisPose } from '../../src/game/rendering/chassisProjection';
import { FIELD_H, FIELD_W } from '../../src/game/config';

const name=new URLSearchParams(location.search).get('scene')||'normal';
const fixture=scene(name),{state}=fixture;
const front=document.querySelector<HTMLCanvasElement>('#front')!,side=document.querySelector<HTMLCanvasElement>('#side')!;
const renderer=new Renderer(front);renderer.resize(360,648,2);
const oblique=new ObliqueRenderer(side,renderer.sprites);oblique.resize(400,704,2);
const before=JSON.stringify(state);renderer.draw(state);oblique.draw(state);
if(JSON.stringify(state)!==before)throw Error('Renderer mutated snapshot');
function overlay(canvas:HTMLCanvasElement,isSide:boolean) {
  canvas.width=(isSide?400:360)*2;canvas.height=(isSide?704:648)*2;
  const ctx=canvas.getContext('2d')!;ctx.scale(2,2);
  const at=(x:number,y:number)=>isSide?projectWorld(x,y):{x,y};
  const line=(a:{x:number;y:number},b:{x:number;y:number},color:string)=>{const p=at(a.x,a.y),q=at(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();};
  const dot=(x:number,y:number,color:string)=>{const p=at(x,y);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,2.7,0,Math.PI*2);ctx.fill();};
  for(const b of fixture.bodies) {
    b.vertices.forEach((v,i)=>line(v,b.vertices[(i+1)%b.vertices.length]!,'#1fffee'));
    dot(b.x,b.y,'#ffe066');line(b,{x:b.x+18*Math.cos(b.angle),y:b.y+18*Math.sin(b.angle)},'#ffe066');
  }
  for(const item of state.items){const pose=chassisPose(item);dot(pose.x,pose.y,'#ff6bff');line(pose,{x:pose.x-18*Math.sin(pose.angle),y:pose.y+18*Math.cos(pose.angle)},'#ff6bff');}
  for(const p of fixture.contacts)dot(p.x,p.y,'#ff395e');
  line({x:0,y:FIELD_H},{x:FIELD_W,y:FIELD_H},'#1fffee');
}
overlay(document.querySelector('#front-overlay')!,false);overlay(document.querySelector('#side-overlay')!,true);
const gpu=gpuProbe(),audit=auditAll(),depth=depthAudit(state.items);
// Disjoint Matter rectangles: diagonal clearance of 8px horizontally and 5px
// vertically. Their finite-depth images can legitimately overlap.
const separatedDepth=depthAudit([makeItem('pro',100,470),makeItem('miniM2',180,375)]);
const pixels=()=>side.toDataURL();const original=pixels();oblique.draw({...state,items:[...state.items].reverse()});const orderIndependent=original===pixels();
oblique.draw(state);
document.querySelector('#summary')!.textContent=`${name} / Matter timestamp ${fixture.timestamp} / ${state.items.length} devices / ${fixture.contacts.length} supports / shader max error ${gpu.maxError.toExponential(3)} px`;
Object.assign(window,{syncAudit:{scene:name,state,bodies:fixture.bodies,contacts:fixture.contacts,timestamp:fixture.timestamp,audit,gpu,depth,separatedDepth,orderIndependent,sourceUnchanged:before===JSON.stringify(state),sameSnapshot:oblique.lastState===state}});
fixture.sim.destroy();

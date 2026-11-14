import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { watchErrors } from './helpers';

for(const mode of ['classic','real','count'] as const)for(const software of [false,true])test(`${mode} 4px input and vertical mini channels (${software?'Canvas':'WebGL'})`,async({page,isMobile},info)=>{
 const errors=watchErrors(page),measurements=[];
 if(software)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl'||type==='webgl2'?null:Reflect.apply(get,this,[type,...args]);} as typeof get;});
 await page.goto('/?seed=42');await page.getByTestId(mode==='classic'?'start-button':mode==='real'?'real-start-button':'count-start-button').click();
 if(isMobile)await page.getByTestId('oblique-panel').locator('summary').tap();
 await page.getByTestId('oblique-panel').locator('summary').evaluate(e=>(e as HTMLElement).blur());
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
 const press=async(action:'left'|'right'|'rotate')=>{if(isMobile)await page.getByTestId('touch-'+action).tap();else await page.keyboard.press(action==='left'?'ArrowLeft':action==='right'?'ArrowRight':'KeyX');};
 const x0=await page.evaluate(()=>window.__tsumimac!.state().activeX!);
 await press('left');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeCloseTo(x0-4,6);
 await press('right');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeCloseTo(x0,6);
 const left=page.getByTestId('touch-left'),event={pointerId:7,pointerType:'touch',bubbles:true};
 if(isMobile)await left.dispatchEvent('pointerdown',event);else await page.keyboard.down('ArrowLeft');
 await page.waitForTimeout(260);
 if(isMobile)await left.dispatchEvent('pointerup',event);else await page.keyboard.up('ArrowLeft');
 const held=await page.evaluate(()=>window.__tsumimac!.state().activeX!);expect(x0-held).toBeGreaterThanOrEqual(8);expect((x0-held)/4).toBeCloseTo(Math.round((x0-held)/4),6);
 await page.waitForTimeout(80);expect(await page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeCloseTo(held,6);
 for(let n=0;n<100;n++){
  const x=await page.evaluate(()=>window.__tsumimac!.state().activeX!);if(Math.abs(x-x0)<.1)break;
  await press(x<x0?'right':'left');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeCloseTo(x+(x<x0?4:-4),6);
 }
 const target=x0+8;
 const fixture=async(gap:number)=>page.evaluate(({target,gap})=>{
  const d=window.__tsumimac!,b=d.state().board,w=b.width===540?218*72/197:72,h=b.width===540?529*72/197:144,L=target-gap/2,R=target+gap/2;
  const old=new Set(d.bodies().map(p=>p.id));d.placeLocked('pro',(L-w)/36,(b.height-h)/36);d.placeLocked('pro',R/36,(b.height-h)/36);
  for(const e of d.bodies())if(!old.has(e.id))d.setBody(e.id,{static:true});return {L,R,width:gap,top:b.height-h,floor:b.height};
 },{target,gap});
 await page.keyboard.press('KeyP');const channel=await fixture(18);await page.evaluate(()=>window.__tsumimac!.forceNext('miniM1'));await page.getByTestId('resume-button').click();
 const style='[data-testid="pause-overlay"]{visibility:hidden!important}';
 for(const kind of ['miniM2','miniM1']){
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().active)).toBe(kind);
  await press('rotate');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().q)).toBe(1);
  const before=await page.evaluate(()=>window.__tsumimac!.state().activeX!);await press('right');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeCloseTo(before+4,6);await press('right');
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeCloseTo(target,6);
  const id=await page.evaluate(()=>window.__tsumimac!.bodies().find(p=>p.state==='falling')!.id);
  // Classic/real have the existing keyboard hard drop; count also has its touch button.
  if(isMobile&&mode==='count')await page.getByTestId('touch-hard').tap();else await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(id=>window.__tsumimac!.bodies().find(p=>p.id===id)?.state,id),{timeout:12000}).toBe('locked');
  await page.keyboard.press('KeyP');
  const views=await page.evaluate(()=>window.__tsumimac!.views());expect(views.front).toEqual(views.oblique);
  const p=views.front!.items.find(p=>p.key.kind===kind&&!p.active)!,width=p.key.hCells*36;
  expect(p.x-width/2).toBeGreaterThan(channel.L);expect(p.x+width/2).toBeLessThan(channel.R);
  const expectedBottom=channel.floor-(kind==='miniM1'?72:0);expect(Math.abs(p.y+36-expectedBottom)).toBeLessThan(.3);
  measurements.push({kind,channel,x:p.x,y:p.y,angle:p.angle,width,leftClearance:p.x-width/2-channel.L,rightClearance:channel.R-p.x-width/2,floorError:p.y+36-expectedBottom,synchronized:views.synchronized});
  await page.screenshot({path:info.outputPath('gap18-'+kind+'.png'),fullPage:true,style});
  await page.getByTestId('resume-button').click();
 }
 if(mode==='count')expect(await page.evaluate(()=>window.__tsumimac!.state().count!.current)).toBe(4);
 await page.keyboard.press('KeyP');await page.getByTestId('pause-restart').click();await page.keyboard.press('KeyP');
 const narrow=await fixture(12);await page.getByTestId('resume-button').click();await press('rotate');await press('right');await press('right');
 await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.bodies().filter(b=>b.kind==='miniM2'&&b.state==='locked').length),{timeout:12000}).toBe(1);
 await page.keyboard.press('KeyP');const p=await page.evaluate(()=>window.__tsumimac!.views().front!.items.find(p=>p.key.kind==='miniM2'&&!p.active)!);expect(p.y+36).toBeLessThan(narrow.floor-100);
 await page.screenshot({path:info.outputPath('gap12-blocked.png'),fullPage:true,style});
 await writeFile(info.outputPath('measurements.json'),JSON.stringify({mode,software,isMobile,x0,held,measurements,narrow:{...narrow,x:p.x,y:p.y,angle:p.angle,bottom:p.y+36},errors},null,2));
 expect(errors).toEqual([]);
});

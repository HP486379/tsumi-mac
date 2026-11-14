import { expect, test } from '@playwright/test';
import { startGame, watchErrors } from './helpers';

for(const software of [false,true]) test(`solid view survives repeated toggles (${software?'Canvas fallback':'WebGL'})`,async({page,isMobile},testInfo)=>{
  test.skip(isMobile,'Desktop diagnostic');
  const errors=watchErrors(page);
  await page.addInitScript(forceSoftware=>{
    const get=HTMLCanvasElement.prototype.getContext;
    const contexts=new Set<HTMLCanvasElement>();
    Object.assign(window,{__chassisContexts:contexts});
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]) {
      if(type==='webgl'||type==='webgl2') {
        if(forceSoftware)return null;
        contexts.add(this);
      }
      return Reflect.apply(get,this,[type,...args]);
    } as typeof get;
  },software);
  await startGame(page);await page.keyboard.press('KeyP');
  const before=await page.evaluate(()=>window.__tsumimac!.state());
  for(let i=0;i<18;i++) {
    await page.evaluate(()=>{document.querySelector<HTMLDetailsElement>('.oblique-panel')!.open=false;});
    await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().oblique)).toBeNull();
    await page.evaluate(()=>{document.querySelector<HTMLDetailsElement>('.oblique-panel')!.open=true;});
    await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
  }
  expect(await page.evaluate(()=>window.__tsumimac!.state().steps)).toBe(before.steps);
  expect(await page.evaluate(()=>Reflect.get(window,'__chassisContexts').size)).toBe(software?0:1);
  await page.getByTestId('oblique-canvas').screenshot({path:testInfo.outputPath('reopened-solid.png')});
  expect(errors).toEqual([]);
});

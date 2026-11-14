import { test,expect } from '@playwright/test';
import { watchErrors } from './helpers';

for(const fallback of [false,true])test(`540x900 fits, stacks full Pro towers and synchronizes both views (${fallback?'Canvas':'WebGL'})`,async({page,isMobile},info)=>{
 const errors=watchErrors(page);
 if(fallback)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl'?null:Reflect.apply(get,this,[type,...args]);} as typeof get;});
 await page.goto('/?seed=20261028');await page.getByTestId('real-start-button').click();
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().board)).toEqual({width:540,height:900,cols:15,rows:25,cell:36,dangerY:72});
 const panel=page.getByTestId('oblique-panel');if(isMobile)await panel.locator('summary').tap();
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
 await page.keyboard.press('KeyP');await page.addStyleTag({content:'[data-testid="pause-overlay"],.toasts{visibility:hidden!important}'});
 await page.evaluate(()=>{const d=window.__tsumimac!,h=529*72/197;for(let i=0;i<3;i++)d.placeLocked('pro',10,(900-h*(i+1))/36);d.placeLocked('miniM1',0,24.63);d.placeLocked('miniM2',0,24.26);d.placeLocked('miniM4',3,24.49);d.placeLocked('macPro2013',5,22.45,1);});
 // Resize re-renders a frozen fixture through the actual two production sinks.
 const v=page.viewportSize()!;await page.setViewportSize({...v,height:v.height-101});
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().front?.items.filter(i=>i.key.kind==='pro').length)).toBe(3);
 const pair=await page.evaluate(()=>window.__tsumimac!.views());expect(pair.front).toEqual(pair.oblique);
 const canvas=await page.getByTestId('game-canvas').boundingBox();expect(canvas).not.toBeNull();
 expect(canvas!.width/canvas!.height).toBeCloseTo(.6,2);expect(canvas!.x).toBeGreaterThanOrEqual(0);expect(canvas!.y).toBeGreaterThanOrEqual(0);expect(canvas!.x+canvas!.width).toBeLessThanOrEqual(v.width);expect(canvas!.y+canvas!.height).toBeLessThanOrEqual(v.height);
 if(isMobile)await expect(page.getByTestId('touch-left')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('540x900-full-board.png')});
 const cleared=await page.evaluate(()=>window.__tsumimac!.clearRows([24]));expect(cleared).toBe(1);
 await page.setViewportSize(v);await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().front?.items.some(i=>i.key.geometry))).toBe(true);
 const cut=await page.evaluate(()=>window.__tsumimac!.views());expect(cut.front).toEqual(cut.oblique);
 await page.screenshot({path:info.outputPath('540x900-bottom-row-cut.png')});expect(errors).toEqual([]);
 if(isMobile){
  await page.setViewportSize({width:851,height:393});
  await expect(page.getByTestId('touch-left')).toBeInViewport();await expect(page.getByTestId('touch-right')).toBeInViewport();
  const landscape=await page.getByTestId('game-canvas').boundingBox();expect(landscape!.y+landscape!.height).toBeLessThanOrEqual(393);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('540x900-mobile-landscape.png')});
 }
});

test('540x900 ends above the danger line, saves a separate result and retries the same board',async({page})=>{
 const errors=watchErrors(page),old=JSON.stringify({bestSpent:99999999,plays:8}),classic=JSON.stringify({bestSpent:765432,plays:2});
 await page.addInitScript(({old,classic})=>{localStorage.setItem('tsumimac.highscore.v1.real',old);localStorage.setItem('tsumimac.highscore.v1',classic);},{old,classic});
 await page.goto('/?seed=20261028');await page.getByTestId('real-start-button').click();
 await page.evaluate(()=>{const d=window.__tsumimac!,h=529*72/197;for(let i=0;i<5;i++)d.placeLocked('pro',0,(900-h*(i+1))/36);d.setTimeScale(8);});
 await expect(page.getByTestId('result-screen')).toBeVisible({timeout:15000});
 await expect(page.getByTestId('result-mode')).toContainText('540×900');
 expect(await page.evaluate(()=>localStorage.getItem('tsumimac.highscore.v1.real'))).toBe(old);
 expect(await page.evaluate(()=>localStorage.getItem('tsumimac.highscore.v1'))).toBe(classic);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tsumimac.highscore.v1.real.540x900.v1')!).plays)).toBe(1);
 await page.getByTestId('retry-button').click();await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().board.height)).toBe(900);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('KeyX');await page.keyboard.press('Space');
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().score.devices),{timeout:12000}).toBeGreaterThan(1);
 expect(errors).toEqual([]);
});

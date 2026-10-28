import { test,expect } from '@playwright/test';
import { watchErrors } from './helpers';
for(const fallback of [false,true])test(`classic M4 preserves contacts and shared frames (${fallback?'Canvas':'WebGL'})`,async({page,isMobile},info)=>{
 const errors=watchErrors(page);if(fallback)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl'?null:Reflect.apply(get,this,[type,...args]);} as typeof get;});
 await page.goto('/?seed=20261029');await page.getByTestId('start-button').click();if(isMobile)await page.getByTestId('oblique-panel').locator('summary').tap();
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);await page.keyboard.press('KeyP');
 await page.evaluate(()=>{window.__tsumimac!.placeLocked('miniM4',4,17);window.__tsumimac!.placeLocked('miniM4',4,16);});
 await page.getByTestId('resume-button').click();await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().front!.items.filter(i=>i.key.kind==='miniM4').length)).toBeGreaterThanOrEqual(2);await page.keyboard.press('KeyP');
 const views=await page.evaluate(()=>window.__tsumimac!.views());expect(views.front).toEqual(views.oblique);expect(views.synchronized).toBe(true);
 const fixed=views.front!.items.filter(i=>i.key.kind==='miniM4'&&!i.active).sort((a,b)=>a.y-b.y);expect(fixed).toHaveLength(2);for(const p of fixed){expect(p.key.wCells).toBe(1);expect(p.key.hCells).toBe(1);}expect(Math.abs(fixed[1]!.y-fixed[0]!.y-36)).toBeLessThan(.2);
 await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:hidden!important}'});await page.screenshot({path:info.outputPath('classic-m4-game.png')});expect(errors).toEqual([]);
});

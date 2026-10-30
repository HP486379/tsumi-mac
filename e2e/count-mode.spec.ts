import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { watchErrors } from './helpers';
import type { EngineDebugApi } from '../src/game/engine/GameEngine';
type Capture={state:ReturnType<EngineDebugApi['state']>;bodies:ReturnType<EngineDebugApi['bodies']>;views:ReturnType<EngineDebugApi['views']>};

for(const software of [false,true])test(`count challenge plays through collapse and preserves records (${software?'Canvas':'WebGL'})`,async({page,isMobile},info)=>{
 test.setTimeout(150000);
 const errors=watchErrors(page),legacy=['tsumimac.highscore.v1','tsumimac.highscore.v1.real.540x900.v1'];
 if(software)await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl'||type==='webgl2'?null:Reflect.apply(original,this,[type,...args]);} as typeof original;});
 await page.addInitScript(keys=>{for(const key of keys)localStorage.setItem(key,'{"bestSpent":7654321,"plays":8}');localStorage.setItem('tsumimac.settings.v1','{"se":false,"bgm":false}');},legacy);
 await page.goto('/?seed=42');await expect(page.locator('.menu button')).toHaveText(['テトリスモード','実寸モード','最多積載台数チャレンジ','遊び方']);
 await page.screenshot({path:info.outputPath('three-mode-title.png'),fullPage:true});await page.getByTestId('count-start-button').click();
 await expect(page.getByTestId('game-screen')).toHaveAttribute('data-mode','count');
 if(isMobile)await page.getByTestId('oblique-panel').locator('summary').tap();
 await page.getByTestId('oblique-panel').locator('summary').evaluate(el=>(el as HTMLElement).blur());
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
 expect(await page.evaluate(()=>window.__tsumimac!.state().count!.current)).toBe(0);
 await page.evaluate(()=>window.__tsumimac!.setTimeScale(2));
 const history:Capture[]=[],columns=[1,6,0,7,3,1,6,2,7,0];let collapse=false;
 for(let i=0;i<columns.length;i++){
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeState)).toBe('falling');
  if(i%3===1){if(isMobile)await page.getByTestId('touch-rotate').tap();else await page.keyboard.press('KeyX');}
  const target=36+columns[i]!*36;
  for(let n=0;n<6;n++){
   const x=await page.evaluate(()=>window.__tsumimac!.state().activeX!);if(Math.abs(x-target)<20)break;
   if(isMobile)await page.getByTestId(x>target?'touch-left':'touch-right').tap();else await page.keyboard.press(x>target?'ArrowLeft':'ArrowRight');
   await page.waitForTimeout(35);
  }
  const previous=await page.evaluate(()=>window.__tsumimac!.state().count!.current);
  if(isMobile){await expect(page.getByTestId('touch-hard')).toBeInViewport();await page.getByTestId('touch-hard').tap();}else await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().count!.current),{timeout:20000}).toBeGreaterThan(previous);
  const snapshot=await page.evaluate(()=>({state:window.__tsumimac!.state(),bodies:window.__tsumimac!.bodies(),views:window.__tsumimac!.views()}));
  expect(snapshot.state.status).toBe('running');expect(snapshot.state.score.lines).toBe(0);expect(snapshot.views.front).toEqual(snapshot.views.oblique);
  const before=history.at(-1);
  if(!collapse&&before&&snapshot.bodies.some(b=>{const old=before.bodies.find(p=>p.id===b.id&&p.state==='locked');return old&&(Math.abs(old.angle-b.angle)>.15||Math.hypot(old.x-b.x,old.y-b.y)>24);})){collapse=true;await page.keyboard.press('KeyP');await page.screenshot({path:info.outputPath('collapse-continued.png'),fullPage:true,style:'[data-testid="pause-overlay"]{visibility:hidden!important}'});await page.getByTestId('resume-button').click();}
  history.push(snapshot);
 }
 await page.keyboard.press('KeyP');
 const final=await page.evaluate(()=>({state:window.__tsumimac!.state(),bodies:window.__tsumimac!.bodies(),views:window.__tsumimac!.views()}));history.push(final);
 const finalCurrent=final.state.count!.current,finalPeak=final.state.count!.peak;
 await page.screenshot({path:info.outputPath('count-play.png'),fullPage:true,style:'[data-testid="pause-overlay"]{visibility:hidden!important}'});
 expect(collapse,'Ordinary input must physically disturb an earlier fixed stack').toBe(true);
 expect(finalCurrent).toBeGreaterThanOrEqual(10);
 // Controlled off-board fixture separately verifies an otherwise closed board's exit path.
 const frozen=await page.evaluate(()=>window.__tsumimac!.state().steps);await page.waitForTimeout(80);expect(await page.evaluate(()=>window.__tsumimac!.state().steps)).toBe(frozen);
 const root=final.bodies.find(b=>b.state==='locked')!;
 await page.evaluate(id=>window.__tsumimac!.setBody(id,{x:-600,y:400}),root.id);await page.getByTestId('resume-button').click();
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().count!.current)).toBe(finalCurrent-1);
 expect(await page.evaluate(()=>window.__tsumimac!.state().count!.peak)).toBe(finalPeak);
 // Block all possible spawn footprints while physics continues; no immediate end.
 await page.keyboard.press('KeyP');await page.evaluate(()=>{
  const d=window.__tsumimac!,old=new Set(d.bodies().map(b=>b.id));for(let r=0;r<3;r++)for(let c=0;c<10;c+=2)d.placeLocked('miniM4',c,r);
  for(const b of d.bodies())if(!old.has(b.id))d.setBody(b.id,{static:true});
  for(const b of d.bodies())if(b.state!=='locked')d.setBody(b.id,{x:-600,y:400});
  d.setTimeScale(1);
 });
 await page.getByTestId('resume-button').click();
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().count!.blockedSeconds),{timeout:15000}).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.__tsumimac!.state().status)).toBe('running');
 await page.screenshot({path:info.outputPath('spawn-wait.png'),fullPage:true});
 await expect(page.getByTestId('count-result-screen')).toBeVisible({timeout:15000});
 await expect(page.getByTestId('count-result-peak')).not.toHaveText('0台');
 for(const key of legacy)expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{"bestSpent":7654321,"plays":8}');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tsumimac.max-stack-count.v1')!).best)).toBeGreaterThanOrEqual(10);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tsumimac.max-stack-count.v1')!).plays)).toBe(1);
 await page.getByTestId('count-retry').click();await expect(page.getByTestId('count-current')).toHaveText('0台');await expect(page.getByTestId('count-peak')).toHaveText('0台');
 await writeFile(info.outputPath('count-verification.json'),JSON.stringify({isMobile,software,collapse,history:history.map(({state,bodies})=>({state,bodies})),errors},null,2));
 expect(errors).toEqual([]);
});

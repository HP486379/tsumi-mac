import { test,expect } from '@playwright/test';
import { watchErrors } from './helpers';
import { writeFile } from 'node:fs/promises';
import type { TetrisDebug } from '../src/game/tetris/TetrisEngine';
declare global {interface Window {__tetris?:TetrisDebug}}
for(const fallback of [false,true])test(`Tetris plays, snaps, clears, chains and saves independently (${fallback?'Canvas':'WebGL'})`,async({page,isMobile},info)=>{
 const errors=watchErrors(page),legacy=['tsumimac.highscore.v1','tsumimac.highscore.v1.real','tsumimac.highscore.v1.real.540x900.v1'];
 await page.addInitScript(({legacy,fallback})=>{
  for(const key of legacy)localStorage.setItem(key,'{"bestSpent":987654,"plays":3}');
  if(fallback){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl'?null:Reflect.apply(get,this,[type,...args]);} as typeof get;}
 },{legacy,fallback});
 await page.goto('/?seed=20261028');await page.getByTestId('tetris-start-button').click();await expect(page.getByTestId('tetris-screen')).toBeVisible();
 const panel=page.getByTestId('tetris-panel');if(isMobile)await panel.locator('summary').tap();await expect.poll(()=>page.evaluate(()=>window.__tetris!.views().synchronized)).toBe(true);
 expect(await page.evaluate(()=>window.__tsumimac)).toBeUndefined();
 await page.getByTestId('tetris-grid').click();await expect(page.getByTestId('tetris-grid')).toHaveAttribute('aria-pressed','false');await page.getByTestId('tetris-grid').click();
 const x=await page.evaluate(()=>window.__tetris!.state().active!.x);if(isMobile)await page.getByTestId('tetris-left').tap();else await page.keyboard.press('ArrowLeft');
 await expect.poll(()=>page.evaluate(()=>window.__tetris!.state().active!.x)).toBeLessThan(x);
 if(isMobile){await page.getByTestId('tetris-rotateR').tap();await page.getByTestId('tetris-rotateL').tap();}else{await page.keyboard.press('KeyX');await page.keyboard.press('KeyZ');}
 await page.getByTestId('tetris-pause').click();await expect(page.getByTestId('pause-overlay')).toBeVisible();await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:hidden!important}'});
 // All six silhouettes, and both synchronized production canvases.
 await page.evaluate(()=>{const d=window.__tetris!,s=72/197;d.fixture([{kind:'miniM1',x:40,y:900-36*s/2},{kind:'miniM2',x:120,y:900-36*s/2},{kind:'miniM4',x:205,y:900-50*s/2},{kind:'studio',x:300,y:900-95*s/2},{kind:'pro',x:430,y:900-529*s/2},{kind:'macPro2013',x:70,y:700}],'miniM4');});
 const pair=await page.evaluate(()=>window.__tetris!.views());expect(pair.front).toEqual(pair.oblique);expect(pair.front!.ghost).toBeTruthy();
 const c=await page.getByTestId('tetris-front').boundingBox(),v=page.viewportSize()!;expect(c!.width/c!.height).toBeCloseTo(.6,2);expect(c!.x+c!.width).toBeLessThanOrEqual(v.width);expect(c!.y+c!.height).toBeLessThanOrEqual(v.height);
 if(isMobile){await expect(page.getByTestId('tetris-hard')).toBeInViewport();await expect(page.getByTestId('tetris-rotateL')).toBeInViewport();}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('play.png')});
 await page.evaluate(()=>window.__tetris!.fixture([{kind:'miniM1',x:36,y:900-36*72/197/2}],'miniM1',{x:112,y:700}));
 const ghost=await page.evaluate(()=>window.__tetris!.state().ghost!);expect(ghost.x).toBeCloseTo(108,7);await page.screenshot({path:info.outputPath('snap-before.png')});
 await page.keyboard.press('KeyP');if(isMobile)await page.getByTestId('tetris-hard').tap();else await page.keyboard.press('Space');await page.getByTestId('tetris-pause').click();
 const locked=await page.evaluate(()=>window.__tetris!.state().locked);expect(locked[1]!.x).toBeCloseTo(ghost.x,7);expect(locked[1]!.y).toBeCloseTo(ghost.y,7);await page.screenshot({path:info.outputPath('snap-after.png')});
 // A full 360px run, with an unrelated Mac in the remaining right-hand space.
 await page.evaluate(()=>{const h=36*72/197;window.__tetris!.fixture([...Array.from({length:5},(_,i)=>({kind:'miniM1' as const,x:36+72*i,y:900-h/2})),{kind:'studio',x:450,y:900-95*72/197/2}]);});
 await page.screenshot({path:info.outputPath('line-before.png')});expect(await page.evaluate(()=>window.__tetris!.resolve())).toBe(1);const cleared=await page.evaluate(()=>window.__tetris!.state());expect(cleared.lines).toBe(1);expect(cleared.locked).toHaveLength(1);expect(cleared.locked[0]!.x).toBe(450);await page.screenshot({path:info.outputPath('line-after.png')});
 // A partial line through a full-height Pro leaves real clipped fragments.
 await page.evaluate(()=>{const s=72/197;window.__tetris!.fixture([...Array.from({length:4},(_,i)=>({kind:'miniM1' as const,x:36+72*i,y:900-36*s/2})),{kind:'pro',x:288+218*s/2,y:900-529*s/2}]);window.__tetris!.resolve();});
 const fragments=await page.evaluate(()=>window.__tetris!.state());expect(fragments.locked.some(p=>p.geometry)).toBe(true);await page.screenshot({path:info.outputPath('fragments.png')});
 await page.evaluate(()=>{const h=36*72/197,row=(y:number,start:number,count:number)=>Array.from({length:count},(_,i)=>({kind:'miniM1' as const,x:36+72*(i+start),y}));window.__tetris!.fixture([...row(750,0,5),...row(900-h/2,0,3),...row(700,3,2)]);window.__tetris!.resolve();});
 const chain=await page.evaluate(()=>window.__tetris!.state());expect(chain.chain).toBe(2);await page.screenshot({path:info.outputPath('chain.png')});
 await writeFile(info.outputPath('verification.json'),JSON.stringify({isMobile,fallback,ghost,locked,cleared,fragments,chain,models:pair.front,synchronized:pair.synchronized,errors},null,2));
 // A blocked spawn completes the game and writes only the dedicated key.
 await page.evaluate(()=>window.__tetris!.fixture([{kind:'studio',x:270,y:95*72/197/2}],'miniM1'));
 await expect(page.getByTestId('tetris-result')).toBeVisible();for(const key of legacy)expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{"bestSpent":987654,"plays":3}');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tsumimac.tetris-snap.v1')!).plays)).toBe(1);
 await page.getByTestId('tetris-retry').click();await expect(page.getByTestId('tetris-result')).toHaveCount(0);expect(await page.evaluate(()=>window.__tetris!.state().over)).toBe(false);expect(errors).toEqual([]);
});

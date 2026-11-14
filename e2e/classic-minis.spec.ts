import { test,expect } from '@playwright/test';
import { watchErrors } from './helpers';

for(const fallback of [false,true]) {
 test(`classic mini stacks and fractional row clearing (${fallback?'Canvas':'WebGL'})`,async({page,isMobile},info)=>{
  const errors=watchErrors(page);
  if(fallback)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl'||type==='webgl2'?null:Reflect.apply(get,this,[type,...args]);} as typeof get;});
  await page.goto('/?seed=20261029');await page.getByTestId('start-button').click();
  if(isMobile)await page.getByTestId('oblique-panel').locator('summary').tap();
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
  await page.keyboard.press('KeyP');
  await page.evaluate(()=>{
   for(const [i,kind] of (['miniM1','miniM2','miniM4'] as const).entries()){
    const h=kind==='miniM4'?36:72*36/197;
    for(let n=0;n<3;n++)window.__tsumimac!.placeLocked(kind,.5+i*3,(648-(n+1)*h)/36);
   }
   window.__tsumimac!.setTimeScale(1);
  });
  const initial=await page.evaluate(()=>window.__tsumimac!.state().steps);
  await page.getByTestId('resume-button').click();
  await expect.poll(()=>page.evaluate(n=>window.__tsumimac!.state().steps-n,initial)).toBeGreaterThan(30);
  await page.keyboard.press('KeyP');
  const pair=await page.evaluate(()=>window.__tsumimac!.views());expect(pair.front).toEqual(pair.oblique);expect(pair.synchronized).toBe(true);
  const contacts=[];
  for(const kind of ['miniM1','miniM2','miniM4']){
   const fixed=pair.front!.items.filter(i=>i.key.kind===kind&&!i.active).sort((a,b)=>b.y-a.y),h=kind==='miniM4'?36:72*36/197;
   expect(fixed).toHaveLength(3);
   const gaps=[fixed[0]!.y+h/2-648,...fixed.slice(1).map((p,i)=>fixed[i]!.y-p.y-h)];
   for(const p of fixed){expect(p.key.wCells).toBe(2);expect(p.key.hCells*36).toBeCloseTo(h,8);expect(Math.abs(p.angle)).toBeLessThan(.01);}
   for(const gap of gaps)expect(Math.abs(gap)).toBeLessThan(.2);
   contacts.push({kind,height:h,gaps,centers:fixed.map(p=>({x:p.x,y:p.y,angle:p.angle}))});
  }
  expect(await page.evaluate(()=>window.__tsumimac!.state().escaped)).toBe(0);
  await info.attach('contacts.json',{body:JSON.stringify(contacts,null,2),contentType:'application/json'});
  const style='[data-testid="pause-overlay"]{visibility:hidden!important}';
  await page.screenshot({path:info.outputPath('three-mini-stacks.png'),fullPage:true,style});
  // New game: three thin layers cross the unchanged 36px row threshold.
  await page.getByTestId('pause-restart').click();await page.keyboard.press('KeyP');
  await page.evaluate(()=>{const d=window.__tsumimac!,h=72*36/197;d.setTimeScale(1);for(let layer=0;layer<2;layer++)for(let c=0;c<10;c+=2)d.placeLocked('miniM1',c,(648-(layer+1)*h)/36);});
  await page.getByTestId('resume-button').click();
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().front!.items.filter(p=>!p.active).length)).toBe(10);
  await page.keyboard.press('KeyP');expect(await page.evaluate(()=>window.__tsumimac!.state().score.lines)).toBe(0);
  await page.screenshot({path:info.outputPath('thin-row-before.png'),fullPage:true,style});
  await page.evaluate(()=>{const h=72*36/197;for(let c=0;c<10;c+=2)window.__tsumimac!.placeLocked('miniM1',c,(648-3*h)/36);});
  await page.getByTestId('resume-button').click();
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().score.lines)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().front!.items.filter(p=>!p.active&&p.key.geometry).length)).toBe(5);
  await page.waitForTimeout(500);await page.keyboard.press('KeyP');
  const cleared=await page.evaluate(()=>({state:window.__tsumimac!.state(),views:window.__tsumimac!.views()}));
  expect(cleared.views.front).toEqual(cleared.views.oblique);expect(cleared.state.escaped).toBe(0);
  expect(cleared.state.score.spent).toBeCloseTo(cleared.state.score.cleared+cleared.state.score.fieldValue,4);
  await page.screenshot({path:info.outputPath('thin-row-after.png'),fullPage:true,style});
  expect(errors).toEqual([]);
 });
}

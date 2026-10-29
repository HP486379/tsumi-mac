import { test,expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { watchErrors,buildWall } from './helpers';

/** Supply an archived record key to verify that removed/unknown features never
 * access or delete it. The application may only access the two scores/settings. */
const archivedKey=process.env.ARCHIVED_RECORD_KEY??'archived.game.record.v1';
const classicKey='tsumimac.highscore.v1',realKey=classicKey+'.real.540x900.v1',settingsKey='tsumimac.settings.v1';
declare global {interface Window {__storageAudit:{events:{op:string;key:string}[];dump:()=>Record<string,string|null>}}}

for(const mode of ['classic','real'] as const)test(`${mode} menu, controls and record isolation`,async({page,isMobile},info)=>{
 const errors=watchErrors(page),record=(plays:number)=>JSON.stringify({bestSpent:987654321,bestLines:10,bestCleared:1234,bestMaxCombo:3,plays});
 const initial={[classicKey]:record(8),[realKey]:record(11),[settingsKey]:'{"bgm":false,"se":false}',[archivedKey]:'{"bestScore":12345,"plays":7}'};
 await page.addInitScript(initial=>{
  for(const [key,value] of Object.entries(initial))localStorage.setItem(key,value);
  const get=Storage.prototype.getItem,events:{op:string;key:string}[]=[];
  window.__storageAudit={events,dump:()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,get.call(localStorage,k)]))};
  for(const op of ['getItem','setItem','removeItem','clear'] as const){const original=Storage.prototype[op];Storage.prototype[op]=function(this:Storage,...args:unknown[]){if(this===localStorage)events.push({op,key:String(args[0]??'*')});return Reflect.apply(original,this,args);} as typeof original;}
 },initial);
 await page.goto('/?seed=20261029');
 await expect(page.locator('.menu button')).toHaveText(['積みはじめる','実寸モードで積む','遊び方']);
 await page.screenshot({path:info.outputPath('title.png'),fullPage:true});
 await page.getByTestId(mode==='classic'?'start-button':'real-start-button').click();
 await expect(page.getByTestId('game-screen')).toHaveAttribute('data-mode',mode);
 const board=await page.evaluate(()=>window.__tsumimac!.state().board);expect([board.width,board.height]).toEqual(mode==='classic'?[360,648]:[540,900]);
 if(isMobile)await page.getByTestId('oblique-panel').locator('summary').tap();
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
 // The mobile summary keeps keyboard focus after a tap. A later Space must
 // target gameplay rather than activate the native details toggle.
 await page.getByTestId('oblique-panel').locator('summary').evaluate(el=>(el as HTMLElement).blur());
 const before=await page.evaluate(()=>window.__tsumimac!.state());
 if(isMobile){await page.getByTestId('touch-left').tap();await page.getByTestId('touch-rotate').tap();}else{await page.keyboard.press('ArrowLeft');await page.keyboard.press('KeyX');}
 await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().q)).toBe((before.q+1)%4);
 await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().score.devices)).toBeGreaterThan(before.score.devices);
 const views=await page.evaluate(()=>window.__tsumimac!.views());expect(views.front).toEqual(views.oblique);
 await page.screenshot({path:info.outputPath('play.png'),fullPage:true});
 // Exercise the existing result writer, while keeping the other score intact.
 if(mode==='classic')await buildWall(page);else await page.evaluate(()=>{const d=window.__tsumimac!,h=529*72/197;for(let i=0;i<5;i++)d.placeLocked('pro',0,(900-h*(i+1))/36);});
 await page.evaluate(()=>window.__tsumimac!.setTimeScale(8));await expect(page.getByTestId('result-screen')).toBeVisible({timeout:15000});
 const audit=await page.evaluate(()=>({events:window.__storageAudit.events,records:window.__storageAudit.dump()}));
 const selected=mode==='classic'?classicKey:realKey,other=mode==='classic'?realKey:classicKey;
 expect(JSON.parse(audit.records[selected]!).plays).toBe(mode==='classic'?9:12);
 expect(JSON.parse(audit.records[selected]!).bestSpent).toBe(987654321);
 expect(audit.records[other]).toBe(initial[other]);expect(audit.records[settingsKey]).toBe(initial[settingsKey]);expect(audit.records[archivedKey]).toBe(initial[archivedKey]);
 expect(audit.events.every(e=>[classicKey,realKey,settingsKey].includes(e.key))).toBe(true);
 expect(audit.events.some(e=>e.op==='setItem'&&e.key===selected)).toBe(true);
 expect(audit.events.some(e=>e.op==='removeItem'||e.op==='clear')).toBe(false);
 await writeFile(info.outputPath('storage-audit.json'),JSON.stringify(audit,null,2));
 await page.getByTestId('result-title').click();await expect(page.locator('.menu button')).toHaveCount(3);expect(errors).toEqual([]);
});

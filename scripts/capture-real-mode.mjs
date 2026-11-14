import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.REAL_OUTPUT||'test-results/real-mode');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(process.env.REAL_SOFTWARE)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args);};});
const label=process.env.REAL_SOFTWARE?'software':'real',reports=[];
for(const scene of ['models','rotated','dense','cleared','cleared-settled']){
  await page.goto('http://127.0.0.1:4173/tools/real/view.html?scene='+scene);await page.waitForFunction(()=>!!window.realValidation);
  const data=await page.evaluate(()=>window.realValidation);if(data.depth.mismatches||data.gpu.maxError>.001||!data.orderIndependent||data.escaped||data.ledgerError>1e-5)throw Error('Invariant '+JSON.stringify({scene,depth:data.depth,escaped:data.escaped,ledgerError:data.ledgerError}));
  await page.locator('body').screenshot({path:path.join(out,`${label}-${scene}.png`)});reports.push(data);
}
await page.goto('http://127.0.0.1:4173/?seed=20261028');await page.getByTestId('real-start-button').click();await page.waitForFunction(()=>window.__tsumimac?.views().synchronized);await page.keyboard.press('KeyP');
await page.evaluate(()=>{const d=window.__tsumimac;d.placeLocked('miniM1',0,17);d.placeLocked('miniM2',0,16.6345);d.placeLocked('miniM4',3,17.4924);d.placeLocked('studio',5,17);d.placeLocked('pro',7,12.63);d.placeLocked('macPro2013',3,14.45);});
await page.getByTestId('resume-button').click();await page.waitForTimeout(75);await page.keyboard.press('KeyP');await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:hidden!important}'});
await page.screenshot({path:path.join(out,`${label}-game.png`)});
if(errors.length)throw Error(errors.join('\n'));await writeFile(path.join(out,`${label}-measurements.json`),JSON.stringify({errors,reports},null,2));console.log(JSON.stringify({label,scenes:reports.map(r=>({name:r.name,depth:r.depth,escaped:r.escaped,ledger:r.ledgerError})),errors}));await browser.close();

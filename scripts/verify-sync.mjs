import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.SYNC_OUTPUT||'test-results/sync');await mkdir(out,{recursive:true});
const label=process.argv[2]||'after';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:900,height:930},deviceScaleFactor:2});
if(process.env.SYNC_SOFTWARE)await page.addInitScript(()=>{
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args);};
});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const reports=[];
for(const scene of ['normal','dense','tilted','separated']) {
  await page.goto(`http://127.0.0.1:4173/tools/sync/view.html?scene=${scene}`);
  await page.waitForFunction(()=>!!window.syncAudit);
  const result=await page.evaluate(()=>window.syncAudit);
  if(!result.sameSnapshot||!result.sourceUnchanged||!result.orderIndependent)throw Error('Snapshot/order invariant');
  if(result.gpu.maxError>.001||result.audit.maxStateCenterError>1e-9||result.audit.maxRotationError>1e-9)throw Error('Coordinate invariant');
  if(label!=='before'&&(result.audit.maxModelAnchorError>1e-9||result.audit.maxContactGap>1e-9||result.audit.maxMatterVertexProjectionError>1e-9))throw Error('Physical envelope invariant');
  if(result.depth.mismatches||result.separatedDepth.mismatches)throw Error('Depth visibility invariant '+JSON.stringify({depth:result.depth,separated:result.separatedDepth}));
  await page.screenshot({path:path.join(out,`${label}-${scene}.png`)});
  await page.locator('main').screenshot({path:path.join(out,`${label}-${scene}-views.png`)});
  const rawFront=await page.locator('#front').evaluate(canvas=>canvas.toDataURL().split(',')[1]);
  await writeFile(path.join(out,`${label}-${scene}-front-raw.png`),Buffer.from(rawFront,'base64'));
  reports.push(result);
}
// Capture the actual running application, stopped on one shared engine frame.
await page.setViewportSize({width:1440,height:1000});
await page.goto('http://127.0.0.1:4173/?seed=20261027');await page.getByTestId('start-button').click();
await page.waitForFunction(()=>window.__tsumimac?.views().synchronized);await page.keyboard.press('KeyP');
const live=await page.evaluate(()=>{const d=window.__tsumimac,v=d.views();return {synchronized:v.synchronized,front:v.front,oblique:v.oblique,steps:d.state().steps};});
await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:hidden!important}'});
await page.screenshot({path:path.join(out,`${label}-live.png`)});
if(JSON.stringify(live.front)!==JSON.stringify(live.oblique))throw Error('Live frames differ');
if(errors.length)throw Error(errors.join('\n'));
await writeFile(path.join(out,`${label}-measurements.json`),JSON.stringify({label,errors,reports,live},null,2));
console.log(JSON.stringify({label,errors,gpuError:reports[0].gpu.maxError,anchorError:reports[0].audit.maxModelAnchorError,contactGap:reports[0].audit.maxContactGap,depthSamples:reports.map(r=>r.depth),separatedDepth:reports[0].separatedDepth,liveSynchronized:live.synchronized}));
await browser.close();

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve(process.env.CAPTURE_OUTPUT || 'test-results/oblique');
await mkdir(out, { recursive: true });
const label = process.argv[2] || 'after';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
if(process.env.FORCE_SOFTWARE) await page.addInitScript(()=>{
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')return null;return get.call(this,type,...args);};
});
await page.goto('http://127.0.0.1:4173/?seed=20261027');
await page.getByTestId('start-button').click();
await page.waitForFunction(() => window.__tsumimac?.views().synchronized);
await page.keyboard.press('KeyP');
await page.evaluate(() => {
  for (const [kind, col, row] of [['miniM1',0,17],['miniM4',3,17],['studio',5,16],['pro',0,12],['macPro2013',5,12]]) window.__tsumimac.placeLocked(kind,col,row);
});
await page.getByTestId('resume-button').click();
await page.waitForTimeout(80);
await page.keyboard.press('KeyP');
// The pause overlay is UI only; capture the live synchronized canvases beneath it.
await page.addStyleTag({content:'[data-testid="pause-overlay"] { visibility: hidden !important; }'});
await page.getByTestId('oblique-canvas').screenshot({ path: path.join(out, `${label}-game-oblique.png`) });
await page.getByTestId('game-canvas').screenshot({ path: path.join(out, `${label}-game-front.png`) });
await page.screenshot({ path: path.join(out, `${label}-game.png`) });
const verification = await page.evaluate(async () => {
  const { ObliqueRenderer } = await import('/src/game/rendering/obliqueRenderer.ts');
  const { SpriteCache } = await import('/src/game/rendering/sprites.ts');
  const { DEVICES } = await import('/src/data/devices.ts');
  const { Renderer } = await import('/src/game/rendering/renderer.ts');
  document.body.innerHTML = '<main style="display:flex;background:#111620;color:white"></main>';
  const kinds = Object.keys(DEVICES);
  const item = (kind,x,y,angle=0,extra={}) => ({key:{kind,wCells:DEVICES[kind].w,hCells:DEVICES[kind].h,refurb:false,cutTop:false,cutBottom:false,...extra},x,y,angle,active:false});
  const singles = kinds.map((k,i)=>item(k,i%2 ? 220:65,140+Math.floor(i/2)*195));
  const dense = [item('pro',70,490),item('macPro2013',160,500),item('studio',250,520),item('miniM2',130,573),item('miniM4',220,570),item('miniM1',75,390,Math.PI/2),item('studio',215,400,-0.38),item('macPro2013',110,295,Math.PI/2),item('pro',230,235,Math.PI/2),item('studio',90,160,Math.PI),item('pro',285,100,0,{hCells:1,cutTop:true})];
  const frames=[];
  for (const [name,items] of [['Models: M1 / M2 / M4 / Studio / Tower / 2013',singles],['Dense / rotated / cut',dense],['Dense reversed (must be identical)',[...dense].reverse()]]) {
    const section=document.createElement('section');section.style.width='400px';section.innerHTML=`<p>${name}</p>`;
    const canvas=document.createElement('canvas');canvas.style.width='400px';canvas.style.height='704px';section.append(canvas);document.querySelector('main').append(section);
    const renderer=new ObliqueRenderer(canvas,new SpriteCache());renderer.resize(400,704,2);
    const state={items,guide:null,dangerRatio:0,floaters:[],flashes:[],shake:0,timeMs:0};
    const before=JSON.stringify(state);renderer.draw(state);
    if(JSON.stringify(state)!==before)throw Error('Renderer mutated LIVE state');
    frames.push(canvas.toDataURL());
  }
  // Exact-state front rendering permits a real before/after pixel comparison.
  const front=document.createElement('canvas');front.id='front-fixture';document.body.append(front);
  const renderer=new Renderer(front);renderer.resize(360,648,2);
  renderer.draw({items:singles,guide:null,dangerRatio:0,floaters:[],flashes:[],shake:0,timeMs:0});
  return {orderIndependent:frames[1]===frames[2]};
});
await page.locator('main').screenshot({ path:path.join(out,`${label}-models-dense.png`) });
const canvases = page.locator('canvas');
await canvases.nth(0).screenshot({path:path.join(out,`${label}-models.png`)});
await canvases.nth(1).screenshot({path:path.join(out,`${label}-dense.png`)});
await page.locator('#front-fixture').screenshot({path:path.join(out,`${label}-front-fixture.png`)});
if(!verification.orderIndependent)throw Error('Dense render depends on item order');
if (errors.length) throw new Error(errors.join('\n'));
await writeFile(path.join(out,`${label}-verification.json`),JSON.stringify({label,errors,...verification,sourceStateUnchanged:true},null,2));
console.log(JSON.stringify({label,errors,out,...verification}));
await browser.close();

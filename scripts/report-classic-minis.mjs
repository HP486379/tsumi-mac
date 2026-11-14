import { chromium } from '@playwright/test';
import { mkdir,readFile,writeFile,copyFile,readdir } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.MINI_OUTPUT||'test-results/classic-minis'),docs=path.resolve('docs/classic-mini-rework');
await mkdir(docs,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1460,height:1200},deviceScaleFactor:1});
const dataUrl=async file=>'data:image/png;base64,'+(await readFile(file)).toString('base64');
async function compare(name,title,before,after,left='変更前：fix-classic-m4-chassis',right='変更後：classic-mini-model-rework'){
 await page.setContent(`<style>body{margin:20px;background:#111620;color:#edf4ff;font:18px system-ui}h1{font-size:24px}main{display:flex;gap:20px}figure{margin:0;width:700px}img{width:700px;display:block}figcaption{padding:12px;background:#253143}</style><h1>${title}</h1><main><figure><figcaption>${left}</figcaption><img src="${await dataUrl(before)}"></figure><figure><figcaption>${right}</figcaption><img src="${await dataUrl(after)}"></figure></main>`);
 await page.locator('img').evaluateAll(async nodes=>Promise.all(nodes.map(n=>n.decode())));
 await page.screenshot({path:path.join(out,name),fullPage:true});await copyFile(path.join(out,name),path.join(docs,name));
}
const measurements={base:'30aa736050ac5c31476822d5972d9ab0428af689',branch:'classic-mini-model-rework',backends:[]};
for(const backend of ['webgl','canvas']){
 const before=JSON.parse(await readFile(path.join(out,`before-${backend}.json`),'utf8')),after=JSON.parse(await readFile(path.join(out,`after-${backend}.json`),'utf8'));
 const protectedCases=after.reports[0].hashes.filter(h=>h.mode==='real'||!h.kind.startsWith('mini')).map(h=>{const old=before.reports[0].hashes.find(p=>p.kind===h.kind&&p.mode===h.mode);return {kind:h.kind,mode:h.mode,unchanged:['mesh','front','side'].every(k=>old[k]===h[k]),hashes:h};});
 if(protectedCases.some(c=>!c.unchanged)||after.transferError!==0||after.errors.length)throw Error('Regression detected');
 measurements.backends.push({backend,transferVertexErrorPx:after.transferError,protectedCases,models:after.reports.map((r,i)=>({kind:r.kind,before:before.reports[i].extent,after:r.extent,sameFrame:r.sameFrame,contacts:r.contacts}))});
 for(const kind of ['miniM1','miniM2','miniM4'])await compare(`compare-${backend}-${kind}.png`,`${kind} / ${backend==='webgl'?'WebGL':'Canvas代替描画'} / 正面と斜め・同じ4倍倍率`,path.join(out,`before-${backend}-${kind}.png`),path.join(out,`after-${backend}-${kind}.png`));
}
await writeFile(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));await copyFile(path.join(out,'measurements.json'),path.join(docs,'measurements.json'));
const result=path.resolve('../board-validation/results'),dirs=await readdir(result);
for(const device of ['desktop','mobile'])for(const backend of ['WebGL','Canvas']){
 const dir=dirs.find(d=>d.startsWith('classic-minis-')&&d.includes(backend)&&d.endsWith(`${device}-chromium`));if(!dir)throw Error(`Missing ${device}/${backend} result`);
 const folder=path.join(result,dir),name=`play-${device}-${backend.toLowerCase()}.png`;
 await copyFile(path.join(folder,'three-mini-stacks.png'),path.join(out,name));await copyFile(path.join(out,name),path.join(docs,name));
 if(device==='desktop'&&backend==='WebGL')await compare('line-clear.png','通常モード：M1が2層では行消しなし → 3層で消去し、残りの断片が再接地',path.join(folder,'thin-row-before.png'),path.join(folder,'thin-row-after.png'),'変更後のゲーム：2層・消去前','変更後のゲーム：3層成立・消去後');
}
console.log(JSON.stringify({backends:measurements.backends.map(b=>({backend:b.backend,transferError:b.transferVertexErrorPx,protected:b.protectedCases.length,contacts:b.models.map(m=>({kind:m.kind,gaps:m.contacts.gaps,floorError:m.contacts.floorError}))}))}));
await browser.close();

import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.M4_OUTPUT||'test-results/classic-m4'),docs=path.resolve('docs/classic-m4');await mkdir(docs,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});const measurements=[];
for(const backend of ['webgl','canvas']){
 const data=await Promise.all(['before','after'].map(async label=>({label,...JSON.parse(await readFile(path.join(out,`${label}-${backend}.json`),'utf8'))})));measurements.push({backend,...Object.fromEntries(data.map(d=>[d.label,d]))});
 const images=await Promise.all(['before','after'].map(n=>readFile(path.join(out,`${n}-${backend}.png`))));const page=await browser.newPage({viewport:{width:1520,height:1300}});
 await page.setContent(`<html lang="ja"><meta charset="utf-8"><style>body{margin:16px;background:#111620;color:#edf4ff;font:18px system-ui}h1{font-size:28px}main{display:flex;gap:16px}section{width:736px}img{width:736px}h2{font-size:22px}</style><h1>通常モードM4：変更前 / 変更後（${backend==='webgl'?'WebGL':'Canvas代替描画'}）</h1><p>接触表示を優先。36×36px・奥行き36pxを維持し、角丸・面取り・前面ポートを改善。実機比率2.54:1への変更は行わない。</p><main>${images.map((b,i)=>`<section><h2>${i?'変更後':'変更前'}</h2><img src="data:image/png;base64,${b.toString('base64')}"></section>`).join('')}</main></html>`);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.locator('body').screenshot({path:path.join(out,`comparison-${backend}.png`)});await page.close();await copyFile(path.join(out,`comparison-${backend}.png`),path.join(docs,`comparison-${backend}.png`));
}
for(const stage of ['before','after'])for(const entry of measurements[0][stage].hashes){const other=measurements[1][stage].hashes.find(h=>h.kind===entry.kind&&h.mode===entry.mode);if(entry.mesh!==other.mesh)throw Error('Backend geometry mismatch');}
await browser.close();await writeFile(path.join(docs,'measurements.json'),JSON.stringify(measurements,null,2));await copyFile(path.join(docs,'measurements.json'),path.join(out,'measurements.json'));console.log(JSON.stringify({protectedCasesPerBackend:11,backends:2,geometryMatches:true}));

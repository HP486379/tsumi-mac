import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.BOARD_OUTPUT||'test-results/board'),docs=path.resolve('docs/real-board');await mkdir(docs,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
for(const type of ['desktop','mobile']){
 const images=await Promise.all(['before','after'].map(n=>readFile(path.join(out,`${n}-${type}.png`))));
 const page=await browser.newPage({viewport:{width:1480,height:1100}});
 await page.setContent(`<html lang="ja"><meta charset="utf-8"><style>body{margin:16px;background:#10151e;color:#edf2fa;font:18px sans-serif}main{display:flex;gap:16px}section{width:716px}h1{font-size:28px}img{width:${type==='mobile'?350:716}px;display:block;margin:auto}h2{font-size:20px}</style><h1>実寸モード：360×648 → 540×900 / ${type==='mobile'?'スマホ':'PC'}</h1><p>全6機種の共通縮尺72/197 px/mmは維持。Proを縮小せず、盤面を拡張。</p><main>${images.map((b,i)=>`<section><h2>${i?'変更後：540×900（15列×25行）':'変更前：360×648（10列×18行）'}</h2><img src="data:image/png;base64,${b.toString('base64')}"></section>`).join('')}</main><p>各図は同じ端末サイズで盤面全体を収めた実ゲーム画像。3台のProと全6機種を配置。CSS表示倍率の差は物理寸法の変更を意味しない。</p></html>`);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await page.locator('body').screenshot({path:path.join(out,`comparison-${type}.png`)});await page.close();
 await copyFile(path.join(out,`comparison-${type}.png`),path.join(docs,`comparison-${type}.png`));
}
await browser.close();
const audit=[];for(const label of ['real','software']){const d=JSON.parse(await readFile(path.join(out,`audit/${label}-measurements.json`),'utf8'));audit.push({renderer:label,errors:d.errors,reports:d.reports.map(({state,gpu,...r})=>({...r,gpu:{points:gpu.rows.length,maxError:gpu.maxError}}))});}
await writeFile(path.join(docs,'measurements.json'),JSON.stringify(audit,null,2));await copyFile(path.join(docs,'measurements.json'),path.join(out,'summary-measurements.json'));
for(const file of ['real-dense.png','real-cleared-settled.png'])await copyFile(path.join(out,'audit',file),path.join(docs,file));
console.log(JSON.stringify({docs,scenes:audit.map(a=>({renderer:a.renderer,depthSamples:a.reports.reduce((n,r)=>n+r.depth.samples,0),maxGpuError:a.reports[0].gpu.maxError}))}));

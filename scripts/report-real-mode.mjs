import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.REAL_OUTPUT||'test-results/real-mode'),docs=path.resolve('docs/real-mode');
await mkdir(docs,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
const classic=await readFile(path.join(out,'classic/classic-game.png')),real=await readFile(path.join(out,'real-game.png'));
await page.setContent(`<html lang="ja"><meta charset="utf-8"><style>body{margin:0;background:#10151e;color:#edf2fa;font:20px sans-serif}h1,p{margin:18px}main{display:flex;gap:12px;padding:12px}section{width:726px}h2{font-size:23px}img{width:726px}</style><h1>積みMac：現行モード / 追加した実寸モード</h1><p>現行モードは維持。実寸モードは全6機種・全軸共通 72/197 px/mm。</p><main><section><h2>現行モード（既存の物理セル）</h2><img src="data:image/png;base64,${classic.toString('base64')}"></section><section><h2>実寸モード（物理・正面・3Dの寸法を統一）</h2><img src="data:image/png;base64,${real.toString('base64')}"></section></main><p>配置はモード別の例。機種比率の厳密な比較は real-models.png と dimensions.csv を参照。</p></html>`);
await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
await page.locator('body').screenshot({path:path.join(out,'comparison.png')});await browser.close();
const measurements=[];
for(const label of ['real','software']){
  const data=JSON.parse(await readFile(path.join(out,`${label}-measurements.json`),'utf8'));
  measurements.push({renderer:label,errors:data.errors,reports:data.reports.map(({state,gpu,...r})=>({...r,gpu:{maxError:gpu.maxError,points:gpu.rows.length}}))});
}
await writeFile(path.join(docs,'measurements.json'),JSON.stringify(measurements,null,2));
await copyFile(path.join(docs,'measurements.json'),path.join(out,'summary-measurements.json'));
const dimensions=measurements[0].reports[0].dimensions;
const csv=['kind,width_mm,height_mm,depth_mm,width_px,height_px,depth_px,px_per_mm',...dimensions.map(d=>[d.kind,d.mm.w,d.mm.h,d.mm.d,d.width,d.height,d.depth,d.scale].join(','))].join('\n')+'\n';
await writeFile(path.join(docs,'dimensions.csv'),csv);await writeFile(path.join(out,'dimensions.csv'),csv);
for(const file of ['comparison.png','real-models.png','real-dense.png','real-cleared-settled.png'])await copyFile(path.join(out,file),path.join(docs,file));
console.log(JSON.stringify({docs,dimensions:dimensions.length,renderers:measurements.length}));

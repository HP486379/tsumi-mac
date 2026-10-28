import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir,copyFile,readdir } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.TETRIS_OUTPUT||'test-results/tetris-play'),results=path.resolve(process.env.TETRIS_RESULTS||'test-results'),docs=path.resolve('docs/tetris-snap');await mkdir(docs,{recursive:true});
const verification=[];
for(const dir of await readdir(results)){if(!dir.startsWith('tetris-'))continue;const mobile=dir.includes('mobile'),fallback=dir.includes('Canvas'),label=`${mobile?'mobile':'desktop'}-${fallback?'canvas':'webgl'}`,dest=path.join(out,label);await mkdir(dest,{recursive:true});
 for(const file of await readdir(path.join(results,dir)))if(file.endsWith('.png')||file==='verification.json')await copyFile(path.join(results,dir,file),path.join(dest,file));
 const r=JSON.parse(await readFile(path.join(dest,'verification.json'),'utf8'));verification.push({label,synchronized:r.synchronized,errors:r.errors,snap:{ghost:r.ghost,fixed:r.locked,sideGapPx:r.locked[1].x-r.locked[0].x-72,floorGapPx:900-r.locked[1].y-36*72/197/2,ghostErrorPx:Math.hypot(r.ghost.x-r.locked[1].x,r.ghost.y-r.locked[1].y)},clear:{lines:r.cleared.lines,points:r.cleared.points,remaining:r.cleared.locked},fragments:r.fragments.locked,chain:{count:r.chain.chain,lines:r.chain.lines,points:r.chain.points,remaining:r.chain.locked.length},models:r.models.items});
}
if(verification.length!==4)throw Error('Expected all four desktop/mobile WebGL/Canvas cases');
await writeFile(path.join(out,'measurements.json'),JSON.stringify(verification,null,2));await copyFile(path.join(out,'measurements.json'),path.join(docs,'measurements.json'));
for(const label of ['desktop','mobile']){await copyFile(path.join(out,`${label}-play.png`),path.join(docs,`${label}-play.png`));}
await copyFile(path.join(out,'desktop-webgl/fragments.png'),path.join(docs,'fragments.png'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
for(const scene of ['snap','line']){
 const images=await Promise.all(['before','after'].map(n=>readFile(path.join(out,`desktop-webgl/${scene}-${n}.png`))));
 const page=await browser.newPage({viewport:{width:1480,height:1000}});
 const title=scene==='snap'?'接触スナップ：4pxの側面ギャップ → 0pxで固定':'部分ライン消去：横360pxだけを消去し、右端のMacを維持';
 await page.setContent(`<html lang="ja"><meta charset="utf-8"><style>body{margin:16px;background:#10151e;color:#edf2fa;font:18px sans-serif}h1{font-size:28px}main{display:flex;gap:16px}section{width:716px}img{width:716px}h2{font-size:22px}</style><h1>${title}</h1><p>540×900 / 全機種共通 72/197 px/mm / 同一の固定配置を用いた実ゲーム検証</p><main>${images.map((b,i)=>`<section><h2>${i?'処理後':'処理前'}</h2><img src="data:image/png;base64,${b.toString('base64')}"></section>`).join('')}</main><p>${scene==='snap'?'半透明は配置候補。接触面まで掃引し、候補と同じ位置へ固定。固定後は回転・倒壊しません。':'5台のM1による360pxの区間を消去。540px全幅は埋めず、右側Studioは同じ座標に残ります。緑は消去区間の一時表示。'}</p></html>`);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.locator('body').screenshot({path:path.join(out,`${scene}-comparison.png`)});await page.close();await copyFile(path.join(out,`${scene}-comparison.png`),path.join(docs,`${scene}-comparison.png`));
}
await browser.close();console.log(JSON.stringify(verification.map(v=>({label:v.label,sideGap:v.snap.sideGapPx,floorGap:v.snap.floorGapPx,ghostError:v.snap.ghostErrorPx,line:v.clear.lines,chain:v.chain.count,fragments:v.fragments.length,errors:v.errors}))));

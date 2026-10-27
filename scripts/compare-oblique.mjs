import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const out=path.resolve(process.env.CAPTURE_OUTPUT||'test-results/oblique');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:840,height:780},deviceScaleFactor:2});
for(const scene of ['models','dense']) {
  const before=(await readFile(path.join(out,`before-${scene}.png`))).toString('base64');
  const after=(await readFile(path.join(out,`after-${scene}.png`))).toString('base64');
  await page.setContent(`<body style="margin:0;background:#111620;color:#f0f4fa;font:16px system-ui"><main style="display:flex;gap:20px;padding:10px"><section><p>Before: chassis-rounded-solid-v2</p><img width="400" src="data:image/png;base64,${before}"></section><section><p>After: unified chassis + depth buffer</p><img width="400" src="data:image/png;base64,${after}"></section></main></body>`);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  await page.locator('main').screenshot({path:path.join(out,`comparison-${scene}.png`)});
}
const hash=async name=>createHash('sha256').update(await readFile(path.join(out,name))).digest('hex');
const before=await hash('before-front-fixture.png'),after=await hash('after-front-fixture.png');
if(before!==after)throw Error('Front fixture changed');
const gpu=JSON.parse(await readFile(path.join(out,'after-verification.json'),'utf8'));
const software=JSON.parse(await readFile(path.join(out,'software-verification.json'),'utf8'));
if(!gpu.orderIndependent||!software.orderIndependent)throw Error('Order independence not verified');
await writeFile(path.join(out,'visual-verification.json'),JSON.stringify({frontUnchanged:true,frontSHA256:after,denseSubmissionOrderIndependent:gpu.orderIndependent,softwareSubmissionOrderIndependent:software.orderIndependent},null,2));
await mkdir('docs/oblique-validation',{recursive:true});
for(const name of ['comparison-models.png','comparison-dense.png'])await copyFile(path.join(out,name),path.join('docs/oblique-validation',name));
console.log(JSON.stringify({frontUnchanged:true,frontSHA256:after}));
await browser.close();

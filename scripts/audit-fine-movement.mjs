import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.FINE_OUTPUT||'test-results/fine-movement');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}),page=await browser.newPage();
await page.goto('http://localhost:4173/');
const data=await page.evaluate(async()=>{
 const {auditChannel}=await import('/tools/movement/audit.ts'),cases=[];
 for(const mode of ['classic','real','count'])for(const kind of ['miniM1','miniM2'])for(const gap of [12,16,18])cases.push(auditChannel(mode,kind,gap));
 for(const kind of ['miniM1','miniM2'])cases.push(auditChannel('classic',kind,12,true));return cases;
});
await writeFile(path.join(out,'channel-audit.json'),JSON.stringify(data,null,2)+'\n');await browser.close();console.log(JSON.stringify(data));

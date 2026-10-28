import { chromium,devices } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.TETRIS_OUTPUT||'test-results/tetris-play');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
for(const mobile of [false,true]){
 const context=await browser.newContext(mobile?{...devices['Pixel 7']}:{viewport:{width:1440,height:1000},deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.TETRIS_URL||'http://localhost:4183')+'/?seed=20261028');await page.getByTestId('tetris-start-button').click();
 if(mobile)await page.getByTestId('tetris-panel').locator('summary').tap();
 const moves=[-20,16,-5,10,-25,25,-15,0,23,-23,7,-7];
 for(let i=0;i<moves.length;i++){
  if(await page.evaluate(()=>window.__tetris.state().over))break;
  for(let n=0;n<Math.abs(moves[i]);n++){if(mobile)await page.getByTestId(moves[i]<0?'tetris-left':'tetris-right').tap();else await page.keyboard.press(moves[i]<0?'ArrowLeft':'ArrowRight');}
  if(i%3===1){if(mobile)await page.getByTestId('tetris-rotateR').tap();else await page.keyboard.press('KeyX');}
  if(mobile)await page.getByTestId('tetris-hard').tap();else{await page.getByTestId('tetris-front').click({position:{x:8,y:8}});await page.keyboard.press('Space');}
 }
 const state=await page.evaluate(()=>window.__tetris.state());if(state.over||state.points<=0||state.locked.length<6)throw Error('Ordinary input play did not remain playable');
 const frozen=JSON.stringify(state.locked);await page.waitForTimeout(150);if(JSON.stringify(await page.evaluate(()=>window.__tetris.state().locked))!==frozen)throw Error('Fixed Macs drifted');
 await page.getByTestId('tetris-pause').click();await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:hidden!important}'});
 const views=await page.evaluate(()=>window.__tetris.views());if(!views.synchronized||errors.length)throw Error('View or JS failure');
 const label=mobile?'mobile':'desktop';await page.screenshot({path:path.join(out,`${label}-play.png`)});
 await writeFile(path.join(out,`${label}-play.json`),JSON.stringify({mobile,errors,state,synchronized:views.synchronized,source:'12 drops through ordinary controls; no fixture placement'},null,2));
 console.log(JSON.stringify({label,points:state.points,fixed:state.locked.length,lines:state.lines,errors}));await context.close();
}
await browser.close();

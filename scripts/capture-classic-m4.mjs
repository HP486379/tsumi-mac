import { chromium } from '@playwright/test';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.M4_OUTPUT||'test-results/classic-m4'),label=process.argv[2]||'after',software=!!process.env.FORCE_SOFTWARE,renderer=software?'canvas':'webgl';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});const page=await browser.newPage({viewport:{width:1000,height:1200},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(software)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:get.call(this,type,...args);};});
await page.goto('http://localhost:4173/');
const data=await page.evaluate(async()=>{
 const [{Renderer},{ObliqueRenderer},{chassisMesh},{chassisPose,worldFromLocal,projectWorld},{DEVICES,DEVICE_KINDS},{deviceCells},{boardForMode,obliqueViewport}]=await Promise.all([import('/src/game/rendering/renderer.ts'),import('/src/game/rendering/obliqueRenderer.ts'),import('/src/game/rendering/chassisMesh.ts'),import('/src/game/rendering/chassisProjection.ts'),import('/src/data/devices.ts'),import('/src/data/gameModes.ts'),import('/src/game/board.ts')]);
 const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const state=items=>({items,guide:null,dangerRatio:0,floaters:[],flashes:[],shake:0,timeMs:0});
 const item=(kind,mode,x=180,y=500,angle=0)=>{const d=deviceCells(kind,mode);return {x,y,angle,active:false,key:{kind,mode,wCells:d.w,hCells:d.h,refurb:false,cutTop:false,cutBottom:false}};};
 const hashes=[];
 for(const mode of ['classic','real'])for(const kind of DEVICE_KINDS){const board=boardForMode(mode),view=obliqueViewport(board),front=document.createElement('canvas'),side=document.createElement('canvas'),f=new Renderer(front,board),o=new ObliqueRenderer(side,f.sprites,board);f.resize(board.width,board.height,1);o.resize(view.width,view.height,1);const p=item(kind,mode,board.width/2,board.height/2),s=state([p]);f.draw(s);o.draw(s);hashes.push({mode,kind,mesh:await hash(JSON.stringify(chassisMesh(p))),front:await hash(front.toDataURL()),side:await hash(side.toDataURL())});}
 document.body.innerHTML='<h1>通常M4：36×36pxの接触表示を維持</h1><p>左：正面 / 右：斜め。同じ状態を4倍で表示。モデル寸法・物理セル・奥行きは変更しない。</p><main></main>';
 const style=document.createElement('style');style.textContent='body{margin:16px;background:#111620;color:#edf4ff;font:16px system-ui}h1{font-size:24px}main{display:grid;grid-template-columns:360px 360px;gap:16px}section p{margin:0 0 8px}.crop{position:relative;width:360px;overflow:hidden;background:#111620}.crop canvas{position:absolute}';document.head.append(style);
 const cases=[['直立', [item('miniM4','classic')],240],['2台の接触',[item('miniM4','classic',180,482),item('miniM4','classic',180,518)],360],['90度回転',[item('miniM4','classic',180,500,Math.PI/2)],240]];
 for(const [name,items,height] of cases){const fCanvas=document.createElement('canvas'),oCanvas=document.createElement('canvas'),f=new Renderer(fCanvas),o=new ObliqueRenderer(oCanvas,f.sprites);f.resize(360,648,2);o.resize(400,704,2);const s=state(items);f.draw(s);o.draw(s);if(o.lastState!==s)throw Error('Not the same frame');
  for(const [i,c] of [fCanvas,oCanvas].entries()){const section=document.createElement('section'),title=document.createElement('p'),crop=document.createElement('div');title.textContent=name+' / '+(i?'斜め':'正面');crop.className='crop';crop.style.height=height+'px';const center=i?projectWorld(180,500,18):{x:180,y:500};c.style.width=(i?400:360)*4+'px';c.style.height=(i?704:648)*4+'px';c.style.left=180-center.x*4+'px';c.style.top=height/2-center.y*4+'px';crop.append(c);section.append(title,crop);document.querySelector('main').append(section);}
 }
 const p=item('miniM4','classic'),pose=chassisPose(p),world=chassisMesh(p).map(v=>worldFromLocal(pose,v.p)),extent=[0,1,2].map(a=>Math.max(...world.map(p=>p[a]))-Math.min(...world.map(p=>p[a])));
 return {hashes,extent,pose,physics:{width:DEVICES.miniM4.w*36,height:DEVICES.miniM4.h*36},sameFrame:true};
});
await page.locator('body').screenshot({path:path.join(out,`${label}-${renderer}.png`)});if(errors.length)throw Error(errors.join('\n'));
if(label==='after'){const before=JSON.parse(await readFile(path.join(out,`before-${renderer}.json`),'utf8'));for(const h of data.hashes){const old=before.hashes.find(b=>b.kind===h.kind&&b.mode===h.mode);if(h.kind!=='miniM4'||h.mode==='real')for(const key of ['mesh','front','side'])if(h[key]!==old[key])throw Error('Protected rendering changed: '+h.mode+'/'+h.kind+'/'+key);}}
await writeFile(path.join(out,`${label}-${renderer}.json`),JSON.stringify({...data,errors},null,2));console.log(JSON.stringify({label,renderer,extent:data.extent,protectedCases:data.hashes.length-1,errors}));await browser.close();

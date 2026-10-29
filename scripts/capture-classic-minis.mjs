import { chromium } from '@playwright/test';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.MINI_OUTPUT||'test-results/classic-minis'),label=process.argv[2]||'after',software=!!process.env.FORCE_SOFTWARE,backend=software?'canvas':'webgl';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});const page=await browser.newPage({viewport:{width:1100,height:1400},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(software)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:get.call(this,type,...args);};});
const reports=[];
for(const kind of ['miniM1','miniM2','miniM4']){
 await page.goto('http://localhost:4173/');
 const data=await page.evaluate(async kind=>{
  const [{Renderer},{ObliqueRenderer},{chassisMesh},{chassisPose,worldFromLocal,projectWorld},{DEVICE_KINDS},{deviceCells},{boardForMode,obliqueViewport}]=await Promise.all([import('/src/game/rendering/renderer.ts'),import('/src/game/rendering/obliqueRenderer.ts'),import('/src/game/rendering/chassisMesh.ts'),import('/src/game/rendering/chassisProjection.ts'),import('/src/data/devices.ts'),import('/src/data/gameModes.ts'),import('/src/game/board.ts')]);
  const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const item=(kind,mode='classic',x=180,y=500,angle=0)=>{const d=deviceCells(kind,mode);return {x,y,angle,active:false,key:{kind,mode,wCells:d.w,hCells:d.h,refurb:false,cutTop:false,cutBottom:false}};};
  const state=items=>({items,guide:null,dangerRatio:0,floaters:[],flashes:[],shake:0,timeMs:0});
  const world=p=>chassisMesh(p).map(v=>worldFromLocal(chassisPose(p),v.p));
  const hashes=[];for(const mode of ['classic','real'])for(const kind of DEVICE_KINDS){const board=boardForMode(mode),view=obliqueViewport(board),a=document.createElement('canvas'),b=document.createElement('canvas'),f=new Renderer(a,board),o=new ObliqueRenderer(b,f.sprites,board);f.resize(board.width,board.height,1);o.resize(view.width,view.height,1);const p=item(kind,mode,board.width/2,board.height/2),s=state([p]);f.draw(s);o.draw(s);hashes.push({kind,mode,mesh:await hash(JSON.stringify(chassisMesh(p))),front:await hash(a.toDataURL()),side:await hash(b.toDataURL())});}
  const m1=world(item('miniM1','classic',0,0)),m4=world(item('miniM4','classic',0,0));
  document.body.innerHTML=`<h1>通常モード ${kind} / 正面・斜め</h1><p>同じ状態・同じ4倍倍率。3台の積層と90度回転を比較。</p><main></main>`;
  const style=document.createElement('style');style.textContent='body{margin:16px;background:#111620;color:#edf4ff;font:16px system-ui}h1{font-size:24px}main{display:grid;grid-template-columns:400px 400px;gap:16px}section p{margin:0 0 8px}.crop{position:relative;width:400px;overflow:hidden;background:#111620}.crop canvas{position:absolute}';document.head.append(style);
  const h=deviceCells(kind,'classic').h*36;
  for(const [name,items,height] of [['直立',[item(kind)],220],['3台の接触',[-1,0,1].map(i=>item(kind,'classic',180,500+i*h)),480],['90度回転',[item(kind,'classic',180,500,Math.PI/2)],360]]){
   const a=document.createElement('canvas'),b=document.createElement('canvas'),f=new Renderer(a),o=new ObliqueRenderer(b,f.sprites);f.resize(360,648,2);o.resize(400,704,2);const s=state(items);f.draw(s);o.draw(s);if(o.lastState!==s)throw Error('Frame mismatch');
   const pts=world(items[0]),depth=Math.max(...pts.map(v=>v[2]));
   for(const [i,c] of [a,b].entries()){const section=document.createElement('section'),caption=document.createElement('p'),crop=document.createElement('div');caption.textContent=name+' / '+(i?'斜め':'正面');crop.className='crop';crop.style.height=height+'px';const center=i?projectWorld(180,500,depth/2):{x:180,y:500};c.style.width=(i?400:360)*4+'px';c.style.height=(i?704:648)*4+'px';c.style.left=200-center.x*4+'px';c.style.top=height/2-center.y*4+'px';crop.append(c);section.append(caption,crop);document.querySelector('main').append(section);}
  }
  const {GameSim}=await import('/src/game/engine/GameSim.ts');
  const sim=new GameSim({}, {autoSpawn:false,randomEvents:false,seed:42});
  for(let n=0;n<3;n++)sim.placeLocked(kind,3,(648-(n+1)*h)/36);
  for(let n=0;n<700;n++)sim.step();
  const actual=sim.renderState().items,range=actual.map(p=>{const vertices=world(p);return {min:Math.min(...vertices.map(v=>v[1])),max:Math.max(...vertices.map(v=>v[1])),x:p.x,y:p.y,angle:p.angle};}).sort((a,b)=>b.max-a.max);
  const contacts={steps:700,entities:sim.entities.size,escaped:sim.escaped,range,floorError:range[0].max-648,gaps:range.slice(1).map((r,i)=>range[i].min-r.max),score:sim.score()};sim.destroy();
  const p=item(kind),points=world(p),extent=[0,1,2].map(a=>Math.max(...points.map(p=>p[a]))-Math.min(...points.map(p=>p[a])));return {kind,hashes,extent,cells:deviceCells(kind,'classic'),m1,m4,sameFrame:true,contacts};
 },kind);
 await page.locator('body').screenshot({path:path.join(out,`${label}-${backend}-${kind}.png`)});reports.push(data);
}
if(errors.length)throw Error(errors.join('\n'));
let transferError=null;
if(label==='after'){const before=JSON.parse(await readFile(path.join(out,`before-${backend}.json`),'utf8'));for(const h of reports[0].hashes){const old=before.reports[0].hashes.find(b=>b.kind===h.kind&&b.mode===h.mode);if(h.mode==='real'||!h.kind.startsWith('mini'))for(const key of ['mesh','front','side'])if(h[key]!==old[key])throw Error('Protected rendering changed '+h.mode+'/'+h.kind+'/'+key);}const old=before.reports[0].m1,now=reports[0].m4;if(old.length!==now.length)throw Error('Transferred topology changed');transferError=Math.max(...now.flatMap((p,i)=>p.map((v,j)=>Math.abs(v-old[i][j]))));if(transferError>1e-9)throw Error('M4 is not the previous M1 solid');}
await writeFile(path.join(out,`${label}-${backend}.json`),JSON.stringify({reports,transferError,errors},null,2));console.log(JSON.stringify({label,backend,dimensions:reports.map(r=>({kind:r.kind,extent:r.extent})),transferError,errors}));await browser.close();

import assert from 'node:assert/strict';
import { readdir,readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.FINE_OUTPUT||'test-results/fine-movement'),results=path.join(out,'playwright'),docs=path.resolve('docs/fine-movement');await mkdir(docs,{recursive:true});const cases=[];
for(const dir of await readdir(results)){
 if(!dir.startsWith('fine-movement-'))continue;
 const folder=path.join(results,dir),v=JSON.parse(await readFile(path.join(folder,'measurements.json'),'utf8'));
 assert.deepEqual(v.errors,[]);assert.equal(v.measurements.length,2);
 for(const m of v.measurements){assert.ok(Math.abs(m.width-72*36/197)<1e-9);assert.ok(m.leftClearance>0&&m.rightClearance>0);assert.ok(Math.abs(m.floorError)<.3);assert.equal(m.synchronized,true);}
 assert.ok(v.narrow.bottom<v.narrow.floor-100);
 const label=`${v.mode}-${v.isMobile?'mobile':'desktop'}-${v.software?'canvas':'webgl'}`;cases.push({label,...v});
 for(const [source,suffix] of [['gap18-miniM1.png','gap18'],['gap18-miniM2.png','gap18-first'],['gap12-blocked.png','gap12']]){
  const target=`${label}-${suffix}.png`;await copyFile(path.join(folder,source),path.join(out,target));
  const publish=(!v.isMobile&&!v.software&&(suffix==='gap18'||v.mode==='classic'&&suffix==='gap12'))||(v.isMobile&&suffix==='gap18'&&((v.mode==='classic'||v.mode==='count')&&!v.software||v.mode==='real'&&v.software));
  if(publish)await copyFile(path.join(out,target),path.join(docs,target));
 }
}
assert.equal(cases.length,12);await writeFile(path.join(out,'browser-measurements.json'),JSON.stringify(cases,null,2)+'\n');await copyFile(path.join(out,'browser-measurements.json'),path.join(docs,'browser-measurements.json'));await copyFile(path.join(out,'channel-audit.json'),path.join(docs,'channel-audit.json'));
console.log(JSON.stringify(cases.map(c=>({label:c.label,heldDelta:c.x0-c.held,channels:c.measurements.map(m=>({kind:m.kind,width:m.width,left:m.leftClearance,right:m.rightClearance,error:m.floorError})),narrowBottom:c.narrow.bottom}))));

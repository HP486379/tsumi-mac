import assert from 'node:assert/strict';
import { readdir,readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve(process.env.COUNT_OUTPUT||'test-results/max-stack-count'),results=path.join(out,'playwright'),docs=path.resolve('docs/max-stack-count');
await mkdir(docs,{recursive:true});const cases=[];
for(const dir of await readdir(results)){
 if(!dir.startsWith('count-mode-'))continue;
 const folder=path.join(results,dir),v=JSON.parse(await readFile(path.join(folder,'count-verification.json'),'utf8'));
 assert.equal(v.collapse,true);assert.deepEqual(v.errors,[]);
 const label=`${v.isMobile?'mobile':'desktop'}-${v.software?'canvas':'webgl'}`;
 const final=v.history.at(-1);assert.ok(final.state.count.current>=10);assert.equal(final.state.score.lines,0);
 const moved=[];for(let i=1;i<v.history.length;i++)for(const b of v.history[i].bodies){const old=v.history[i-1].bodies.find(p=>p.id===b.id&&p.state==='locked');if(old&&(Math.abs(old.angle-b.angle)>.15||Math.hypot(old.x-b.x,old.y-b.y)>24))moved.push({individualId:b.individualId,from:{x:old.x,y:old.y,angle:old.angle},to:{x:b.x,y:b.y,angle:b.angle}});}
 cases.push({label,current:final.state.count.current,peak:final.state.count.peak,lines:final.state.score.lines,escapedBeforeFixture:final.state.escaped,moved,steps:final.state.steps,bodies:final.bodies,errors:v.errors});
 for(const [source,name] of [['three-mode-title.png','title'],['count-play.png','play'],['collapse-continued.png','collapse'],['spawn-wait.png','spawn-wait']]){
  const target=`${name}-${label}.png`;await copyFile(path.join(folder,source),path.join(out,target));
  // Keep the browser captures in deliverables; publish representative PC/phone
  // scenes in the repository so the report is also useful away from this PC.
  if((!v.software&&name!=='spawn-wait')||(v.software&&v.isMobile&&name==='play'))await copyFile(path.join(out,target),path.join(docs,target));
 }
}
assert.equal(cases.length,4);await writeFile(path.join(out,'measurements.json'),JSON.stringify(cases,null,2)+'\n');await copyFile(path.join(out,'measurements.json'),path.join(docs,'measurements.json'));
console.log(JSON.stringify(cases.map(({label,current,peak,lines,moved,errors})=>({label,current,peak,lines,moved:moved.length,errors}))));

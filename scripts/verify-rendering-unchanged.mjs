import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve(process.env.MODE_AUDIT_OUTPUT||'test-results/mode-removal');
const results=[];
for(const backend of ['webgl','canvas']){
 const before=JSON.parse(await readFile(path.join(out,`baseline-${backend}.json`),'utf8'));
 const after=JSON.parse(await readFile(path.join(out,`removed-${backend}.json`),'utf8'));
 assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);
 const cases=after.reports[0].hashes.map(h=>{
  const old=before.reports[0].hashes.find(p=>p.kind===h.kind&&p.mode===h.mode);
  assert.deepEqual(h,old,`${backend}/${h.mode}/${h.kind} rendering changed`);
  return {...h,unchanged:true};
 });
 assert.equal(cases.length,12);
 const contacts=after.reports.map((r,i)=>{
  const old=before.reports[i];assert.equal(r.kind,old.kind);assert.deepEqual(r.extent,old.extent);assert.deepEqual(r.contacts,old.contacts);
  assert.equal(r.contacts.entities,3);assert.equal(r.contacts.escaped,0);
  return {kind:r.kind,extent:r.extent,contacts:r.contacts,unchanged:true};
 });
 results.push({backend,cases,contacts});
}
const report={base:'419a56fc7870a6647ed678b79a46d80f7711c4e1',unchangedCases:24,unchangedHashes:72,results};
await writeFile(path.join(out,'rendering-audit.json'),JSON.stringify(report,null,2)+'\n');
await mkdir('docs/supported-modes',{recursive:true});await writeFile('docs/supported-modes/rendering-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({unchangedCases:24,unchangedHashes:72,unchangedStackSimulations:6,errors:0}));

export const COUNT_RECORD_KEY='tsumimac.max-stack-count.v1';
export interface CountRecord {best:number;plays:number}
type Store=Pick<Storage,'getItem'|'setItem'>;
function storage():Store|null{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
const integer=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
export function loadCountRecord(store:Store|null=storage()):CountRecord {
 try{const r=JSON.parse(store?.getItem(COUNT_RECORD_KEY)??'{}');return {best:integer(r?.best),plays:integer(r?.plays)};}catch{return {best:0,plays:0};}
}
export function saveCountPeak(peak:number,store:Store|null=storage(),completed=false):CountRecord {
 const old=loadCountRecord(store),r={best:Math.max(old.best,integer(peak)),plays:old.plays+(completed?1:0)};
 if(completed||r.best>old.best)try{store?.setItem(COUNT_RECORD_KEY,JSON.stringify(r));}catch{/* Keep playing when storage is unavailable. */}
 return r;
}

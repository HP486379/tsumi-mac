export const TETRIS_RECORD_KEY='tsumimac.tetris-snap.v1';
export interface TetrisRecord {bestScore:number;bestLines:number;bestChain:number;plays:number}
type Store=Pick<Storage,'getItem'|'setItem'>;
function storage():Store|null{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}
export function loadTetrisRecord(store:Store|null=storage()):TetrisRecord{try{const r=JSON.parse(store?.getItem(TETRIS_RECORD_KEY)??'{}');const valid=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):0;return {bestScore:valid(r.bestScore),bestLines:valid(r.bestLines),bestChain:valid(r.bestChain),plays:valid(r.plays)};}catch{return {bestScore:0,bestLines:0,bestChain:0,plays:0};}}
export function saveTetrisResult(score:number,lines:number,chain:number,store:Store|null=storage()):TetrisRecord{const old=loadTetrisRecord(store),r={bestScore:Math.max(old.bestScore,score),bestLines:Math.max(old.bestLines,lines),bestChain:Math.max(old.bestChain,chain),plays:old.plays+1};try{store?.setItem(TETRIS_RECORD_KEY,JSON.stringify(r));}catch{/* Storage may be unavailable. */}return r;}

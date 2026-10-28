import { useEffect,useRef,useState } from 'react';
import { TetrisEngine,type TetrisHud,type TetrisDebug } from '../game/tetris/TetrisEngine';
import { loadTetrisRecord,saveTetrisResult,type TetrisRecord } from '../game/tetris/records';
import { REAL_BOARD } from '../game/board';
import { useStageSize } from '../hooks/useStageSize';
import { DEVICES } from '../data/devices';
import { actionForKey,type Action } from '../game/systems/input';
import type { AudioManager } from '../game/systems/audio';
import type { Settings } from '../game/systems/highscore';
import { PauseOverlay } from './PauseOverlay';
declare global {interface Window {__tetris?:TetrisDebug}}
interface Props {audio:AudioManager;settings:Settings;onSettings:(s:Settings)=>void;onTitle:()=>void;seed?:number}
export function TetrisScreen({audio,settings,onSettings,onTitle,seed}:Props){
 const stage=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),side=useRef<HTMLCanvasElement>(null),surface=useRef<HTMLDivElement>(null),engine=useRef<TetrisEngine|null>(null);
 const size=useStageSize(stage,REAL_BOARD),[hud,setHud]=useState<TetrisHud|null>(null),[result,setResult]=useState<TetrisHud|null>(null),[best,setBest]=useState<TetrisRecord>(()=>loadTetrisRecord()),[open,setOpen]=useState(()=>matchMedia('(min-width:1000px) and (min-height:560px)').matches);
 useEffect(()=>{if(!canvas.current)return;const e=new TetrisEngine(canvas.current,audio,setHud,h=>{setBest(saveTetrisResult(h.points,h.lines,h.chain));setResult(h);},seed);engine.current=e;window.__tetris=e.debug();e.start();
  const key=(event:KeyboardEvent,down:boolean)=>{const target=event.target;if(target instanceof HTMLElement&&(target.matches('input,textarea')||target.closest('button')&&(event.code==='Space'||event.code==='Enter')))return;const action=actionForKey(event.code);if(!action)return;event.preventDefault();if(down){if(!event.repeat)e.press(action);}else e.release(action);};
  const down=(event:KeyboardEvent)=>key(event,true),up=(event:KeyboardEvent)=>key(event,false),blur=()=>e.pause(),hidden=()=>{if(document.hidden)e.pause();};window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
  return ()=>{e.destroy();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);delete window.__tetris;engine.current=null;};
 },[audio,seed]);
 useEffect(()=>{engine.current?.resize(size.width,size.height,size.dpr);},[size]);
 useEffect(()=>{const e=engine.current,el=surface.current;if(!e||!side.current||!el)return;if(!open){e.attach(null);return;}const r=el.getBoundingClientRect();e.attach(side.current,r.width,r.height,devicePixelRatio);const ro=new ResizeObserver(()=>{const r=el.getBoundingClientRect();e.resizeSecondary(r.width,r.height,devicePixelRatio);});ro.observe(el);return ()=>{ro.disconnect();e.attach(null);};},[open,audio,seed]);
 const retry=()=>{setResult(null);engine.current?.restart();};
 const button=(action:Action,label:string,aria:string)=> <button type="button" key={action} className="touch-btn" aria-label={aria} data-testid={action==='pause'?'tetris-touch-pause':`tetris-${action}`} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);audio.unlock();engine.current?.press(action);}} onPointerUp={event=>{event.preventDefault();engine.current?.release(action);}} onPointerCancel={()=>engine.current?.release(action)} onLostPointerCapture={()=>engine.current?.release(action)}>{label}</button>;
 return <main className="game-screen tetris-screen" data-mode="real" data-testid="tetris-screen">
  <section className="hud" aria-label="テトリスモードのスコア">
   <div className="hud-item spent"><span className="hud-label">テトリスモード / スコア</span><strong className="hud-value" data-testid="tetris-score">{hud?.points??0}</strong></div>
   <div className="hud-item index"><span className="hud-label">消去区間 / 最大連鎖</span><strong className="hud-value" data-testid="tetris-lines">{hud?.lines??0} / {hud?.chain??0}</strong></div>
   <div className="hud-item lv"><span className="hud-label">レベル / 固定台数</span><strong>{hud?.level??1} / {hud?.devices??0}</strong></div>
   <div className="hud-item lines"><span className="hud-label">専用ハイスコア</span><strong data-testid="tetris-best">{best.bestScore}</strong></div>
   <div className="hud-item next"><span className="hud-label">NEXT</span><span className="next-name">{hud?DEVICES[hud.next].name:'—'}</span></div>
   <button className="btn pause-btn" data-testid="tetris-pause" aria-label="一時停止" onClick={()=>engine.current?.pause()}>❚❚</button>
  </section>
  <div className="stage" ref={stage}><div className="canvas-wrap" style={{width:size.width,height:size.height}}><canvas ref={canvas} data-testid="tetris-front" className="game-canvas" style={{width:size.width,height:size.height}} aria-label="テトリスモード 540×900"/></div></div>
  <aside className="side-panel"><details className="oblique-panel" data-testid="tetris-panel" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();}} onKeyUp={e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();}}>斜めビュー <span>LIVE / 閲覧専用</span></summary><div className="oblique-surface" ref={surface} style={{aspectRatio:'600 / 1000'}}><canvas className="oblique-canvas" ref={side} data-testid="tetris-oblique"/></div></details>
   <button type="button" className="btn tetris-grid" data-testid="tetris-grid" aria-pressed={hud?.grid??true} onClick={()=>engine.current?.toggleGrid()}>グリッド：{hud?.grid?'表示':'非表示'}</button>
   <div className="operation-guide"><p>← → 連続移動 / ↑ X・Z 回転<br/>↓ ソフト / Space ハードドロップ<br/>P・Esc 一時停止</p><p>半透明の筐体が固定候補。近くの接触面に吸着します。横360px以上で、その充填区間だけを消去。</p><p>固定台数に価格÷1000点。消去面積・同時消去・連鎖で追加得点。</p></div>
  </aside>
  <div className="touch-group cl tetris-buttons">{button('left','◀','左移動')}{button('right','▶','右移動')}{button('pause','❚❚','一時停止')}</div>
  <div className="touch-group cr tetris-buttons">{button('rotateL','↶','左回転')}{button('rotateR','↷','右回転')}{button('soft','▼','ソフトドロップ')}{button('hard','⤓','ハードドロップ')}</div>
  {hud?.paused&&!result&&<PauseOverlay settings={settings} onSettings={onSettings} onResume={()=>engine.current?.resume()} onRestart={retry} onTitle={onTitle}/>}
  {result&&<div className="overlay" data-testid="tetris-result"><section className="panel"><h2>テトリスモード 終了</h2><p>スコア {result.points} / 消去 {result.lines}区間 / 最大{result.chain}連鎖</p><p>ハイスコア {best.bestScore}</p><button className="btn primary" data-testid="tetris-retry" onClick={retry}>もう一度遊ぶ</button><button className="btn" onClick={onTitle}>タイトルへ</button></section></div>}
 </main>;
}

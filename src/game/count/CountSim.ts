import { GameSim,type SimCallbacks,type SimOptions } from '../engine/GameSim';
import { StackCounter,overlapsBoard } from './StackCounter';
import { CELL,STEP_MS } from '../config';
import { deviceCells } from '../../data/gameModes';
import { rectVertices } from '../physics/geometry';
import type { SpawnTicket } from '../systems/spawner';

export const SPAWN_BLOCK_TIMEOUT_S=3;
export interface CountSnapshot {current:number;peak:number;blockedSeconds:number;timeoutSeconds:number}
/** Classic physics with different completion/counting rules, no second world. */
export class CountSim extends GameSim {
 readonly counter=new StackCounter();
 private pending:SpawnTicket|null=null;
 private blockedSeconds=0;
 private spawnAutomatically:boolean;
 constructor(cb:SimCallbacks={},opts:Omit<SimOptions,'mode'>={}){
  super(cb,{...opts,mode:'classic',autoSpawn:false});
  this.spawnAutomatically=opts.autoSpawn??true;
  if(this.spawnAutomatically)this.spawnNext();
 }
 count():CountSnapshot{return {current:this.counter.current,peak:this.counter.peak,blockedSeconds:this.blockedSeconds,timeoutSeconds:SPAWN_BLOCK_TIMEOUT_S};}
 override spawnNext(){
  if(this.active||this.status!=='running')return null;
  return this.spawnTicket(this.pending??this.spawner.next());
 }
 override spawnTicket(ticket:SpawnTicket){
  if(this.active||this.status!=='running')return null;
  const d=deviceCells(ticket.kind,'classic'),cx=(Math.floor((this.board.cols-d.w)/2)+d.w/2)*CELL,cy=d.h*CELL/2;
  if(this.overlapsAny(rectVertices(cx,cy,d.w*CELL,d.h*CELL,0),null)){this.pending=ticket;return null;}
  this.pending=null;this.blockedSeconds=0;
  return super.spawnTicket(ticket);
 }
 override nextTicket(){return this.pending??super.nextTicket();}
 override checkRows(_rows?:number[]){return 0;}
 protected override updateDanger(_dt:number):void {/* Height alone never ends this challenge. */}
 protected override cullEscaped():void {
  const removed=new Set<number>();
  for(const e of [...this.entities.values()]){
   const maxY=Math.max(...e.body.vertices.map(p=>p.y));
   // Above the ceiling is retained: gravity can return it to the board.
   if(maxY>=0&&!overlapsBoard(e,this.board)){
    removed.add(e.individualId);this.escaped++;this.ledger.removeEntity(e.id);this.removeEntityBody(e);
   }
  }
  for(const id of removed)if(![...this.entities.values()].some(e=>e.individualId===id))this.counter.retire(id);
 }
 override step():void {
  if(this.status!=='running')return;
  super.step();
  this.counter.update(this.entities.values(),this.board);
  if(!this.active&&(this.spawnAutomatically||this.pending)){
   if(!this.spawnNext()){
    this.blockedSeconds+=STEP_MS/1000;
    if(this.blockedSeconds+1e-9>=SPAWN_BLOCK_TIMEOUT_S)this.gameOver('spawn');
   }
  }
 }
}

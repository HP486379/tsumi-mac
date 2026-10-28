import { TetrisSim } from './TetrisSim';
import { REAL_BOARD } from '../board';
import { Renderer,type RenderState } from '../rendering/renderer';
import { ObliqueRenderer } from '../rendering/obliqueRenderer';
import { FrameViews } from '../rendering/frameViews';
import { FixedStepper } from '../engine/loop';
import type { Action } from '../systems/input';
import type { AudioManager } from '../systems/audio';
import type { DeviceKind } from '../../data/devices';
import { canPlace } from './geometry';

export interface TetrisHud {points:number;lines:number;chain:number;level:number;devices:number;next:DeviceKind;grid:boolean;paused:boolean;over:boolean}
export interface TetrisDebug {
 state:()=>{points:number;lines:number;chain:number;active:TetrisSim['active'];locked:TetrisSim['locked'];ghost:TetrisSim['active'];paused:boolean;over:boolean;grid:boolean};
 views:()=>{front:RenderState|null;oblique:RenderState|null;synchronized:boolean};
 fixture:(pieces:{kind:DeviceKind;x:number;y:number;angle?:number}[],active?:DeviceKind,pose?:{x:number;y:number;angle?:number})=>void;
 resolve:()=>number;
}
export class TetrisEngine {
 sim:TetrisSim;paused=false;private reported=false;private raf=0;private last=0;private lastHud=0;private held=new Set<Action>();private stepper=new FixedStepper();
 private renderer:Renderer;private secondary:ObliqueRenderer|null=null;private views:FrameViews;
 constructor(canvas:HTMLCanvasElement,private audio:AudioManager,private update:(h:TetrisHud)=>void,private ended:(h:TetrisHud)=>void,private seed=42){this.sim=new TetrisSim(seed);this.renderer=new Renderer(canvas,REAL_BOARD);this.views=new FrameViews(this.renderer);}
 hud():TetrisHud{return {points:this.sim.points,lines:this.sim.lines,chain:this.sim.maxChain,level:this.sim.level,devices:this.sim.devices,next:this.sim.next().kind,grid:this.sim.gridVisible,paused:this.paused,over:this.sim.over};}
 start(){this.last=performance.now();this.audio.startBgm();this.update(this.hud());this.raf=requestAnimationFrame(this.frame);}
 private frame=(time:number)=>{const dt=time-this.last;this.last=time;if(!this.paused&&!this.sim.over){for(let i=0,n=this.stepper.advance(dt);i<n;i++){if(this.held.has('left'))this.sim.move(-3);if(this.held.has('right'))this.sim.move(3);this.sim.step(1000/60,this.held.has('soft'));}}
  this.draw();if(time-this.lastHud>120){this.lastHud=time;this.update(this.hud());}this.checkOver();if(!this.paused&&!this.sim.over)this.raf=requestAnimationFrame(this.frame);
 };
 private checkOver(){if(this.sim.over&&!this.reported){this.reported=true;this.audio.stopBgm();this.audio.play('gameover',1);this.ended(this.hud());}}
 draw(){this.renderer.setGridVisible(this.sim.gridVisible);this.secondary?.setGridVisible(this.sim.gridVisible);this.views.draw(this.sim.renderState());}
 resize(w:number,h:number,dpr:number){this.renderer.resize(w,h,dpr);this.draw();}
 attach(canvas:HTMLCanvasElement|null,w=600,h=1000,dpr=1){this.secondary=canvas?new ObliqueRenderer(canvas,this.renderer.sprites,REAL_BOARD):null;this.secondary?.resize(w,h,dpr);this.views.attach(this.secondary);this.draw();}
 resizeSecondary(w:number,h:number,dpr:number){this.secondary?.resize(w,h,dpr);this.draw();}
 pause(){if(this.paused||this.sim.over)return;this.paused=true;this.held.clear();cancelAnimationFrame(this.raf);this.audio.suspend();this.draw();this.update(this.hud());}
 resume(){if(!this.paused||this.sim.over)return;this.paused=false;this.stepper.reset();this.last=performance.now();this.audio.resume();this.update(this.hud());this.raf=requestAnimationFrame(this.frame);}
 press(a:Action){if(a==='pause'){this.paused?this.resume():this.pause();return;}if(this.paused||this.sim.over)return;if(this.held.has(a))return;this.held.add(a);
  if(a==='left')this.sim.move(-6);if(a==='right')this.sim.move(6);if(a==='rotateL'||a==='rotateR'){if(this.sim.rotate(a==='rotateL'?-1:1))this.audio.play('rotate',.5);}if(a==='hard'){this.sim.hardDrop();this.audio.play('lock',.6);}this.draw();this.update(this.hud());this.checkOver();
 }
 release(a:Action){this.held.delete(a);}
 toggleGrid(){this.sim.gridVisible=!this.sim.gridVisible;this.draw();this.update(this.hud());}
 restart(){cancelAnimationFrame(this.raf);const grid=this.sim.gridVisible;this.sim=new TetrisSim(this.seed);this.sim.gridVisible=grid;this.reported=false;this.paused=false;this.held.clear();this.stepper.reset();this.audio.resume();this.start();this.draw();}
 debug():TetrisDebug{return {state:()=>structuredClone({points:this.sim.points,lines:this.sim.lines,chain:this.sim.maxChain,active:this.sim.active,locked:this.sim.locked,ghost:this.sim.ghost(),paused:this.paused,over:this.sim.over,grid:this.sim.gridVisible}),views:()=>({front:this.views.lastState,oblique:this.secondary?.lastState??null,synchronized:!!this.secondary&&this.views.lastState===this.secondary.lastState}),fixture:(pieces,active,pose)=>{this.sim=new TetrisSim(this.seed,false);for(const p of pieces)this.sim.place(p.kind,p.x,p.y,p.angle??0);if(active)this.sim.spawn(active);if(pose&&this.sim.active){const p={...this.sim.active,...pose};if(!canPlace(p,this.sim.locked))throw Error('Invalid active fixture');this.sim.active=p;}this.reported=false;this.draw();this.update(this.hud());this.checkOver();},resolve:()=>{const n=this.sim.resolve();this.draw();this.update(this.hud());return n;}};}
 destroy(){cancelAnimationFrame(this.raf);this.held.clear();this.views.attach(null);this.audio.stopBgm();}
}

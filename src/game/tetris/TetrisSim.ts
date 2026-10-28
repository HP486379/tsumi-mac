import { DEVICES,type DeviceKind } from '../../data/devices';
import { realSize } from '../../data/gameModes';
import type { RenderItem,RenderState } from '../rendering/renderer';
import { Spawner } from '../systems/spawner';
import { EPS,bounds,polygons,canPlace,travel,landing,findRegions,cutPiece,DEFAULT_LINE_RULES,type SnapPiece,type ClearRegion,type LineRules } from './geometry';
import { polygonArea } from '../physics/geometry';

export class TetrisSim {
 readonly spawner:Spawner;
 locked:SnapPiece[]=[];active:SnapPiece|null=null;over=false;timeMs=0;points=0;lines=0;maxChain=0;devices=0;lastRegions:ClearRegion[]=[];clearLife=0;gridVisible=true;
 readonly rules:LineRules={...DEFAULT_LINE_RULES};
 private id=1;private grounded=0;
 constructor(seed=42,autoSpawn=true){this.spawner=new Spawner(seed);if(autoSpawn)this.spawn();}
 get level(){return 1+Math.floor(this.lines/5);}
 next(){return this.spawner.peek();}
 spawn(kind?:DeviceKind){if(this.over)return null;const ticket=this.spawner.next(),k=kind??ticket.kind,d=realSize(k),p={id:this.id++,kind:k,x:270,y:d.h/2,angle:0};if(!canPlace(p,this.locked)){this.over=true;this.active=null;return null;}this.active=p;this.grounded=0;return p;}
 ghost(){return this.active?landing(this.active,this.locked):null;}
 move(dx:number){const p=this.active;if(!p||this.over)return false;const b=bounds(p),amount=Math.min(Math.abs(dx),dx<0?b.minX:540-b.maxX,travel(p,this.locked,Math.sign(dx),0));if(amount<EPS)return false;p.x+=Math.sign(dx)*amount;this.grounded=0;return true;}
 rotate(dir:-1|1){const p=this.active;if(!p||this.over)return false;const rotated={...p,angle:((Math.round(p.angle/(Math.PI/2))+dir+4)%4)*Math.PI/2},b=bounds(rotated),x=p.x+Math.max(0,-b.minX)-Math.max(0,b.maxX-540);
  const y=p.y+Math.max(0,-b.minY)-Math.max(0,b.maxY-900);
  for(const dy of [0,-6,-12,-24]){const candidate={...rotated,x,y:y+dy};if(bounds(candidate).minY>=-EPS&&canPlace(candidate,this.locked)){this.active=candidate;this.grounded=0;return true;}}return false;
 }
 step(ms:number,soft=false){if(this.over||!this.active)return;this.timeMs+=ms;this.clearLife=Math.max(0,this.clearLife-ms);const distance=travel(this.active,this.locked,0,1),fall=Math.min(distance,(soft?600:90+this.level*10)*ms/1000);this.active.y+=fall;
  if(distance-fall<=EPS){this.grounded+=ms;if(this.grounded>=250)this.lock();}else this.grounded=0;
 }
 hardDrop(){if(!this.active||this.over)return;this.active=this.ghost();this.lock();}
 lock(){const p=this.ghost();if(!p)return;this.locked.push({...p});this.active=null;this.devices++;this.points+=Math.round(DEVICES[p.kind].price/1000);this.resolve();if(this.locked.some(p=>bounds(p).minY<-EPS)){this.over=true;return;}this.spawn();}
 /** Deterministic down-only settling: no Matter, rotation, impulses or drift.
  * Only called as part of a clear transaction, never for ordinary fixed Macs. */
 settle(){let changed=false;for(let pass=0;pass<this.locked.length+1;pass++){let moved=false;for(const p of [...this.locked].sort((a,b)=>bounds(b).maxY-bounds(a).maxY||a.id-b.id)){
   const distance=travel(p,this.locked.filter(q=>q.id!==p.id),0,1);if(distance>EPS){p.y+=distance;moved=true;changed=true;}
  }if(!moved)break;}return changed;}
 resolve(){let chain=0;this.lastRegions=[];
  // Every successful pass removes positive area from a finite board. Finish
  // the complete transaction before allowing another active Mac to appear.
  while(true){const regions=findRegions(this.locked,this.rules);if(!regions.length)break;
   let removed=0;this.locked=this.locked.flatMap(p=>{const result=cutPiece(p,regions,()=>this.id++);removed+=result.removedArea;return result.pieces;});if(removed<EPS)break;
   chain++;this.lines+=regions.length;this.points+=Math.round(removed/36)+100*regions.length*regions.length*chain;this.lastRegions.push(...regions);this.settle();
  }this.maxChain=Math.max(this.maxChain,chain);if(chain)this.clearLife=450;return chain;
 }
 /** Deterministic fixture API; rejects overlap, unlike the physical modes'
  * placement helper. It does not purchase or score a Mac. */
 place(kind:DeviceKind,x:number,y:number,angle=0){const p={id:this.id++,kind,x,y,angle};if(!canPlace(p,this.locked))throw Error('Invalid overlapping/outside fixture');this.locked.push(p);return p;}
 renderItem(p:SnapPiece,active=false):RenderItem{const d=realSize(p.kind),g=p.geometry,b=g?{w:Math.max(...g.outline.map(v=>v.x))-Math.min(...g.outline.map(v=>v.x)),h:Math.max(...g.outline.map(v=>v.y))-Math.min(...g.outline.map(v=>v.y))}:d;return {x:p.x,y:p.y,angle:p.angle,active,key:{kind:p.kind,mode:'real',wCells:b.w/36,hCells:b.h/36,geometry:g,refurb:false,cutTop:!!g,cutBottom:!!g}};}
 renderState():RenderState{const ghost=this.ghost();return {items:[...this.locked.map(p=>this.renderItem(p)),...(this.active?[this.renderItem(this.active,true)]:[])],ghost:ghost?this.renderItem(ghost):undefined,clearRegions:this.clearLife>0?this.lastRegions:undefined,guide:null,dangerRatio:0,floaters:[],flashes:[],shake:0,timeMs:this.timeMs};}
 get area(){return this.locked.flatMap(polygons).reduce((s,p)=>s+polygonArea(p),0);}
}

import { CLASSIC_VIEW,type ObliqueViewport } from '../board';
import { chassisMesh, modelDimensions, type V3 } from './chassisMesh';
import type { RenderItem } from './renderer';
import { chassisPose, projectWorld, worldFromLocal } from './chassisProjection';

/** Canvas fallback for devices with WebGL disabled. Shares the mesh and a single
 * per-pixel Z buffer, so fallback never reintroduces the sprite/box seam. */
export class SoftwareChassis {
  readonly canvas=document.createElement('canvas');
  private ctx=this.canvas.getContext('2d')!;
  private cache=new Map<string,ReturnType<typeof chassisMesh>>();
  draw(items:readonly RenderItem[],width:number,height:number,view:Readonly<ObliqueViewport>=CLASSIC_VIEW):HTMLCanvasElement {
    // Bound fallback work independently of display DPR.
    const scale=Math.min(1,width/view.width,height/view.height),w=Math.round(view.width*scale),h=Math.round(view.height*scale);
    this.canvas.width=w;this.canvas.height=h;
    const frame=this.ctx.createImageData(w,h),zBuffer=new Float32Array(w*h).fill(Infinity);
    for(const item of items) {
      const key=JSON.stringify(item.key);let mesh=this.cache.get(key);
      if(!mesh) {mesh=chassisMesh(item);this.cache.set(key,mesh);if(this.cache.size>256)this.cache.delete(this.cache.keys().next().value!);}
      const d=modelDimensions(item),source=item.key.geometry?.source,dim={...d,w:source?.w??d.w,h:source?.h??d.h},pose=chassisPose(item),c=Math.cos(item.angle),s=Math.sin(item.angle);
      const vertices=mesh.map(v=>{
        const world=worldFromLocal(pose,v.p),screen=projectWorld(...world);
        return {x:screen.x*scale,y:(screen.y+view.offsetY)*scale,p:v.p,n:v.n};
      });
      for(let i=0;i<vertices.length;i+=3) {
        const a=vertices[i]!,b=vertices[i+1]!,d=vertices[i+2]!;
        const area=(b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x);if(Math.abs(area)<1e-9)continue;
        const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,d.x))),maxX=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,d.x)));
        const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,d.y))),maxY=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,d.y)));
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
          const u=((b.x-x-.5)*(d.y-y-.5)-(b.y-y-.5)*(d.x-x-.5))/area;
          const v=((d.x-x-.5)*(a.y-y-.5)-(d.y-y-.5)*(a.x-x-.5))/area,t=1-u-v;
          if(Math.min(u,v,t)<-1e-7)continue;
          const z=u*a.p[2]+v*b.p[2]+t*d.p[2],idx=y*w+x;if(z>=zBuffer[idx]!)continue;
          zBuffer[idx]=z;
          const p=a.p.map((n,j)=>u*n+v*b.p[j]!+t*d.p[j]!) as V3;
          p[0]+=source?.offsetX??0;p[1]+=source?.offsetY??0;
          const nn=a.n.map((n,j)=>u*n+v*b.n[j]!+t*d.n[j]!) as V3,len=Math.hypot(...nn)||1;
          const n=nn.map(n=>n/len) as V3,scaled:V3=[n[0]/pose.sx,n[1]/pose.sy,n[2]],normalLength=Math.hypot(...scaled);
          const world:V3=[(c*scaled[0]-s*scaled[1])/normalLength,(s*scaled[0]+c*scaled[1])/normalLength,scaled[2]/normalLength];
          const dot=Math.max(0,(-.35*world[0]-.8*world[1]-.6*world[2])/1.059),light=.68+.38*dot;
          let color=[.70*light,.73*light,.77*light];
          if(item.key.mode==='real')color=[.76*light,.78*light,.81*light];
          if(item.key.kind==='macPro2013') {
            const shine=Math.pow(Math.max(0,(-.25*world[0]-.2*world[1]-world[2])/1.05),10);
            color=[.035+.26*shine,.043+.29*shine,.055+.33*shine];
            if(n[1]<-.8) {const r=Math.hypot(p[0],p[2]-dim.depth/2)/(dim.w/2);color=r>.8?[.23,.25,.28]:[.018,.022,.028];}
            if((item.key.cutTop&&n[1]<-.8)||(item.key.cutBottom&&n[1]>.8))color=[.12,.14,.17];
            if(item.key.refurb&&n[2]<-.93&&p[0]>dim.w*.17&&p[1]<-dim.h*.15)color=[.1,.55,.34];
          } else {
            if(n[2]<-.93 && item.key.kind!=='pro') {
              const py=p[1]/dim.h,x=p[0]/dim.w;
              if(item.key.mode==='real'&&item.key.kind==='miniM4'){
                const y=p[1]/dim.w-dim.h/dim.w*.13;
                const port=(cx:number)=>{const qx=Math.abs(x-cx)-3.2/127,qy=Math.abs(y)-.8/127;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-.65/127;};
                if(Math.min(port(-20/127),port(-1/127),Math.hypot(x-24/127,y)-1.75/127)<0)color=[.045,.052,.06];
              }else if((item.key.kind==='studio'||item.key.kind==='miniM4')&&py>.13&&py<.27) {
                if((x>-.33&&x<-.28)||(x>-.21&&x<-.16)||(dim.w>50&&x>-.03&&x<.17&&py>.17&&py<.21))color=[.09,.11,.13];
              }
              if(Math.abs(p[0]-dim.w*.35)<1&&Math.abs(p[1]-dim.h*.12)<.75)color=[.87,.98,.9];
            }
            if(item.key.kind==='pro' && n[2]<-.93 && Math.abs(p[0])<dim.w*.4 && Math.abs(p[1])<dim.h*.4) {
              const yy=p[1]/3.4,xx=p[0]/3.4+((Math.floor(yy)%2+2)%2)*.5;
              if(Math.hypot(xx-Math.floor(xx)-.5,yy-Math.floor(yy)-.5)<.3) color=[.15,.18,.21];
            }
            if(!item.key.cutBottom && p[1]>dim.h/2-1.3)color=color.map(n=>n*.48);
            if((item.key.cutTop&&n[1]<-.8)||(item.key.cutBottom&&n[1]>.8))color=[.34,.37,.41];
            if(item.key.refurb&&n[2]<-.93&&p[0]>dim.w*.17&&p[1]<-dim.h*.15)color=[.1,.55,.34];
          }
          for(let j=0;j<3;j++) frame.data[idx*4+j]=255*(item.active?color[j]!*.87+[.5,.83,1][j]!*.13:color[j]!);
          frame.data[idx*4+3]=255;
        }
      }
    }
    this.ctx.putImageData(frame,0,0);return this.canvas;
  }
  dispose():void { this.cache.clear(); }
}

import { ChassisRenderer } from '../../src/game/rendering/chassisRenderer';
import { chassisMesh } from '../../src/game/rendering/chassisMesh';
import { projectLocal } from '../../src/game/rendering/chassisProjection';
import type { RenderItem } from '../../src/game/rendering/renderer';

/** Independent triangle ray intersection (screen barycentrics), checked against
 * colors rendered by the real production shader, one chassis at a time.
 * Submission-order equality alone cannot establish correct visibility. */
export function depthAudit(items:RenderItem[]) {
  const w=400,h=704,renderer=new ChassisRenderer(),copy=document.createElement('canvas');copy.width=w;copy.height=h;
  const ctx=copy.getContext('2d')!;
  const pixels=(items:RenderItem[])=>{ctx.clearRect(0,0,w,h);ctx.drawImage(renderer.draw(items,w,h),0,0);return ctx.getImageData(0,0,w,h).data;};
  const actual=pixels(items),solo=items.map(item=>pixels([item]));
  const maps=items.map(item=>{
    const depths=new Float64Array(w*h).fill(Infinity),margins=new Float32Array(w*h);
    const mesh=chassisMesh(item).map(v=>projectLocal(item,v.p));
    for(let i=0;i<mesh.length;i+=3) {
      const a=mesh[i]!,b=mesh[i+1]!,c=mesh[i+2]!,area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if(Math.abs(area)<1e-10)continue;
      for(let y=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y)));y<=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));y++)
      for(let x=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x)));x<=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));x++) {
        const u=((b.x-x-.5)*(c.y-y-.5)-(b.y-y-.5)*(c.x-x-.5))/area;
        const v=((c.x-x-.5)*(a.y-y-.5)-(c.y-y-.5)*(a.x-x-.5))/area,t=1-u-v;
        if(Math.min(u,v,t)<0)continue;
        const z=u*a.z+v*b.z+t*c.z,index=y*w+x;
        if(z<depths[index]!) {depths[index]=z;margins[index]=Math.min(u,v,t);}
      }
    }
    return {depths,margins};
  });
  const winners=new Int16Array(w*h).fill(-1);
  for(let index=0;index<w*h;index++) {let z=Infinity;maps.forEach((m,i)=>{if(m.depths[index]!<z){z=m.depths[index]!;winners[index]=i;}});}
  let samples=0,mismatches=0,maxColorError=0;const examples=[];
  for(let index=0;index<w*h;index++) {
    const hits=maps.map((m,i)=>({i,z:m.depths[index]!,margin:m.margins[index]!})).filter(v=>Number.isFinite(v.z)).sort((a,b)=>a.z-b.z);
    if(hits.length<2||hits[1]!.z-hits[0]!.z<.1||hits[0]!.margin<.04)continue;
    const near=hits[0]!,far=hits[1]!;
    // MSAA resolves several subpixel owners at silhouette boundaries. Such
    // mixed pixels cannot be compared to a center-ray single-owner oracle.
    const x=index%w,y=Math.floor(index/w);
    if(x<1||y<1||x>=w-1||y>=h-1||[-w-1,-w,-w+1,-1,1,w-1,w,w+1].some(offset=>winners[index+offset]!==near.i))continue;
    if(solo[near.i]![index*4+3]!==255||solo[far.i]![index*4+3]!==255)continue;
    const error=Math.max(...[0,1,2].map(channel=>Math.abs(actual[index*4+channel]!-solo[near.i]![index*4+channel]!)));
    // Identical colors cannot identify an owner. Require a distinguishable
    // far color as well, and allow two bytes for GPU precision/raster rounding.
    const separation=Math.max(...[0,1,2].map(ch=>Math.abs(solo[near.i]![index*4+ch]!-solo[far.i]![index*4+ch]!)));
    if(separation<8)continue;
    samples++;maxColorError=Math.max(maxColorError,error);
    if(error>2) {mismatches++;if(examples.length<12)examples.push({x:index%w,y:Math.floor(index/w),near:items[near.i]!.key.kind,nearZ:near.z,farZ:far.z,error});}
  }
  return {samples,mismatches,maxColorError,examples};
}

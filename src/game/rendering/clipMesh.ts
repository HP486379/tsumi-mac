import type { MeshVertex,V3 } from './chassisMesh';
import type { FragmentGeometry } from '../../data/gameModes';
/** Clip and cap a source solid against the convex fragment's XY prism. */
export function clipMesh(mesh:MeshVertex[],geometry:FragmentGeometry):MeshVertex[] {
  const parts=new Map<number,MeshVertex[]>();
  for(let i=0;i<mesh.length;i+=3){const part=mesh[i]!.part??0;const group=parts.get(part)??[];group.push(...mesh.slice(i,i+3));parts.set(part,group);}
  return [...parts.values()].flatMap(part=>clipConvex(part,geometry));
}
function clipConvex(mesh:MeshVertex[],geometry:FragmentGeometry):MeshVertex[] {
  let result=mesh.map(v=>({p:[v.p[0]-geometry.source.offsetX,v.p[1]-geometry.source.offsetY,v.p[2]] as V3,n:v.n}));
  const poly=geometry.outline,area=poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length]!;return s+a.x*b.y-b.x*a.y;},0),sign=area>=0?1:-1;
  for(let edge=0;edge<poly.length;edge++){
    const a=poly[edge]!,b=poly[(edge+1)%poly.length]!,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-9)continue;
    const distance=(v:MeshVertex)=>sign*(dx*(v.p[1]-a.y)-dy*(v.p[0]-a.x))/len;
    const next:MeshVertex[]=[],cuts:V3[]=[];
    for(let i=0;i<result.length;i+=3){const input=result.slice(i,i+3),out:MeshVertex[]=[],ds=input.map(distance),inside=ds.some(d=>d>1e-8);
      // A coplanar surface facing the discarded volume has no retained solid
      // behind it. Keeping it would create paper-thin ghost strips on feet.
      const outward:V3=[sign*dy/len,-sign*dx/len,0];
      if(ds.every(d=>Math.abs(d)<=1e-8)&&input.reduce((sum,v)=>sum+v.n[0]*outward[0]+v.n[1]*outward[1],0)<-1)continue;
      for(let j=0;j<3;j++){const u=input[j]!,v=input[(j+1)%3]!,du=distance(u),dv=distance(v);
        if(du>=-1e-8)out.push(u);
        if(inside&&Math.abs(du)<=1e-8)cuts.push(u.p);
        if((du>1e-8&&dv< -1e-8)||(du< -1e-8&&dv>1e-8)){const t=du/(du-dv),p=u.p.map((x,k)=>x+(v.p[k]!-x)*t) as V3,n=u.n.map((x,k)=>x+(v.n[k]!-x)*t) as V3;const mag=Math.hypot(...n)||1;out.push({p,n:n.map(x=>x/mag) as V3});cuts.push(p);}
      }
      for(let j=1;j<out.length-1;j++)next.push(out[0]!,out[j]!,out[j+1]!);
    }
    const points=[...new Map(cuts.map(p=>[p.map(x=>x.toFixed(7)).join(','),p])).values()].map(p=>({p,u:(p[0]*dx+p[1]*dy)/len,v:p[2]})).sort((a,b)=>a.u-b.u||a.v-b.v);
    const cross=(o:typeof points[number],a:typeof points[number],b:typeof points[number])=>(a.u-o.u)*(b.v-o.v)-(a.v-o.v)*(b.u-o.u);
    const lower:typeof points=[],upper:typeof points=[];
    for(const p of points){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=1e-9)lower.pop();lower.push(p);}
    for(const p of [...points].reverse()){while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=1e-9)upper.pop();upper.push(p);}
    const hull=lower.slice(0,-1).concat(upper.slice(0,-1)),normal:V3=[sign*dy/len,-sign*dx/len,0];
    for(let j=1;j<hull.length-1;j++)next.push({p:hull[0]!.p,n:normal},{p:hull[j]!.p,n:normal},{p:hull[j+1]!.p,n:normal});
    result=next;
  }return result;
}

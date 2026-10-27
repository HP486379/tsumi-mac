/** User-specified millimetres. Kept separate from the gameplay cell dimensions
 * and the existing official-dimensions ledger (M2 there is 35.8mm). */
export type MiniKind='miniM1'|'miniM2'|'miniM4';
export const MINI_KINDS:MiniKind[]=['miniM1','miniM2','miniM4'];
export const MINI_MM={miniM1:{w:197,h:36,d:197},miniM2:{w:197,h:36,d:197},miniM4:{w:127,h:50,d:127}} as const;
export interface MiniVertex {p:[number,number,number];n:[number,number,number]}
export function referenceMesh(kind:MiniKind,scale=1):MiniVertex[] {
  const dim=MINI_MM[kind],w=dim.w*scale,h=dim.h*scale,d=dim.d*scale;
  // Approximate design radii, not claimed Apple CAD measurements. M4 has a
  // larger corner radius relative to its footprint and a continuous top roll.
  const radius=(kind==='miniM4'?27:30)*scale,bevel=(kind==='miniM4'?2.4:1.2)*scale;
  const rings:MiniVertex[][]=[];
  for(const bottom of [false,true])for(const step of bottom?[6,5,4,3,2,1,0]:[0,1,2,3,4,5,6]) {
    const a=step*Math.PI/12,inset=bevel*(1-Math.sin(a));
    const y=bottom?h/2-bevel*(1-Math.cos(a)):-h/2+bevel*(1-Math.cos(a));
    const ring:MiniVertex[]=[];
    for(let corner=0;corner<4;corner++)for(let j=0;j<=24;j++) {
      const t=-Math.PI+corner*Math.PI/2+j*Math.PI/48,nx=Math.cos(t),nz=Math.sin(t);
      const cx=(corner===0||corner===3?-1:1)*(w/2-radius),cz=corner<2?radius:d-radius;
      ring.push({p:[cx+(radius-inset)*nx,y,cz+(radius-inset)*nz],n:[nx*Math.sin(a),(bottom?1:-1)*Math.cos(a),nz*Math.sin(a)]});
    }
    rings.push(ring);
  }
  const mesh:MiniVertex[]=[],count=rings[0]!.length;
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<count;i++) {
    const j=(i+1)%count,a=rings[r]![i]!,b=rings[r]![j]!,c=rings[r+1]![j]!,d=rings[r+1]![i]!;mesh.push(a,b,c,a,c,d);
  }
  for(const r of [0,rings.length-1])for(let i=0;i<count;i++) {
    const n:[number,number,number]=[0,r===0?-1:1,0],ring=rings[r]!;
    mesh.push({p:[0,ring[0]!.p[1],d/2],n},{p:ring[i]!.p,n},{p:ring[(i+1)%count]!.p,n});
  }
  return mesh;
}
export function auditReference() {
  const scale=72/197;
  return MINI_KINDS.map(kind=>{
    const d=MINI_MM[kind],vertices=referenceMesh(kind),axis=(i:number)=>Math.max(...vertices.map(v=>v.p[i]!))-Math.min(...vertices.map(v=>v.p[i]!));
    const physics={w:kind==='miniM4'?36:72,h:36};
    return {kind,mm:d,measured:{w:axis(0),h:axis(1),d:axis(2)},scalePxPerMm:scale,
      commonScalePx:{w:d.w*scale,h:d.h*scale,d:d.d*scale},physics,
      fixedCenterStackGap:physics.h-d.h*scale,widthMismatch:d.w*scale-physics.w,
      widthHeightRatio:d.w/d.h,depthWidthRatio:d.d/d.w};
  });
}

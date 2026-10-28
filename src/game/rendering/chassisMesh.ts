/** Oblique model-space geometry uses one px/cm scale. chassisProjection maps
 * its XY envelope to Matter's dimensions and pivot; Z retains the model depth.
 * No independent depth squash or front sprite is used. */
import { DEVICES } from '../../data/devices';
import { OFFICIAL_DIMENSIONS } from '../../data/officialDimensions';
import { CELL } from '../config';
import type { RenderItem } from './renderer';
import { realSize,REAL_PX_PER_MM } from '../../data/gameModes';
import { clipMesh } from './clipMesh';

export type V3 = [number, number, number];
export interface MeshVertex { p: V3; n: V3; part?:number }
export function modelDimensions(item: RenderItem) {
  if(item.key.mode==='real')return {w:item.key.wCells*CELL,h:item.key.hCells*CELL,depth:realSize(item.key.kind).depth,scale:REAL_PX_PER_MM*10};
  const d = OFFICIAL_DIMENSIONS[item.key.kind], spec = DEVICES[item.key.kind];
  const scale = Math.min(spec.w * CELL / d.widthCm, spec.h * CELL / d.heightCm);
  return { w: d.widthCm * scale * item.key.wCells / spec.w,
    h: d.heightCm * scale * item.key.hCells / spec.h, depth: d.depthCm * scale, scale };
}

/** Rounded X/Z footprint swept vertically, with shared quarter-circle bevel rings.
 * Normals are analytic: adjacent top/front/side surfaces share the same vertices. */
export function chassisMesh(item: RenderItem): MeshVertex[] {
  if(item.key.geometry){const g=item.key.geometry;return clipMesh(chassisMesh({...item,key:{...item.key,wCells:g.source.w/CELL,hCells:g.source.h/CELL,geometry:undefined,cutTop:false,cutBottom:false}}),g);}
  const { w, h, depth } = modelDimensions(item), cylinder = item.key.kind === 'macPro2013';
  const realMini=item.key.mode==='real'&&item.key.kind.startsWith('mini');
  const radius = cylinder ? w / 2 : realMini?w*(item.key.kind==='miniM4'?27/127:30/197):Math.min(w, depth) * (item.key.kind === 'pro' ? 0.075 : 0.19);
  const bevel = realMini?Math.min(h*.15,(item.key.kind==='miniM4'?2.4:1.2)*REAL_PX_PER_MM):Math.min(h * 0.15, w * 0.024);
  const tower = item.key.kind === 'pro';
  const topTrim = tower && !item.key.cutTop ? Math.min(7, h*.15) : 0;
  const bottomTrim = tower && !item.key.cutBottom ? Math.min(3, h*.1) : 0;
  const rings: MeshVertex[][] = [];
  const levels = realMini?Array.from({length:7},(_,i)=>i*Math.PI/12):[0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
  for (const bottom of [false, true]) for (const angle of bottom ? [...levels].reverse() : levels) {
    const cut = bottom ? item.key.cutBottom : item.key.cutTop;
    const inset = cut ? 0 : bevel * (1 - Math.sin(angle));
    const y = bottom ? h / 2 - bottomTrim - (cut ? 0 : bevel * (1 - Math.cos(angle))) : -h / 2 + topTrim + (cut ? 0 : bevel * (1 - Math.cos(angle)));
    const ring: MeshVertex[] = [];
    for (let corner = 0; corner < 4; corner++) for (let j = 0; j <= 12; j++) {
      const t = -Math.PI + corner * Math.PI / 2 + j / 12 * Math.PI / 2;
      const nx = Math.cos(t), nz = Math.sin(t);
      const cx = cylinder ? 0 : (corner === 0 || corner === 3 ? -1 : 1) * (w / 2 - radius);
      const cz = cylinder ? depth / 2 : (corner < 2 ? radius : depth - radius);
      ring.push({ p: [cx + (radius - inset) * nx, y, cz + (radius - inset) * nz],
        n: [nx * (cut ? 1 : Math.sin(angle)), (bottom ? 1 : -1) * (cut ? 0 : Math.cos(angle)), nz * (cut ? 1 : Math.sin(angle))] });
    }
    rings.push(ring);
  }
  const mesh: MeshVertex[] = [], count = rings[0]!.length;
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < count; i++) {
    const j = (i + 1) % count, a = rings[r]![i]!, b = rings[r]![j]!, c = rings[r+1]![j]!, d = rings[r+1]![i]!;
    mesh.push(a,b,c,a,c,d);
  }
  for (const r of [0, rings.length - 1]) {
    const ring = rings[r]!, normal: V3 = [0, r === 0 ? -1 : 1, 0];
    const center: MeshVertex = { p: [0, ring[0]!.p[1], depth / 2], n: normal };
    for (let i=0;i<count;i++) mesh.push(center,{p:ring[i]!.p,n:normal},{p:ring[(i+1)%count]!.p,n:normal});
  }
  // Polished tubular rails and feet belong to the same depth-tested solid.
  let component=0;
  const tube = (a: V3, b: V3, radius: number) => {
    const begin=mesh.length,part=++component;
    const axis=b.map((v,i)=>v-a[i]!) as V3, len=Math.hypot(...axis);
    const n=axis.map(v=>v/len) as V3;
    const u:V3=Math.abs(n[1])>.9?[1,0,0]:[0,1,0];
    const v:V3=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
    const at=(p:V3,t:number):MeshVertex=>{const normal=u.map((x,i)=>x*Math.cos(t)+v[i]!*Math.sin(t)) as V3;return {p:p.map((x,i)=>x+radius*normal[i]!) as V3,n:normal};};
    for(let i=0;i<12;i++) {
      const t=i*Math.PI/6,next=(i+1)*Math.PI/6;
      mesh.push(at(a,t),at(b,t),at(b,next),at(a,t),at(b,next),at(a,next));
      for(const [p,sign] of [[a,-1],[b,1]] as const) {
        const normal=n.map(x=>x*sign) as V3;
        mesh.push({p,n:normal},{p:at(p,t).p,n:normal},{p:at(p,next).p,n:normal});
      }
    }
    for(let i=begin;i<mesh.length;i++)mesh[i]!.part=part;
  };
  if(tower) for(const x of [-w*.39,w*.39]) {
    if(!item.key.cutTop) {
      // The rail radius is 1.2: its upper surface must reach -h/2 so an
      // inverted tower rests on the same plane as its Matter envelope.
      const y=-h/2+1.2,z0=depth*.16,z1=depth*.84;
      tube([x,-h/2+topTrim,z0],[x,y,z0],1.2);
      tube([x,y,z0],[x,y,z1],1.2);
      tube([x,y,z1],[x,-h/2+topTrim,z1],1.2);
    }
    if(!item.key.cutBottom) for(const z of [depth*.12,depth*.88]) tube([x,h/2-bottomTrim,z],[x,h/2,z],1.5);
  }
  return mesh;
}

import { describe, expect, it } from 'vitest';
import { chassisMesh, modelDimensions } from '../game/rendering/chassisMesh';
import { DEVICE_KINDS, DEVICES, type DeviceKind } from '../data/devices';
import { OFFICIAL_DIMENSIONS } from '../data/officialDimensions';
import type { RenderItem } from '../game/rendering/renderer';
import { CELL } from '../game/config';

const item=(kind:DeviceKind):RenderItem=>({x:180,y:300,angle:0,active:false,key:{kind,wCells:DEVICES[kind].w,hCells:DEVICES[kind].h,refurb:false,cutTop:false,cutBottom:false}});
describe('model-space chassis geometry',()=>{
  it.each(DEVICE_KINDS)('%s uses a uniform model-space scale before the Matter XY mapping',kind=>{
    const d=modelDimensions(item(kind)),official=OFFICIAL_DIMENSIONS[kind];
    expect(d.w/official.widthCm).toBeCloseTo(d.h/official.heightCm);
    expect(d.depth/official.depthCm).toBeCloseTo(d.h/official.heightCm);
    expect(d.w).toBeLessThanOrEqual(DEVICES[kind].w*CELL);
    expect(d.h).toBeLessThanOrEqual(DEVICES[kind].h*CELL);
  });
  it.each(DEVICE_KINDS)('%s has closed seams and finite normalized normals',kind=>{
    const source=item(kind),before=JSON.stringify(source),mesh=chassisMesh(source);
    const edges=new Map<string,number>();
    const key=(p:number[])=>p.map(v=>v.toFixed(5)).join(',');
    for(let i=0;i<mesh.length;i+=3) {
      const tri=mesh.slice(i,i+3);
      for(const v of tri){expect(v.p.every(Number.isFinite)).toBe(true);expect(Math.hypot(...v.n)).toBeCloseTo(1);}
      const keys=tri.map(v=>key(v.p));if(new Set(keys).size<3)continue;
      for(let j=0;j<3;j++){const edge=[keys[j]!,keys[(j+1)%3]!].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
    }
    // Closed tubes overlap at embedded accessory junctions: coincident edges
    // can have two pairs, but there must be no unpaired/open boundary edge.
    expect([...edges.values()].every(n=>n>=2 && n%2===0)).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('mini is thin, Studio is thick, and the cylinder has a circular footprint',()=>{
    const mini=modelDimensions(item('miniM2')),studio=modelDimensions(item('studio')),cylinder=modelDimensions(item('macPro2013'));
    expect(mini.h/mini.w).toBeLessThan(.2);expect(studio.h/studio.w).toBeGreaterThan(.45);
    expect(cylinder.depth).toBe(cylinder.w);
  });
  it('row-clear fragments preserve parent depth and expose flat cut faces',()=>{
    const whole=item('studio'),fragment=item('studio');fragment.key.hCells=1;fragment.key.cutTop=true;
    expect(modelDimensions(fragment).depth).toBe(modelDimensions(whole).depth);
    const mesh=chassisMesh(fragment),top=-modelDimensions(fragment).h/2;
    expect(mesh.filter(v=>v.n[1]===-1).every(v=>Math.abs(v.p[1]-top)<1e-8)).toBe(true);
  });
});

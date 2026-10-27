import { describe,it,expect } from 'vitest';
import { MINI_KINDS,MINI_MM,referenceMesh,auditReference } from '../../tools/mini/reference';

describe('undistorted same-scale mini reference prototype',()=>{
  it.each(MINI_KINDS)('%s preserves all three user-specified millimetre dimensions',kind=>{
    const row=auditReference().find(r=>r.kind===kind)!;
    expect(row.measured.w).toBeCloseTo(MINI_MM[kind].w,10);expect(row.measured.h).toBeCloseTo(MINI_MM[kind].h,10);expect(row.measured.d).toBeCloseTo(MINI_MM[kind].d,10);
    expect(row.depthWidthRatio).toBe(1);
  });
  it('M4 has 64.47% of the width/depth and 138.89% of the height of M1/M2',()=>{
    expect(MINI_MM.miniM4.w/MINI_MM.miniM1.w).toBeCloseTo(127/197,12);
    expect(MINI_MM.miniM4.h/MINI_MM.miniM1.h).toBeCloseTo(50/36,12);
    expect(MINI_MM.miniM1).toEqual(MINI_MM.miniM2);
  });
  it('makes the fixed-center physics contradiction explicit instead of hiding it by stretching',()=>{
    const rows=auditReference();
    expect(rows[0]!.fixedCenterStackGap).toBeCloseTo(22.8426395939086,10);
    expect(rows[2]!.fixedCenterStackGap).toBeCloseTo(17.7258883248731,10);
    expect(rows[2]!.widthMismatch).toBeCloseTo(10.4162436548223,10);
  });
  it.each(MINI_KINDS)('%s is a closed rounded mesh with continuous unit normals',kind=>{
    const m=referenceMesh(kind),edges=new Map<string,number>(),key=(p:number[])=>p.map(v=>v.toFixed(7)).join(',');
    for(let i=0;i<m.length;i+=3){const tri=m.slice(i,i+3),ids=tri.map(v=>key(v.p));for(const v of tri)expect(Math.hypot(...v.n)).toBeCloseTo(1,10);if(new Set(ids).size<3)continue;for(let j=0;j<3;j++){const e=[ids[j]!,ids[(j+1)%3]!].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}}
    expect([...edges.values()].every(v=>v===2)).toBe(true);
    expect(m.some(v=>Math.abs(v.n[0])>.1&&Math.abs(v.n[2])>.1&&Math.abs(v.n[1])>.1)).toBe(true);
  });
});

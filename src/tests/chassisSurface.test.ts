import { describe,it,expect } from 'vitest';
import { auditSurfaces,FLAT_KINDS } from '../../tools/surface/audit';
import { DEVICE_KINDS } from '../data/devices';
import { chassisMesh,modelDimensions } from '../game/rendering/chassisMesh';
import { makeItem } from '../../tools/sync/audit';

const audit=auditSurfaces();
describe('actual surface contacts, separate from collision envelopes',()=>{
  it.each(FLAT_KINDS)('%s actual cap triangles meet every flat chassis at all tested rotations',kind=>{
    for(const p of audit.pairs.filter(p=>p.lowerKind===kind)) {
      expect(p.worldGap).toBeLessThan(1e-9);expect(p.screenGap).toBeLessThan(1e-9);
    }
  });
  it('thin mini caps meet without a fitted-position offset',()=>{
    expect(audit.oldMiniGap.worldGap).toBeLessThan(1e-9);
    expect(audit.miniGap.worldGap).toBeLessThan(1e-9);
  });
  it.each(DEVICE_KINDS)('%s actual surface reaches the floor in all four quadrants',kind=>{
    for(const g of audit.ground.filter(g=>g.kind===kind)) {expect(Math.abs(g.floorGap)).toBeLessThan(1e-9);expect(g.pivotError).toBe(0);}
  });
  it.each(DEVICE_KINDS)('%s retains curved side normals and bevels instead of a rectangular box',kind=>{
    const m=audit.morphology.find(m=>m.kind===kind)!;expect(m.curvedNormals).toBeGreaterThan(20);expect(m.bevelNormals).toBeGreaterThan(20);
    expect(m.maxZ-m.minZ).toBeGreaterThan(m.depth*.99);
  });
  it('retains the baseline depths on every model, independently of collision height',()=>{
    const expected={miniM1:72,miniM2:72,miniM4:72,studio:108,pro:144*45/52.9,macPro2013:108*16.7/25.1};
    for(const m of audit.morphology)expect(m.depth).toBeCloseTo(expected[m.kind],10);
  });
  it('Late 2013 retains a circular model-space footprint, not a rounded box',()=>{
    const item=makeItem('macPro2013'),d=modelDimensions(item);
    for(const v of chassisMesh(item).filter(v=>Math.abs(v.n[1])<1e-9))expect(Math.hypot(v.p[0],v.p[2]-d.depth/2)).toBeCloseTo(d.w/2,10);
  });
});

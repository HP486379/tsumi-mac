import { describe, expect, it } from 'vitest';
import { auditAll, ANGLES, makeItem } from '../../tools/sync/audit';
import { DEVICE_KINDS } from '../data/devices';
import { chassisPose, projectLocal, projectWorld } from '../game/rendering/chassisProjection';
import { modelDimensions } from '../game/rendering/chassisMesh';
import { GameSim } from '../game/engine/GameSim';
import { FrameViews } from '../game/rendering/frameViews';
import { FIELD_H } from '../game/config';

const audit=auditAll();
describe('Matter -> shared snapshot -> projection',()=>{
  it.each(audit.rows)('$kind / angle $angle: center, size, pivot and rotation agree',row=>{
    expect(row.stateCenterError).toBe(0);expect(row.stateAngleError).toBe(0);
    expect(row.modelAnchorError).toBeLessThan(1e-10);expect(row.anchorScreenError).toBeLessThan(1e-10);
    expect(Math.abs(row.widthError)).toBeLessThan(1e-10);expect(Math.abs(row.heightError)).toBeLessThan(1e-10);
    expect(row.rotationError).toBeLessThan(1e-10);expect(row.maxMathError).toBeLessThan(1e-10);
    expect(row.maxMatterVertexProjectionError).toBeLessThan(1e-10);
  });
  it.each(audit.contacts)('$kind / angle $angle: same-depth contact anchors coincide',row=>{
    expect(row.physicalContactError).toBeLessThan(1e-10);
    expect(row.verticalSilhouetteGap).toBeLessThan(1e-10);expect(row.horizontalSilhouetteGap).toBeLessThan(1e-10);
  });
  it.each(DEVICE_KINDS)('%s: settled Matter snapshot is shared by reference at every quadrant',kind=>{
    for(let q=0;q<4;q++) {
      const sim=new GameSim({}, {seed:42,autoSpawn:false,randomEvents:false});const e=sim.placeLocked(kind,4,1,q);
      for(let i=0;i<300;i++)sim.step();
      const state=sim.renderState(),item=state.items.find(i=>i.key.kind===kind)!;
      expect(item.x).toBe(e.body.position.x);expect(item.y).toBe(e.body.position.y);expect(item.angle).toBe(e.body.angle);
      // Matter broad-phase bounds include a velocity margin; measure the
      // actual collision vertices when checking floor solver penetration.
      expect(Math.abs(Math.max(...e.body.vertices.map(v=>v.y))-FIELD_H)).toBeLessThan(.2);
      const views=new FrameViews({draw:s=>expect(s).toBe(state)});
      views.attach({draw:s=>expect(s).toBe(state)});views.draw(state);
      expect(chassisPose(item).x).toBe(item.x);expect(chassisPose(item).y).toBe(item.y);sim.destroy();
    }
  });
  it('positive 90 degrees sends local X downward in both Canvas and projected XY',()=>{
    for(const kind of DEVICE_KINDS) {
      const item=makeItem(kind,180,300,Math.PI/2),dim=modelDimensions(item),p=projectLocal(item,[dim.w/2,0,0]),o=projectWorld(item.x,item.y);
      expect(p.x).toBeCloseTo(o.x,10);expect(p.y).toBeGreaterThan(o.y);
      item.angle=Math.PI;expect(projectLocal(item,[dim.w/2,0,0]).x).toBeLessThan(o.x);
    }
  });
  it('depth changes screen coordinates along the camera ray without changing XY contacts',()=>{
    const p=projectWorld(120,250,40),q=projectWorld(140,235.2,0);
    // Projection kernel: (-0.5, +0.37, +1). Multiple 3D points can share a pixel.
    expect(p.x).toBeCloseTo(q.x,10);expect(p.y).toBeCloseTo(q.y,10);
    expect(p).not.toEqual(projectWorld(120,250,0));
  });
  it('row fragments keep the physical pivot and their own logical dimensions',()=>{
    for(const kind of DEVICE_KINDS)for(const angle of ANGLES) {
      const item=makeItem(kind,180,300,angle);item.key.hCells=1;item.key.cutTop=true;
      const d=modelDimensions(item),pose=chassisPose(item);
      expect(pose.sy*d.h).toBeCloseTo(36,10);expect(pose.x).toBe(item.x);expect(pose.y).toBe(item.y);
    }
  });
});

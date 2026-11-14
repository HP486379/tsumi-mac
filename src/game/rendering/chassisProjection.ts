import { CELL } from '../config';
import { modelDimensions, type V3 } from './chassisMesh';
import type { RenderItem } from './renderer';

/** Cabinet projection of the common Matter XY plane; +Z points away. */
export const CAMERA = { a: .84, b: .12, d: .9, zx: .42, zy: -.273, tx: 28, ty: 38 } as const;
export interface Pose { x: number; y: number; angle: number; sx: number; sy: number }
/** Matter owns the XY envelope and pivot. Mesh dimensions retain their model
 * units, but their rendered XY extent must match the body's logical size.
 * This intentionally prioritizes game contacts over uniform real-world scale.
 * Z is unchanged; no depth compression or material change is involved. */
export function chassisPose(item: RenderItem): Pose {
  if(item.key.mode==='real')return {x:item.x,y:item.y,angle:item.angle,sx:1,sy:1};
  const dim = modelDimensions(item);
  return { x: item.x, y: item.y, angle: item.angle,
    sx: item.key.wCells * CELL / dim.w, sy: item.key.hCells * CELL / dim.h };
}
export function worldFromLocal(pose: Pose, p: V3): V3 {
  const c = Math.cos(pose.angle), s = Math.sin(pose.angle);
  return [pose.x + c * p[0] * pose.sx - s * p[1] * pose.sy,
    pose.y + s * p[0] * pose.sx + c * p[1] * pose.sy, p[2]];
}
export function projectWorld(x: number, y: number, z = 0): { x: number; y: number } {
  return { x: CAMERA.tx + CAMERA.a * x + CAMERA.zx * z,
    y: CAMERA.ty + CAMERA.b * x + CAMERA.d * y + CAMERA.zy * z };
}
export function projectLocal(item: RenderItem, p: V3) {
  const world = worldFromLocal(chassisPose(item), p);
  return { ...projectWorld(...world), z: world[2] };
}

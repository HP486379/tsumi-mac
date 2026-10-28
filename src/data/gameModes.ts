import { DEVICES,type DeviceKind } from './devices';
import { CELL } from '../game/config';
export type GameMode='classic'|'real';
/** One world scale for every axis/model. M2 uses the requested rounded 36mm. */
export const REAL_PX_PER_MM=72/197;
export const REAL_MM:Record<DeviceKind,{w:number;h:number;d:number}>={
  miniM1:{w:197,h:36,d:197},miniM2:{w:197,h:36,d:197},miniM4:{w:127,h:50,d:127},
  studio:{w:197,h:95,d:197},pro:{w:218,h:529,d:450},macPro2013:{w:167,h:251,d:167},
};
export function realSize(kind:DeviceKind){const d=REAL_MM[kind];return {w:d.w*REAL_PX_PER_MM,h:d.h*REAL_PX_PER_MM,depth:d.d*REAL_PX_PER_MM};}
export function deviceCells(kind:DeviceKind,mode:GameMode){const d=realSize(kind);return mode==='real'?{w:d.w/CELL,h:d.h/CELL}:{w:DEVICES[kind].w,h:DEVICES[kind].h};}
export interface FragmentGeometry {
  /** Convex polygon in fragment-local world pixels, centered on its centroid. */
  outline:{x:number;y:number}[];
  /** Full source chassis in world pixels, and fragment origin within it. */
  source:{w:number;h:number;offsetX:number;offsetY:number};
}

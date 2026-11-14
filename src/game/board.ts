import type { GameMode } from '../data/gameModes';
import { CELL,FIELD_W,FIELD_H,COLS,ROWS,DANGER_Y } from './config';

/** World dimensions, independent of CSS size and device proportions. */
export interface BoardSpec { width:number;height:number;cols:number;rows:number;cell:number;dangerY:number }
export const CLASSIC_BOARD:Readonly<BoardSpec>=Object.freeze({width:FIELD_W,height:FIELD_H,cols:COLS,rows:ROWS,cell:CELL,dangerY:DANGER_Y});
export const REAL_BOARD:Readonly<BoardSpec>=Object.freeze({width:540,height:900,cols:15,rows:25,cell:CELL,dangerY:DANGER_Y});
export function boardForMode(mode:GameMode):Readonly<BoardSpec>{return mode==='real'?REAL_BOARD:CLASSIC_BOARD;}

/** Same cabinet camera, with sufficient canvas margin for unscaled Pro depth. */
export interface ObliqueViewport {width:number;height:number;offsetY:number}
export const CLASSIC_VIEW:Readonly<ObliqueViewport>={width:400,height:704,offsetY:0};
export const REAL_VIEW:Readonly<ObliqueViewport>={width:600,height:1000,offsetY:36};
export function obliqueViewport(board:Readonly<BoardSpec>):Readonly<ObliqueViewport>{return board.width===540?REAL_VIEW:CLASSIC_VIEW;}

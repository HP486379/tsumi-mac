import { isClassicMini } from '../../data/gameModes';
import { planRowClear,MAX_SPLIT_TILT } from './rowClear';
import { planRealRowClear,type RealPiece } from './realRowClear';
import { quadrantOf } from '../physics/geometry';

/** Keep the classic full-width 36px row rule. Only the fractional-size mini
 * bodies require exact band clipping; other classic devices keep their planner. */
export function planClassicRowClear(pieces:RealPiece[],rows:number[]){
 const precise=(p:RealPiece)=>isClassicMini(p.kind)&&Math.abs(quadrantOf(p.angle).residual)<=MAX_SPLIT_TILT;
 // Retain classic's >0.2rad half-area whole-removal rule, including minis.
 const mini=planRealRowClear(pieces.filter(precise),rows),other=planRowClear(pieces.filter(p=>!precise(p)),rows);
 return {removeIds:[...mini.removeIds,...other.removeIds],create:[...mini.create,...other.create],clearedValue:mini.clearedValue+other.clearedValue,clearedCells:mini.clearedCells+other.clearedCells,wholeRemovedIds:[...mini.wholeRemovedIds,...other.wholeRemovedIds]};
}

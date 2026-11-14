import type Matter from 'matter-js';
import type { DeviceKind } from '../../data/devices';
import type { FragmentGeometry } from '../../data/gameModes';

export type EntityState = 'falling' | 'landing' | 'locked';

/** 盤面上のデバイス（物理ボディ＋ゲーム属性）。価値は ScoreLedger が一元管理する */
export interface DeviceEntity {
  geometry?: FragmentGeometry;
  id: number;
  /** Root purchase identity, retained by any future fragments. */
  individualId: number;
  kind: DeviceKind;
  refurb: boolean;
  /** ボディのローカル寸法（セル数） */
  wCells: number;
  hCells: number;
  body: Matter.Body;
  state: EntityState;
  fragment: boolean;
  cutTop: boolean;
  cutBottom: boolean;
  /** 直前ステップの速度（衝撃音検出用） */
  lastVx: number;
  lastVy: number;
}

/**
 * 公式寸法台帳（cm）。斜めビューの奥行き比・自動テスト・寸法監査の唯一の根拠。
 * status: official = Apple公式技術仕様で確認済み / user-supplied = ユーザー提示値（公式未確認）
 */
import { DEVICES, DEVICE_KINDS, type DeviceKind } from './devices';

export type SolidShape = 'box' | 'cylinder';
export interface OfficialDimension {
  id: DeviceKind; label: string; shape: SolidShape;
  /** 箱：幅。円筒：直径 */ widthCm: number;
  /** 高さ（円筒は軸方向） */ heightCm: number;
  /** 箱：奥行き。円筒：直径 */ depthCm: number;
  weightKg: number | null; status: 'official' | 'user-supplied'; sourceUrl: string; note?: string;
}

export const OFFICIAL_DIMENSIONS: Record<DeviceKind, OfficialDimension> = {
  miniM1: { id: 'miniM1', label: 'Mac mini (M1, 2020)', shape: 'box', widthCm: 19.7, heightCm: 3.6, depthCm: 19.7, weightKg: 1.2, status: 'official', sourceUrl: 'https://support.apple.com/ja-jp/111894' },
  miniM2: { id: 'miniM2', label: 'Mac mini (2023, M2/M2 Pro)', shape: 'box', widthCm: 19.7, heightCm: 3.58, depthCm: 19.7, weightKg: 1.18, status: 'official', sourceUrl: 'https://support.apple.com/ja-jp/111837' },
  miniM4: { id: 'miniM4', label: 'Mac mini (2024, M4/M4 Pro)', shape: 'box', widthCm: 12.7, heightCm: 5.0, depthCm: 12.7, weightKg: 0.67, status: 'official', sourceUrl: 'https://support.apple.com/ja-jp/121555' },
  studio: { id: 'studio', label: 'Mac Studio (2023)', shape: 'box', widthCm: 19.7, heightCm: 9.5, depthCm: 19.7, weightKg: 2.7, status: 'official', sourceUrl: 'https://support.apple.com/ja-jp/111835' },
  pro: { id: 'pro', label: 'Mac Pro (2023, M2 Ultra) タワー', shape: 'box', widthCm: 21.8, heightCm: 52.9, depthCm: 45.0, weightKg: 16.86, status: 'official', sourceUrl: 'https://support.apple.com/ja-jp/111343', note: '2019年モデルと外観共通のため、イラストから世代は断定できない。' },
  macPro2013: { id: 'macPro2013', label: 'Mac Pro (Late 2013)', shape: 'cylinder', widthCm: 16.7, heightCm: 25.1, depthCm: 16.7, weightKg: 5.0, status: 'official', sourceUrl: 'https://support.apple.com/ja-jp/112025' },
};

export type DimensionId = DeviceKind;
export const DIMENSION_IDS: DimensionId[] = DEVICE_KINDS;
export const GAME_CELLS: Record<DimensionId, { w: number; h: number }> = Object.fromEntries(
  DEVICE_KINDS.map((k) => [k, { w: DEVICES[k].w, h: DEVICES[k].h }]),
) as Record<DimensionId, { w: number; h: number }>;

export interface AuditRow { id: DimensionId; label: string; status: string; officialWH: number; gameWH: number; wErrorPct: number; officialDW: number; sourceUrl: string }
export function auditDimensions(): AuditRow[] {
  return DIMENSION_IDS.map((id) => {
    const d = OFFICIAL_DIMENSIONS[id], c = GAME_CELLS[id];
    const officialWH = d.widthCm / d.heightCm, gameWH = c.w / c.h;
    return { id, label: d.label, status: d.status, officialWH, gameWH, wErrorPct: (gameWH / officialWH - 1) * 100, officialDW: d.depthCm / d.widthCm, sourceUrl: d.sourceUrl };
  });
}

/**
 * 登場デバイス定義。
 * 質量・価格・摩擦などはゲーム用パラメータ。実寸（cm）の根拠は officialDimensions.ts を参照。
 */
export type DeviceKind = 'miniM1' | 'miniM2' | 'miniM4' | 'studio' | 'pro' | 'macPro2013';

export interface DeviceSpec {
  kind: DeviceKind;
  /** 表示名 */
  name: string;
  /** 短縮ラベル（イラスト上に描く） */
  label: string;
  /** 横セル数 */
  w: number;
  /** 縦セル数 */
  h: number;
  /** 質量（ゲーム内単位） */
  mass: number;
  /** 散財額（円） */
  price: number;
  /** 摩擦係数：軽いデバイスほど滑りやすい */
  friction: number;
  frictionStatic: number;
  restitution: number;
  /** 出現の重み */
  weight: number;
  /** 描画色 */
  body: string;
  bodyDark: string;
  accent: string;
}

/**
 * Mac Pro (Late 2013) の価格（暫定）。
 * 根拠：Apple Japan の発売時プレスリリース記載の最小構成価格 318,800円。
 * 既存機種はゲーム用の架空価格のため、既存体系への対応づけは未確定。変更はこの1か所で行う。
 */
export const MAC_PRO_2013_PRICE_YEN = 318_800;

export const DEVICES: Record<DeviceKind, DeviceSpec> = {
  miniM1: {
    kind: 'miniM1', name: 'Mac mini M1', label: 'mini M1', w: 2, h: 1, mass: 1.2, price: 50_000,
    friction: 0.3, frictionStatic: 0.45, restitution: 0.06, weight: 26,
    body: '#d9dde3', bodyDark: '#a9afb8', accent: '#7fd3ff',
  },
  miniM2: {
    kind: 'miniM2', name: 'Mac mini M2', label: 'mini M2', w: 2, h: 1, mass: 1.3, price: 70_000,
    friction: 0.32, frictionStatic: 0.48, restitution: 0.06, weight: 24,
    body: '#cfd8e2', bodyDark: '#9aa7b6', accent: '#8affc1',
  },
  miniM4: {
    kind: 'miniM4', name: 'Mac mini M4', label: 'M4', w: 1, h: 1, mass: 0.7, price: 115_000,
    friction: 0.2, frictionStatic: 0.32, restitution: 0.08, weight: 24,
    body: '#eef0f3', bodyDark: '#b8bcc4', accent: '#ffd36e',
  },
  studio: {
    kind: 'studio', name: 'Mac Studio', label: 'Studio', w: 3, h: 2, mass: 2.7, price: 330_000,
    friction: 0.5, frictionStatic: 0.65, restitution: 0.03, weight: 15,
    body: '#c5cad1', bodyDark: '#8d949e', accent: '#ff9f6e',
  },
  pro: {
    // 2023年 M2 Ultra タワーとして扱う（2019年モデルと外観が共通で、イラストから世代は断定できない）
    kind: 'pro', name: 'Mac Pro (2023)', label: 'Pro', w: 2, h: 4, mass: 7.0, price: 1_000_000,
    friction: 0.6, frictionStatic: 0.8, restitution: 0.02, weight: 9,
    body: '#b4bac3', bodyDark: '#767e8a', accent: '#ff6e8a',
  },
  macPro2013: {
    // 直径16.7cm×高さ25.1cm → 2×3セル（0.667、公式 0.665）。質量は公式 5.0kg
    kind: 'macPro2013', name: 'Mac Pro (Late 2013)', label: 'Pro 2013', w: 2, h: 3, mass: 5.0, price: MAC_PRO_2013_PRICE_YEN,
    friction: 0.4, frictionStatic: 0.55, restitution: 0.03, weight: 8,
    body: '#2b2e35', bodyDark: '#0f1115', accent: '#c9ced8',
  },
};

export const DEVICE_KINDS: DeviceKind[] = ['miniM1', 'miniM2', 'miniM4', 'studio', 'pro', 'macPro2013'];

/** 高額デバイス（散財演出の対象）しきい値 */
export const BIG_SPEND_THRESHOLD = 300_000;

/** 整備済製品の割引率 */
export const REFURB_DISCOUNT = 0.15;

export function formatYen(v: number): string {
  return '¥' + Math.round(v).toLocaleString('ja-JP');
}

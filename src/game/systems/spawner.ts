/**
 * デバイス出現キューとイベント（新製品発表 / 整備済製品入荷）。
 * 5種類すべてが一定周期内に必ず出現するよう、重み付き抽選に「未出現保証」を組み合わせる。
 */
import { DEVICES, DEVICE_KINDS, REFURB_DISCOUNT, type DeviceKind } from '../../data/devices';
import { EVENT_MAX_S, EVENT_MIN_S } from '../config';
import { Rng } from './rng';

export interface SpawnTicket {
  kind: DeviceKind;
  refurb: boolean;
  /** 実際の散財額（整備済は割引） */
  price: number;
  /** 新製品発表で登場 */
  launch: boolean;
}

export type GameEventType = 'launch' | 'refurb';
export interface GameEventInfo { type: GameEventType; title: string; detail: string }

/** 何個出る間に全種類が1回以上出ることを保証するか */
const GUARANTEE_WINDOW = 10;

export class Spawner {
  private rng: Rng;
  private queue: SpawnTicket[] = [];
  private sinceSeen = new Map<DeviceKind, number>();
  private refurbLeft = 0;
  private launchLeft = 0;
  private eventTimer: number;
  private forced: DeviceKind[] = [];

  constructor(seed: number) {
    this.rng = new Rng(seed);
    for (const k of DEVICE_KINDS) this.sinceSeen.set(k, 0);
    this.eventTimer = this.rng.range(EVENT_MIN_S, EVENT_MAX_S);
    this.fill();
  }

  /** テスト・デバッグ用：次に出すデバイスを強制 */
  force(kind: DeviceKind): void {
    this.forced.push(kind);
    this.queue = [];
    this.fill();
  }

  private pickKind(): DeviceKind {
    const forced = this.forced.shift();
    if (forced) return forced;
    if (this.launchLeft > 0) {
      this.launchLeft--;
      return this.rng.next() < 0.5 ? 'pro' : 'studio';
    }
    // 未出現保証
    for (const k of DEVICE_KINDS) {
      if ((this.sinceSeen.get(k) ?? 0) >= GUARANTEE_WINDOW - 1) return k;
    }
    const total = DEVICE_KINDS.reduce((s, k) => s + DEVICES[k].weight, 0);
    let r = this.rng.next() * total;
    for (const k of DEVICE_KINDS) {
      r -= DEVICES[k].weight;
      if (r <= 0) return k;
    }
    return 'miniM1';
  }

  private makeTicket(launch: boolean): SpawnTicket {
    const kind = this.pickKind();
    for (const k of DEVICE_KINDS) this.sinceSeen.set(k, k === kind ? 0 : (this.sinceSeen.get(k) ?? 0) + 1);
    let refurb = false;
    if (this.refurbLeft > 0) {
      refurb = true;
      this.refurbLeft--;
    }
    const base = DEVICES[kind].price;
    const price = refurb ? Math.round(base * (1 - REFURB_DISCOUNT)) : base;
    return { kind, refurb, price, launch };
  }

  private fill(): void {
    while (this.queue.length < 2) this.queue.push(this.makeTicket(false));
  }

  peek(): SpawnTicket {
    this.fill();
    return this.queue[0]!;
  }

  next(): SpawnTicket {
    this.fill();
    const t = this.queue.shift()!;
    this.fill();
    return t;
  }

  /** 経過時間でイベントを発生させる。ゲーム進行は止めない */
  update(dtS: number): GameEventInfo | null {
    this.eventTimer -= dtS;
    if (this.eventTimer > 0) return null;
    this.eventTimer = this.rng.range(EVENT_MIN_S, EVENT_MAX_S);
    return this.triggerEvent(this.rng.next() < 0.5 ? 'launch' : 'refurb');
  }

  triggerEvent(type: GameEventType): GameEventInfo {
    if (type === 'launch') {
      this.launchLeft = 2;
      // 次以降のキューを差し替え（表示中のNEXTは維持して不意打ちを避ける）
      this.queue = this.queue.slice(0, 1);
      this.fill();
      return { type, title: '新製品発表！', detail: '高性能モデルが入荷します' };
    }
    this.refurbLeft = 3;
    this.queue = this.queue.slice(0, 1);
    this.fill();
    return { type, title: '整備済製品入荷', detail: `次の3台が${Math.round(REFURB_DISCOUNT * 100)}%オフ` };
  }
}

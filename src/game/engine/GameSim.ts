/**
 * ゲームシミュレーション本体（DOM非依存）。
 * Matter.js の物理ワールド、操作対象の制御、配置確定、行消去、スコア、危険判定を管理する。
 * 描画・音・React からは分離されており、Node 上の単体テストからも直接動かせる。
 */
import Matter from 'matter-js';
import {
  ARR_MS, BASE_FALL_SPEED, CELL, DAS_MS, FALL_SPEED_PER_LEVEL,
  HARD_DROP_SPEED, MAX_FALL_SPEED, ROW_CHECK_INTERVAL, SOFT_DROP_SPEED, STEP_MS,MOVE_STEP_PX,FINE_MOVE_STEP_PX,FINE_ARR_MS,
} from '../config';
import { boardForMode,type BoardSpec } from '../board';
import { BIG_SPEND_THRESHOLD, DEVICES, formatYen, type DeviceKind } from '../../data/devices';
import { deviceCells,isClassicMini,type GameMode,type FragmentGeometry } from '../../data/gameModes';
import { planRealRowClear } from '../grid/realRowClear';
import type { DeviceEntity } from '../entities/DeviceEntity';
import { createDeviceBody, createPhysicsWorld, type PhysicsWorld } from '../physics/world';
import { convexOverlap, polygonAABB, rectVertices, type Polygon } from '../physics/geometry';
import { computeOccupancy, findFullRows, findContinuousStripRows } from '../grid/occupancy';
import { type PieceState } from '../grid/rowClear';
import { planClassicRowClear } from '../grid/classicRowClear';
import { ScoreLedger, type ScoreSnapshot } from '../systems/scoring';
import { DangerMonitor } from '../systems/danger';
import { LockMonitor } from '../systems/lock';
import { Spawner, type GameEventType, type SpawnTicket } from '../systems/spawner';
import { InputState, type Action } from '../systems/input';
import type { SoundName } from '../systems/audio';
import type { Floater, RenderState, RowFlash } from '../rendering/renderer';

export type GameOverReason = 'danger' | 'spawn';

export interface GameMessage {
  kind: 'event' | 'clear' | 'combo' | 'spend' | 'level' | 'gameover';
  title: string;
  detail?: string;
}

export interface SimCallbacks {
  onMessage?: (m: GameMessage) => void;
  onSound?: (name: SoundName, intensity: number) => void;
  onGameOver?: (reason: GameOverReason) => void;
}

export interface SimOptions {
  mode?:GameMode;
  seed?: number;
  /** false の場合、最初のデバイスを自動出現させない（テスト用） */
  autoSpawn?: boolean;
  /** false の場合、ランダムイベントを発生させない（テスト用） */
  randomEvents?: boolean;
}

const { Body, Composite, Engine, Sleeping } = Matter;
const HALF_PI = Math.PI / 2;
const OVERLAP_TOL = 1.0;
/** 行判定に含めるボディの最大速度（落下途中のボディで誤って行が揃うのを防ぐ） */
const ROW_CHECK_MAX_SPEED = 1.0;

export class GameSim {
  readonly mode:GameMode;
  readonly board:Readonly<BoardSpec>;
  readonly world: PhysicsWorld;
  readonly entities = new Map<number, DeviceEntity>();
  readonly ledger = new ScoreLedger();
  readonly danger: DangerMonitor;
  readonly lock = new LockMonitor();
  readonly input = new InputState();
  readonly spawner: Spawner;
  status: 'running' | 'over' = 'running';
  overReason: GameOverReason | null = null;
  active: DeviceEntity | null = null;
  activeTicket: SpawnTicket | null = null;
  stepCount = 0;
  floaters: Floater[] = [];
  flashes: RowFlash[] = [];
  shake = 0;
  /** 盤面外へ落下したボディ数（壁・床の突き抜け検出用。正常時は0） */
  escaped = 0;

  private nextId = 1;
  private q = 0;
  private targetX = 0;
  private hardDropping = false;
  private groundedFrames = 0;
  private prevY = 0;
  private lastLevel = 1;
  private readonly randomEvents: boolean;
  private readonly autoSpawn: boolean;

  constructor(private readonly cb: SimCallbacks = {}, opts: SimOptions = {}) {
    this.mode=opts.mode??'classic';
    this.board=boardForMode(this.mode);
    this.danger=new DangerMonitor(this.board.dangerY);
    this.world = createPhysicsWorld(this.board);
    this.spawner = new Spawner(opts.seed ?? (Date.now() & 0x7fffffff));
    this.randomEvents = opts.randomEvents ?? true;
    this.autoSpawn = opts.autoSpawn ?? true;
    if (this.autoSpawn) this.spawnNext();
  }

  get engine(): Matter.Engine {
    return this.world.engine;
  }

  get fallSpeed(): number {
    return Math.min(MAX_FALL_SPEED, BASE_FALL_SPEED + FALL_SPEED_PER_LEVEL * (this.ledger.level - 1));
  }

  get rotationQuadrant(): number {
    return this.q;
  }

  // ------------------------------------------------------------------ 出現
  /** 次のデバイスを出現させる。出現位置が塞がっていればゲームオーバー */
  spawnNext(): DeviceEntity | null {
    if (this.status !== 'running') return null;
    const ticket = this.spawner.next();
    return this.spawnTicket(ticket);
  }

  spawnTicket(ticket: SpawnTicket): DeviceEntity | null {
    const spec = DEVICES[ticket.kind];
    const cells=deviceCells(ticket.kind,this.mode);
    const col0 = Math.floor((this.board.cols - cells.w) / 2);
    const cx = this.mode==='real'?this.board.width/2:(col0 + cells.w / 2) * CELL;
    const cy = (cells.h * CELL) / 2;
    const poly = rectVertices(cx, cy, cells.w * CELL, cells.h * CELL, 0);
    if (this.overlapsAny(poly, null)) {
      this.gameOver('spawn');
      return null;
    }
    const e = this.addEntity(ticket.kind, ticket.refurb, cx, cy, cells.w, cells.h, 0, 'falling');
    this.ledger.registerPurchase(e.id, ticket.price);
    this.active = e;
    this.activeTicket = ticket;
    this.q = 0;
    this.targetX = cx;
    this.hardDropping = false;
    this.groundedFrames = 0;
    this.prevY = cy;
    this.lock.reset();
    this.cb.onSound?.('spawn', 1);
    if (ticket.price >= BIG_SPEND_THRESHOLD) {
      this.floaters.push({ text: `散財！ ${formatYen(ticket.price)}`, x: this.board.width / 2, y: 120, life: 1.6, maxLife: 1.6, color: '#ffd36e', size: 24, vy: -0.4 });
      this.shake = Math.max(this.shake, ticket.kind === 'pro' ? 8 : 4);
      this.cb.onSound?.('money', 1);
      this.cb.onMessage?.({ kind: 'spend', title: '散財！', detail: `${spec.name} ${formatYen(ticket.price)}` });
    }
    return e;
  }

  private addEntity(
    kind: DeviceKind, refurb: boolean, cx: number, cy: number, wCells: number, hCells: number, angle: number,
    state: DeviceEntity['state'], fragment = false, cutTop = false, cutBottom = false, geometry?:FragmentGeometry,individualId=this.nextId,
  ): DeviceEntity {
    const body = createDeviceBody({ kind, cx, cy, wCells, hCells, angle, mode:this.mode,geometry });
    Composite.add(this.world.engine.world, body);
    const e: DeviceEntity = {
      id: this.nextId++, individualId,kind, refurb, wCells, hCells, body, state, fragment, cutTop, cutBottom, geometry, lastVx: 0, lastVy: 0,
    };
    this.entities.set(e.id, e);
    return e;
  }

  protected removeEntityBody(e: DeviceEntity): void {
    Composite.remove(this.world.engine.world, e.body);
    this.entities.delete(e.id);
    if (this.active === e) this.active = null;
  }

  /** テスト・デバッグ用：確定済みデバイスをグリッド位置に直接配置（散財にも計上） */
  placeLocked(kind: DeviceKind, col: number, row: number, quadrant = 0, refurb = false): DeviceEntity {
    const spec = deviceCells(kind,this.mode);
    const W = quadrant % 2 === 1 ? spec.h : spec.w;
    const H = quadrant % 2 === 1 ? spec.w : spec.h;
    const e = this.addEntity(kind, refurb, (col + W / 2) * CELL, (row + H / 2) * CELL, spec.w, spec.h, quadrant * HALF_PI, 'locked');
    this.ledger.registerPurchase(e.id, DEVICES[kind].price);
    return e;
  }

  // ------------------------------------------------------------------ 衝突チェック
  protected overlapsAny(poly: Polygon, except: DeviceEntity | null,tolerance=OVERLAP_TOL): boolean {
    const bb = polygonAABB(poly);
    for (const e of this.entities.values()) {
      if (e === except) continue;
      const b = e.body.bounds;
      if (b.max.x <= bb.minX + tolerance || b.min.x >= bb.maxX - tolerance) continue;
      if (b.max.y <= bb.minY + tolerance || b.min.y >= bb.maxY - tolerance) continue;
      const shapes=this.mode==='real'&&e.body.parts.length>1?e.body.parts.slice(1):[e.body];
      if (shapes.some(shape=>convexOverlap(poly, shape.vertices, tolerance))) return true;
    }
    return false;
  }

  private worldDims(e: DeviceEntity, q: number): { W: number; H: number } {
    return q % 2 === 1 ? { W: e.hCells, H: e.wCells } : { W: e.wCells, H: e.hCells };
  }

  // ------------------------------------------------------------------ 操作
  press(a: Action): void {
    this.input.press(a);
  }

  release(a: Action): void {
    this.input.release(a);
  }

  tryMove(dir: -1 | 1): boolean {
    const e = this.active;
    if (!e || e.state !== 'falling' || this.status !== 'running') return false;
    const { W,H } = this.worldDims(e, this.q),x=e.body.position.x;
    const step=this.input.held.has('fine')?FINE_MOVE_STEP_PX:MOVE_STEP_PX;
    const nx=Math.max(W*CELL/2,Math.min(this.board.width-W*CELL/2,x+dir*step));
    if(Math.abs(nx-x)<1e-9)return false;
    // Test the entire translation, not only its endpoint: even a sub-4px
    // fragment must block movement. Input admits no positive penetration.
    const swept=rectVertices((x+nx)/2,e.body.position.y,W*CELL+Math.abs(nx-x),H*CELL,0);
    if (this.overlapsAny(swept, e,0)) return false;
    Body.setPosition(e.body, { x: nx, y: e.body.position.y });
    this.targetX = nx;
    this.cb.onSound?.('move', 1);
    return true;
  }

  tryRotate(dir: -1 | 1): boolean {
    const e = this.active;
    if (!e || e.state !== 'falling' || this.status !== 'running') return false;
    const nq = (this.q + dir + 4) % 4;
    const { W } = this.worldDims(e, nq);
    const x=e.body.position.x,y=e.body.position.y,old=this.worldDims(e,this.q);
    // 回転キックは細かい位置調整を維持し、36px移動量とは独立させる。
    const kicks=[0];for(let d=FINE_MOVE_STEP_PX;d<=CELL*2;d+=FINE_MOVE_STEP_PX)kicks.push(-d,d);
    for (let dy=0;dy>=-CELL;dy-=4) {
      for (const kick of kicks) {
        const nx=Math.max(W*CELL/2,Math.min(this.board.width-W*CELL/2,x+kick));
        const poly = rectVertices(nx, y + dy, e.wCells * CELL, e.hCells * CELL, nq * HALF_PI);
        if (this.overlapsAny(poly, e,0)) continue;
        // Kicks cannot teleport the existing body across another Mac. This
        // conservative swept rectangle also protects diagonal corrections.
        if(Math.abs(nx-x)>1e-9||dy!==0){
          const sweep=rectVertices((x+nx)/2,y+dy/2,old.W*CELL+Math.abs(nx-x),old.H*CELL+Math.abs(dy),0);
          if(this.overlapsAny(sweep,e,0))continue;
        }
        this.q = nq;
        Body.setAngle(e.body, nq * HALF_PI);
        Body.setAngularVelocity(e.body, 0);
        Body.setPosition(e.body, { x: nx, y: y + dy });
        this.targetX = nx;
        this.prevY = y + dy;
        this.cb.onSound?.('rotate', 1);
        return true;
      }
    }
    return false;
  }

  hardDrop(): void {
    if (this.active && this.active.state === 'falling') this.hardDropping = true;
  }

  /** Active downward input is swept too. A fast step into a gap narrower
   * than the collider can otherwise produce opposing side contacts whose
   * Matter corrections cancel. Stop at first contact, without shrinking a
   * body or changing Matter's solver/tolerances. Free bodies stay physical. */
  private safeFallSpeed(e:DeviceEntity,speed:number):number {
    const {W,H}=this.worldDims(e,this.q),x=e.body.position.x,y=e.body.position.y;
    const blocked=(d:number)=>this.overlapsAny(rectVertices(x,y+d/2,W*CELL,H*CELL+d,0),e,0);
    if(!blocked(speed+.5))return speed;
    let lo=0,hi=speed+.5;
    for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(blocked(mid))hi=mid;else lo=mid;}
    return Math.min(speed,Math.max(0,lo-.05));
  }

  private processInput(): void {
    const inp = this.input;
    while (inp.queue.length > 0) {
      const a = inp.queue.shift()!;
      switch (a) {
        case 'left': this.tryMove(-1); break;
        case 'right': this.tryMove(1); break;
        case 'rotateR': this.tryRotate(1); break;
        case 'rotateL': this.tryRotate(-1); break;
        case 'hard': this.hardDrop(); break;
        default: break;
      }
    }
    if (inp.repeatDir && inp.held.has(inp.repeatDir)) {
      inp.repeatTimer += STEP_MS;
      const threshold = inp.repeating ? (inp.held.has('fine')?FINE_ARR_MS:ARR_MS) : DAS_MS;
      if (inp.repeatTimer >= threshold) {
        inp.repeatTimer = 0;
        inp.repeating = true;
        this.tryMove(inp.repeatDir === 'left' ? -1 : 1);
      }
    }
  }

  // ------------------------------------------------------------------ 1ステップ
  step(): void {
    if (this.status !== 'running') return;
    const dt = STEP_MS / 1000;
    this.stepCount++;
    this.ledger.timeMs += STEP_MS;

    if (this.randomEvents) {
      const ev = this.spawner.update(dt);
      if (ev) this.announceEvent(ev.type, ev.title, ev.detail);
    }

    const a = this.active;
    let expected = 0;
    if (a && a.state === 'falling') {
      this.processInput();
      const speed = this.hardDropping
        ? HARD_DROP_SPEED
        : this.input.held.has('soft') ? Math.max(SOFT_DROP_SPEED, this.fallSpeed) : this.fallSpeed;
      if (this.active === a && a.state === 'falling') {
        Sleeping.set(a.body, false);
        Body.setAngle(a.body, this.q * HALF_PI);
        Body.setAngularVelocity(a.body, 0);
        const vx = Math.max(-3, Math.min(3, (this.targetX - a.body.position.x) * 0.3));
        Body.setVelocity(a.body, { x: vx, y: this.safeFallSpeed(a,speed) });
        this.prevY = a.body.position.y;
        expected = speed;
      }
    } else {
      // 接地後〜確定前は操作不可。入力は捨てる
      this.input.queue.length = 0;
    }

    const thinClassic=this.mode==='classic'&&[...this.entities.values()].some(e=>e.kind==='miniM1'||e.kind==='miniM2'||isClassicMini(e.kind)&&!!e.geometry);
    if(this.mode==='real'||thinClassic)for(let sub=0;sub<4;sub++)Engine.update(this.world.engine,STEP_MS/4);
    else Engine.update(this.world.engine, STEP_MS);

    // 接地判定
    if (a && a.state === 'falling' && this.active === a) {
      const dy = a.body.position.y - this.prevY;
      if (dy < expected * 0.35) this.groundedFrames++;
      else this.groundedFrames = 0;
      if (this.groundedFrames >= 2) {
        a.state = 'landing';
        this.lock.reset();
        this.cb.onSound?.('thud', Math.min(1, (expected * DEVICES[a.kind].mass) / 30 + 0.3));
      }
    } else if (a && a.state === 'landing' && this.active === a) {
      if (this.lock.update(dt, a.body.position.x, a.body.position.y, a.body.speed, a.body.angularSpeed)) {
        this.lockActive();
      }
    }

    this.detectImpacts();
    this.cullEscaped();

    if (this.stepCount % ROW_CHECK_INTERVAL === 0) this.checkRows();

    this.updateDanger(dt);

    this.updateEffects(dt);

    if (this.autoSpawn && this.status === 'running' && !this.active) this.spawnNext();
  }

  private lockActive(): void {
    const a = this.active;
    if (!a) return;
    a.state = 'locked';
    this.active = null;
    this.activeTicket = null;
    this.ledger.beginPlacement();
    this.cb.onSound?.('lock', 1);
    this.checkRows();
  }

  protected updateDanger(dt:number):void {
    const tops:number[]=[];
    for(const e of this.entities.values())if(e.state==='locked')tops.push(e.body.bounds.min.y);
    if(this.danger.update(dt,tops))this.gameOver('danger');
  }

  private detectImpacts(): void {
    for (const e of this.entities.values()) {
      const v = e.body.velocity;
      if (e.state !== 'falling') {
        const dv = Math.hypot(v.x - e.lastVx, v.y - e.lastVy);
        if (dv > 2.2) this.cb.onSound?.('thud', Math.min(1, dv / 8));
      }
      e.lastVx = v.x;
      e.lastVy = v.y;
    }
  }

  /** 万一の突き抜け対策：盤面外に出たボディを除去（正常なら発生しない） */
  protected cullEscaped(): void {
    for (const e of [...this.entities.values()]) {
      const p = e.body.position;
      if (p.y > this.board.height + 120 || p.x < -120 || p.x > this.board.width + 120) {
        this.escaped++;
        this.ledger.removeEntity(e.id);
        this.removeEntityBody(e);
      }
    }
  }

  // ------------------------------------------------------------------ 行消去
  /** 現在の占有率（確定済みかつ静止に近いボディのみ） */
  occupancy(): Float32Array {
    const polys: Polygon[] = [];
    for (const e of this.entities.values()) {
      if (e.state !== 'locked' || e.body.speed > ROW_CHECK_MAX_SPEED) continue;
      if(this.mode==='real'&&e.body.parts.length>1)polys.push(...e.body.parts.slice(1).map(p=>p.vertices));
      else polys.push(e.body.vertices);
    }
    return computeOccupancy(polys,this.board);
  }

  private detectFullRows(): number[] {
    const areaRows = findFullRows(this.occupancy(), this.board);
    if (this.mode !== 'classic') return areaRows;
    const polys: Polygon[] = [];
    for (const e of this.entities.values()) {
      if (e.state === 'locked' && e.body.speed <= ROW_CHECK_MAX_SPEED)
        polys.push(e.body.vertices);
    }
    return [...new Set([...areaRows, ...findContinuousStripRows(polys, this.board)])].sort((a,b)=>a-b);
  }

  /** 揃った行を検出して整理する。消去した行数を返す */
  checkRows(forcedRows?:number[]): number {
    if (this.status !== 'running') return 0;
    const rows = forcedRows??this.detectFullRows();
    if (rows.length === 0) return 0;

    const pieces: (PieceState & {geometry?:FragmentGeometry;vertices?:Polygon;polygons?:Polygon[]})[] = [];
    for (const e of this.entities.values()) {
      if (e.state !== 'locked') continue;
      const b = e.body;
      pieces.push({
        id: e.id, kind: e.kind, refurb: e.refurb, cx: b.position.x, cy: b.position.y, angle: b.angle,
        geometry:e.geometry,vertices:this.mode==='real'||isClassicMini(e.kind)?b.vertices:undefined,polygons:this.mode==='real'&&b.parts.length>1?b.parts.slice(1).map(p=>p.vertices):undefined, wCells: e.wCells, hCells: e.hCells, value: this.ledger.valueOf(e.id), vx: b.velocity.x, vy: b.velocity.y,
      });
    }
    const plan = this.mode==='real'?planRealRowClear(pieces, rows):planClassicRowClear(pieces, rows);
    let clearedYen = 0;
    for (const id of plan.removeIds) {
      const src = this.entities.get(id);
      if (!src) continue;
      this.removeEntityBody(src);
      const frags: Array<{ id: number; value: number }> = [];
      for (const f of plan.create) {
        if (f.sourceId !== id) continue;
        const ne = this.addEntity(f.kind, f.refurb, f.cx, f.cy, f.wCells, f.hCells, f.angle, 'locked', true, f.cutTop, f.cutBottom,'geometry' in f?f.geometry as FragmentGeometry:undefined,src.individualId);
        Body.setVelocity(ne.body, { x: f.vx, y: f.vy });
        frags.push({ id: ne.id, value: f.value });
      }
      clearedYen += this.ledger.applySplit(id, frags);
    }
    // 残ったボディに再び重力を適用（スリープ解除）
    for (const e of this.entities.values()) Sleeping.set(e.body, false);

    const combo = this.ledger.registerClear(rows.length);
    for (const r of rows) this.flashes.push({ row: r, life: 0.45 });
    const midY = ((rows[0]! + rows[rows.length - 1]! + 1) / 2) * CELL;
    this.floaters.push({ text: '資産整理！', x: this.board.width / 2, y: midY - 14, life: 1.3, maxLife: 1.3, color: '#8affc1', size: 26, vy: -0.5 });
    this.floaters.push({ text: `+${formatYen(clearedYen)}`, x: this.board.width / 2, y: midY + 16, life: 1.3, maxLife: 1.3, color: '#ffffff', size: 15, vy: -0.5 });
    this.cb.onSound?.('clear', 1);
    this.cb.onMessage?.({ kind: 'clear', title: '資産整理！', detail: `${rows.length}行 / ${formatYen(clearedYen)}` });
    if (combo >= 2) {
      this.floaters.push({ text: `断捨離成功！ ×${combo}`, x: this.board.width / 2, y: midY - 48, life: 1.6, maxLife: 1.6, color: '#ff9f6e', size: 24, vy: -0.6 });
      this.cb.onSound?.('combo', 1);
      this.cb.onMessage?.({ kind: 'combo', title: '断捨離成功！', detail: `${combo}コンボ` });
    }
    if (this.ledger.level > this.lastLevel) {
      this.lastLevel = this.ledger.level;
      this.floaters.push({ text: `LEVEL ${this.lastLevel}`, x: this.board.width / 2, y: this.board.height / 2, life: 1.4, maxLife: 1.4, color: '#7fd3ff', size: 22, vy: -0.3 });
      this.cb.onMessage?.({ kind: 'level', title: `レベル${this.lastLevel}`, detail: '落下速度アップ' });
    }
    return rows.length;
  }

  // ------------------------------------------------------------------ イベント・演出
  announceEvent(type: GameEventType, title?: string, detail?: string): void {
    if (!title) {
      const ev = this.spawner.triggerEvent(type);
      title = ev.title;
      detail = ev.detail;
    }
    this.floaters.push({ text: title, x: this.board.width / 2, y: 150, life: 1.6, maxLife: 1.6, color: type === 'launch' ? '#ff9f6e' : '#8affc1', size: 20, vy: -0.25 });
    this.cb.onSound?.('event', 1);
    this.cb.onMessage?.({ kind: 'event', title, detail });
  }

  private updateEffects(dt: number): void {
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy;
    }
    if (this.floaters.length) this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const f of this.flashes) f.life -= dt;
    if (this.flashes.length) this.flashes = this.flashes.filter((f) => f.life > 0);
    this.shake = this.shake > 0.2 ? this.shake * 0.88 : 0;
  }

  protected gameOver(reason: GameOverReason): void {
    if (this.status === 'over') return;
    this.status = 'over';
    this.overReason = reason;
    this.input.clear();
    this.cb.onSound?.('gameover', 1);
    this.cb.onMessage?.({ kind: 'gameover', title: '積みMac崩壊', detail: reason === 'spawn' ? '置き場所がありません' : '積みすぎました' });
    this.cb.onGameOver?.(reason);
  }

  // ------------------------------------------------------------------ 出力
  renderState(): RenderState {
    const items: RenderState['items'] = [];
    for (const e of this.entities.values()) {
      items.push({
        x: e.body.position.x,
        y: e.body.position.y,
        angle: e.body.angle,
        key: { ...(this.mode==='real'?{mode:this.mode,geometry:e.geometry}:e.geometry?{geometry:e.geometry}:{}), kind: e.kind, wCells: e.wCells, hCells: e.hCells, refurb: e.refurb, cutTop: e.cutTop, cutBottom: e.cutBottom },
        active: e === this.active,
      });
    }
    let guide: RenderState['guide'] = null;
    const a = this.active;
    if (a && a.state === 'falling') {
      const b = a.body.bounds;
      guide = { minX: b.min.x, maxX: b.max.x, top: b.max.y };
    }
    return { items, guide, dangerRatio: this.danger.ratio, floaters: this.floaters, flashes: this.flashes, shake: this.shake, timeMs: this.ledger.timeMs };
  }

  score(): ScoreSnapshot {
    return this.ledger.snapshot();
  }

  nextTicket(): SpawnTicket {
    return this.spawner.peek();
  }

  destroy(): void {
    Composite.clear(this.world.engine.world, false);
    Engine.clear(this.world.engine);
    this.entities.clear();
    this.active = null;
  }
}

export class Ledger {
  private spawned = new Map<number, number>();
  private removed = new Set<number>();
  spent = 0;
  organized = 0;
  rows = 0;
  combo = 0;
  maxCombo = 0;
  add(id: number, price: number) {
    if (this.spawned.has(id)) return;
    this.spawned.set(id, price);
    this.spent += price;
  }
  clear(ids: number[], rows: number) {
    for (const id of new Set(ids))
      if (this.spawned.has(id) && !this.removed.has(id)) {
        this.organized += this.spawned.get(id)!;
        this.removed.add(id);
      }
    this.rows += rows;
    this.combo++;
    this.maxCombo = Math.max(this.combo, this.maxCombo);
  }
  get remaining() {
    return this.spent - this.organized;
  }
}
export class DangerTimer {
  elapsed = 0;
  update(danger: boolean, dt: number) {
    this.elapsed = danger ? this.elapsed + dt : 0;
    return this.elapsed >= 2000;
  }
}

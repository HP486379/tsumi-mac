export class Sound {
  context: AudioContext | null = null;
  effects = true;
  music = false;
  running = false;
  timer: ReturnType<typeof setInterval> | null = null;
  beat = 0;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  tone(
    freq: number,
    duration: number,
    volume = 0.035,
    type: OscillatorType = "sine",
  ) {
    const c = this.context;
    if (!c || c.state !== "running") return;
    const osc = c.createOscillator(),
      gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  effect(kind: "hit" | "clear" | "over" | "spawn") {
    if (!this.effects) return;
    this.tone(
      { hit: 90, clear: 660, over: 65, spawn: 330 }[kind],
      kind === "hit" ? 0.09 : 0.35,
      0.045,
      "triangle",
    );
  }
  sync() {
    if (this.music && this.running && !this.timer)
      this.timer = setInterval(() => {
        this.tone(
          [130.81, 164.81, 196, 164.81, 146.83, 174.61, 220, 174.61][
            this.beat++ % 8
          ],
          0.5,
          0.012,
        );
      }, 600);
    if ((!this.music || !this.running) && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    void this.context?.close().catch(() => {});
  }
}

export const BEST_KEY = "tsumi-mac.best.v1",
  AUDIO_KEY = "tsumi-mac.audio.v1";
export function loadBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
export function saveBest(value: number): boolean {
  try {
    localStorage.setItem(BEST_KEY, String(value));
    return true;
  } catch {
    return false;
  }
}
export function loadAudio(): { effects: boolean; music: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? "{}");
    return { effects: v.effects !== false, music: v.music === true };
  } catch {
    return { effects: true, music: false };
  }
}
export function saveAudio(effects: boolean, music: boolean) {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ effects, music }));
  } catch {
    /* Keep session preferences. */
  }
}

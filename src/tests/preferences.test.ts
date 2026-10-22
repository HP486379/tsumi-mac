import { afterEach, expect, it, vi } from "vitest";
import { Sound } from "../game/systems/audio";
import {
  loadAudio,
  loadBest,
  saveAudio,
  saveBest,
} from "../game/systems/storage";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("audio OFF suppresses effects and music stops during a pause", () => {
  vi.useFakeTimers();
  const sound = new Sound();
  const tone = vi.spyOn(sound, "tone").mockImplementation(() => {});
  sound.effects = false;
  sound.effect("hit");
  expect(tone).not.toHaveBeenCalled();
  sound.effects = true;
  sound.effect("hit");
  expect(tone).toHaveBeenCalledOnce();
  tone.mockClear();
  sound.music = true;
  sound.running = true;
  sound.sync();
  vi.advanceTimersByTime(1200);
  expect(tone).toHaveBeenCalledTimes(2);
  sound.running = false;
  sound.sync();
  vi.advanceTimersByTime(1200);
  expect(tone).toHaveBeenCalledTimes(2);
  expect(sound.timer).toBeNull();
  sound.dispose();
});
it("saves best scores and preferences across reloads, tolerating bad data", () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => entries.get(k) ?? null,
    setItem: (k: string, v: string) => entries.set(k, v),
  });
  expect(loadBest()).toBe(0);
  expect(saveBest(250000)).toBe(true);
  expect(loadBest()).toBe(250000);
  saveAudio(false, true);
  expect(loadAudio()).toEqual({ effects: false, music: true });
  entries.set("tsumi-mac.best.v1", "NaN");
  entries.set("tsumi-mac.audio.v1", "{bad");
  expect(loadBest()).toBe(0);
  expect(loadAudio()).toEqual({ effects: true, music: false });
});
it("continues playing when browser storage is unavailable", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("full");
    },
  });
  expect(loadBest()).toBe(0);
  expect(saveBest(20)).toBe(false);
  expect(loadAudio()).toEqual({ effects: true, music: false });
  expect(() => saveAudio(false, false)).not.toThrow();
});

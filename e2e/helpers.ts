import { expect, type Page } from '@playwright/test';

export interface DebugState {
  status: string; paused: boolean; entities: number; active: string | null; activeState: string | null; q: number;
  score: { spent: number; cleared: number; fieldValue: number; lines: number; devices: number; combo: number; maxCombo: number };
  danger: number; fps: number; steps: number; escaped: number; activeX: number | null; activeY: number | null;
  audioPlayed: number; bgmPlaying: boolean;
}

export const state = (page: Page) => page.evaluate(() => window.__tsumimac!.state() as unknown as DebugState);

export function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  return errs;
}

export async function startGame(page: Page) {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await page.waitForFunction(() => window.__tsumimac?.state().active != null);
}

/** 9・10列目を空けたレンガ積み（行は揃わない）で危険ラインを超えさせる */
export async function buildWall(page: Page, top = 1) {
  await page.evaluate((t) => {
    const d = window.__tsumimac!;
    for (let r = t; r < 18; r++) {
      if (r % 2 === 0) for (let c = 0; c < 8; c += 2) d.placeLocked('miniM1', c, r);
      else {
        d.placeLocked('miniM4', 0, r);
        for (let c = 1; c < 7; c += 2) d.placeLocked('miniM1', c, r);
        d.placeLocked('miniM4', 7, r);
      }
    }
  }, top);
}

export async function expectNoErrors(errs: string[]) {
  expect(errs, errs.join('\n')).toEqual([]);
}

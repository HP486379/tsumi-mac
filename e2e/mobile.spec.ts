import { expect, test } from '@playwright/test';
import { expectNoErrors, startGame, state, watchErrors } from './helpers';

test.describe('スマートフォン（タッチ）', () => {
  test.skip(({ isMobile }) => !isMobile, 'モバイルのみ');

  test('タッチ操作・スクロール抑止・画面回転', async ({ page }) => {
    const errs = watchErrors(page);
    await startGame(page);
    for (const id of ['touch-left', 'touch-right', 'touch-rotate', 'touch-soft', 'touch-pause']) await expect(page.getByTestId(id)).toBeVisible();

    const vp = page.viewportSize()!;
    const box = (await page.getByTestId('game-canvas').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);

    const l = (await page.getByTestId('touch-left').boundingBox())!;
    const r = (await page.getByTestId('touch-right').boundingBox())!;
    expect(l.width).toBeGreaterThanOrEqual(60);
    expect(r.x - (l.x + l.width)).toBeGreaterThanOrEqual(12);

    const x0 = (await state(page)).activeX!;
    await page.getByTestId('touch-left').tap();
    await expect.poll(async () => x0 - (await state(page)).activeX!).toBeCloseTo(4, 5);
    await page.getByTestId('touch-right').tap();
    await expect.poll(async () => (await state(page)).activeX!).toBeCloseTo(x0, 0);
    const q0 = (await state(page)).q;
    await page.getByTestId('touch-rotate').tap();
    await expect.poll(async () => (await state(page)).q).toBe((q0 + 1) % 4);

    const y0 = (await state(page)).activeY!;
    const ev = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
    await page.getByTestId('touch-soft').dispatchEvent('pointerdown', ev);
    await page.waitForTimeout(300);
    await page.getByTestId('touch-soft').dispatchEvent('pointerup', ev);
    expect((await state(page)).activeY! - y0).toBeGreaterThan(60);

    await page.getByTestId('touch-pause').tap();
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    await page.getByTestId('resume-button').tap();
    await expect.poll(async () => (await state(page)).paused).toBe(false);

    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // 横向きへ
    const steps0 = (await state(page)).steps;
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForTimeout(400);
    const b2 = (await page.getByTestId('game-canvas').boundingBox())!;
    expect(b2.y + b2.height).toBeLessThanOrEqual(vp.width + 1);
    expect(b2.x + b2.width).toBeLessThanOrEqual(vp.height + 1);
    for (const id of ['touch-left', 'touch-right', 'touch-rotate', 'touch-soft']) {
      const bb = (await page.getByTestId(id).boundingBox())!;
      expect(bb.y + bb.height).toBeLessThanOrEqual(vp.width + 1);
    }
    await expect.poll(async () => (await state(page)).steps).toBeGreaterThan(steps0);
    // 縦へ戻す
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    const b3 = (await page.getByTestId('game-canvas').boundingBox())!;
    expect(b3.y + b3.height).toBeLessThanOrEqual(vp.height + 1);
    await expectNoErrors(errs);
  });
});

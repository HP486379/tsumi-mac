import { expect, test } from '@playwright/test';
import { buildWall, expectNoErrors, startGame, state, watchErrors } from './helpers';

test('dual view uses the same live frame through movement, rotation, clearing and game over', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop layout');
  const errors = watchErrors(page);
  await startGame(page);
  await expect(page.getByTestId('oblique-panel')).toHaveAttribute('open', '');
  const front = (await page.getByTestId('game-canvas').boundingBox())!;
  const side = (await page.getByTestId('oblique-canvas').boundingBox())!;
  expect(side.x).toBeGreaterThanOrEqual(front.x + front.width);
  const checkSync = async () => {
    await expect.poll(() => page.evaluate(() => window.__tsumimac!.views().synchronized)).toBe(true);
    const pair = await page.evaluate(() => window.__tsumimac!.views());
    expect(pair.oblique).toEqual(pair.front);
    expect(pair.obliqueFrames).toBeGreaterThan(0);
  };
  await checkSync();
  const yBeforeToggle = (await state(page)).activeY!;
  await page.getByTestId('oblique-panel').locator('summary').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('oblique-panel')).not.toHaveAttribute('open');
  await page.waitForTimeout(100);
  expect((await state(page)).activeY! - yBeforeToggle).toBeLessThan(40);
  await page.keyboard.press('Space');
  await checkSync();
  await page.getByTestId('oblique-panel').locator('summary').evaluate(el => (el as HTMLElement).blur());
  const x = (await state(page)).activeX!;
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => x - (await state(page)).activeX!).toBeCloseTo(36, 0);
  await checkSync();
  const q = (await state(page)).q;
  await page.keyboard.press('KeyX');
  await expect.poll(async () => (await state(page)).q).toBe((q + 1) % 4);
  await checkSync();
  const count = (await state(page)).score.devices;
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).score.devices).toBeGreaterThan(count);
  await checkSync();
  // Start with a clear floor: placing a row above an arbitrary earlier stack
  // lets the fixture tumble and is not a reproducible full-row arrangement.
  await page.keyboard.press('KeyP');
  await page.getByTestId('pause-restart').click();
  await expect.poll(async () => (await state(page)).score.devices).toBe(1);
  await checkSync();
  await page.evaluate(() => { for (let c = 0; c < 10; c += 2) window.__tsumimac!.placeLocked('miniM2', c, 17); });
  await expect.poll(async () => (await state(page)).score.lines).toBeGreaterThan(0);
  await checkSync();
  await page.keyboard.press('KeyP');
  const before = await state(page);
  await page.waitForTimeout(200);
  expect((await state(page)).steps).toBe(before.steps);
  await checkSync();
  await page.getByTestId('resume-button').click();
  await buildWall(page, 1);
  await expect(page.getByTestId('oblique-over')).toBeVisible({ timeout: 6000 });
  await checkSync();
  await expect(page.getByTestId('result-screen')).toBeVisible();
  await expectNoErrors(errors);
});

test('mobile folds the auxiliary view and keeps touch controls usable in both orientations', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch layout');
  const errors = watchErrors(page);
  await startGame(page);
  const panel = page.getByTestId('oblique-panel'), toggle = panel.locator('summary');
  await expect(panel).not.toHaveAttribute('open');
  expect(await page.evaluate(() => window.__tsumimac!.views().oblique)).toBeNull();
  await toggle.tap();
  await expect(page.getByTestId('oblique-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__tsumimac!.views().synchronized)).toBe(true);
  const vp = page.viewportSize()!;
  for (const id of ['game-canvas', 'touch-left', 'touch-right', 'touch-rotate', 'touch-soft']) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  }
  const x = (await state(page)).activeX!;
  await page.getByTestId('touch-left').tap();
  await expect.poll(async () => x - (await state(page)).activeX!).toBeCloseTo(36, 0);
  await toggle.tap();
  await expect.poll(() => page.evaluate(() => window.__tsumimac!.views().oblique)).toBeNull();
  await page.getByTestId('touch-pause').tap();
  const steps = (await state(page)).steps;
  // Resize/open while paused via DOM: the overlay itself remains unchanged.
  await page.evaluate(() => { const details = document.querySelector<HTMLDetailsElement>('.oblique-panel')!; details.open = true; });
  await expect.poll(() => page.evaluate(() => window.__tsumimac!.views().synchronized)).toBe(true);
  expect((await state(page)).steps).toBe(steps);
  await page.getByTestId('resume-button').tap();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  // Keep an explicitly opened mobile view open across orientation changes.
  await expect(panel).toHaveAttribute('open', '');
  await expect(page.getByTestId('oblique-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expectNoErrors(errors);
});

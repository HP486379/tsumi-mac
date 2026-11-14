import { test, expect } from '@playwright/test';

test('tap rotates the active Mac', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  const canvas = page.getByTestId('game-canvas');
  await expect(canvas).toBeVisible();
  const before = await page.evaluate(() => (window as any).__tsumimac.state().q as number);
  await canvas.click({ position: { x: 25, y: 25 } });
  await expect.poll(async () => page.evaluate(() => (window as any).__tsumimac.state().q as number)).toBe((before + 1) % 4);
});

test('drag moves Mac without rotating it', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  const canvas = page.getByTestId('game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const initial = await page.evaluate(() => (window as any).__tsumimac.state());
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 3);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 35, box!.y + box!.height / 3, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => (window as any).__tsumimac.state());
  expect(after.activeX).toBeGreaterThan(initial.activeX);
  expect(after.q).toBe(initial.q);
});

test('mobile layout hides the obsolete arrow controls', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only layout check');
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('touch-left-group')).toBeHidden();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
});

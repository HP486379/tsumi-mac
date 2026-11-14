import { test, expect } from '@playwright/test';

test('portrait iPhone layout keeps game board centered with oblique view closed and open', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile touch layout only');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('start-button').click();
  const screen = page.getByTestId('game-screen');
  const board = page.getByTestId('game-canvas');
  const panel = page.getByTestId('oblique-panel');
  await expect(board).toBeVisible();
  await expect.poll(async () => (await board.boundingBox())?.width ?? 0).toBeGreaterThan(100);

  const checkBoard = async () => {
    const screenBox = await screen.boundingBox();
    const boardBox = await board.boundingBox();
    expect(screenBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    if (!screenBox || !boardBox) return;
    // Board must not collapse into the narrow strip shown by the iOS build.
    expect(boardBox.width).toBeGreaterThan(180);
    expect(boardBox.height).toBeGreaterThan(350);
    const boardCenter = boardBox.x + boardBox.width / 2;
    const screenCenter = screenBox.x + screenBox.width / 2;
    expect(Math.abs(boardCenter - screenCenter)).toBeLessThan(12);
    expect(boardBox.x).toBeGreaterThanOrEqual(screenBox.x);
    expect(boardBox.x + boardBox.width).toBeLessThanOrEqual(screenBox.x + screenBox.width + 1);
  };

  await checkBoard();
  await panel.locator('summary').click();
  await expect(panel).toHaveJSProperty('open', true);
  await checkBoard();
  await panel.locator('summary').click();
  await expect(panel).toHaveJSProperty('open', false);
  await checkBoard();
});

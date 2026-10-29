import { expect, test } from '@playwright/test';
import { buildWall, expectNoErrors, startGame, state, watchErrors } from './helpers';

test.describe('PC（キーボード）', () => {
  test.skip(({ isMobile }) => isMobile, 'デスクトップのみ');

  test('タイトル→遊び方→ゲーム、キーボード操作一式', async ({ page }) => {
    const errs = watchErrors(page);
    await page.goto('/');
    await page.getByTestId('howto-button').click();
    await expect(page.getByTestId('howto-screen')).toBeVisible();
    await page.getByTestId('howto-back').click();
    await startGame(page);
    for (const id of ['hud-spent', 'hud-index', 'hud-level', 'hud-next', 'hud-lines']) await expect(page.getByTestId(id)).toBeVisible();

    const x0 = (await state(page)).activeX!;
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => x0 - (await state(page)).activeX!).toBeCloseTo(36, 0);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await state(page)).activeX!).toBeCloseTo(x0, 0);

    const q0 = (await state(page)).q;
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await state(page)).q).toBe((q0 + 1) % 4);
    await page.keyboard.press('KeyZ');
    await expect.poll(async () => (await state(page)).q).toBe(q0);
    await page.keyboard.press('KeyX');
    await expect.poll(async () => (await state(page)).q).toBe((q0 + 1) % 4);

    const y0 = (await state(page)).activeY!;
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowDown');
    expect((await state(page)).activeY! - y0).toBeGreaterThan(60);

    const d0 = (await state(page)).score.devices;
    await page.keyboard.press('Space');
    await page.waitForFunction((n) => window.__tsumimac!.state().score.devices > n, d0, { timeout: 8000 });
    await expectNoErrors(errs);
  });

  test('一時停止・再開・画面非表示で停止', async ({ page }) => {
    await startGame(page);
    await page.keyboard.press('KeyP');
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    const s1 = (await state(page)).steps;
    await page.waitForTimeout(500);
    expect((await state(page)).steps).toBe(s1);
    await page.getByTestId('resume-button').click();
    await expect.poll(async () => (await state(page)).steps).toBeGreaterThan(s1);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).paused).toBe(false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await state(page)).paused).toBe(true);
  });

  test('イベント表示・行消し・ゲームオーバー・共有・再挑戦・ハイスコア保持', async ({ page, context }) => {
    const errs = watchErrors(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await startGame(page);

    await page.evaluate(() => window.__tsumimac!.triggerEvent('refurb'));
    await expect(page.getByTestId('toast').filter({ hasText: '整備済製品入荷' })).toBeVisible();
    await page.evaluate(() => window.__tsumimac!.triggerEvent('launch'));
    await expect(page.getByTestId('toast').filter({ hasText: '新製品発表' })).toBeVisible();
    expect((await state(page)).status).toBe('running');

    await page.evaluate(() => { for (let c = 0; c < 10; c += 2) window.__tsumimac!.placeLocked('miniM4', c, 17); });
    await page.waitForFunction(() => window.__tsumimac!.state().score.lines >= 1);
    const sc = (await state(page)).score;
    expect(Math.abs(sc.spent - sc.fieldValue - sc.cleared)).toBeLessThan(1);

    await buildWall(page, 1);
    await expect(page.getByTestId('collapse-overlay')).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId('boot-line')).toHaveText('起動したMac：0台');

    await page.evaluate(() => { (navigator as { share?: unknown }).share = undefined; });
    await page.getByTestId('share-button').click();
    await expect(page.getByTestId('share-msg')).toContainText('コピー');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('散財総額');

    await page.evaluate(() => {
      window.__shared = null;
      (navigator as { share?: unknown }).share = (d: ShareData) => { window.__shared = d; return Promise.resolve(); };
    });
    await page.getByTestId('share-button').click();
    await expect.poll(() => page.evaluate(() => window.__shared?.text ?? '')).toContain('積みMac');

    await page.getByTestId('retry-button').click();
    await page.waitForFunction(() => window.__tsumimac?.state().active != null);
    const s = await state(page);
    expect(s.score.devices).toBe(1);
    expect(s.score.lines).toBe(0);

    await page.reload();
    await expect(page.getByTestId('hs-spent')).not.toHaveText('¥0');
    await expectNoErrors(errs);
  });

  test('音声OFFが機能し、設定がリロード後も保持される', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('toggle-se').click();
    await page.getByTestId('toggle-bgm').click();
    await page.getByTestId('start-button').click();
    await page.waitForFunction(() => window.__tsumimac?.state().active != null);
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']) await page.keyboard.press(k);
    await page.waitForTimeout(1500);
    const s = await state(page);
    expect(s.audioPlayed).toBe(0);
    expect(s.bgmPlaying).toBe(false);
    await page.reload();
    await expect(page.getByTestId('toggle-se')).toContainText('OFF');
    await expect(page.getByTestId('toggle-bgm')).toContainText('OFF');
  });
});

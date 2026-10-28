import { test,expect } from '@playwright/test';
import { watchErrors } from './helpers';

test('real mode is playable, synchronized, survives clearing/restart, and preserves classic saves',async({page,isMobile},testInfo)=>{
  test.skip(isMobile,'Desktop physics/visual fixture');
  const errors=watchErrors(page),old=JSON.stringify({bestSpent:765432,bestLines:4,bestCleared:12,bestMaxCombo:2,plays:9});
  await page.addInitScript(value=>{localStorage.setItem('tsumimac.highscore.v1',value);},old);
  await page.goto('/?seed=20261028');await page.getByTestId('real-start-button').click();
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-mode','real');
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
  await expect(page.getByTestId('game-mode')).toContainText('実寸540×900');
  await page.keyboard.press('KeyP');
  await page.evaluate(()=>{
    const d=window.__tsumimac!;
    for(let col=0;col<10;col+=2)d.placeLocked('studio',col,17);
    d.placeLocked('pro',1,10);d.placeLocked('macPro2013',5,11,1);d.placeLocked('miniM4',6,14);d.placeLocked('miniM1',7,15);d.placeLocked('miniM2',7,16);
    d.clearRows([14]);
  });
  // Resume/pause draws a single actual shared engine state including fragments.
  await page.getByTestId('resume-button').click();await page.waitForTimeout(70);await page.keyboard.press('KeyP');
  const pair=await page.evaluate(()=>window.__tsumimac!.views());expect(pair.front).toEqual(pair.oblique);
  expect(pair.front!.items.some(i=>i.key.geometry)).toBe(true);
  expect(pair.front!.items.every(i=>i.key.mode==='real')).toBe(true);
  await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:hidden!important}'});
  await page.screenshot({path:testInfo.outputPath('real-fragments-game.png')});
  await page.addStyleTag({content:'[data-testid="pause-overlay"]{visibility:visible!important}'});
  await page.getByTestId('pause-restart').click();
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-mode','real');
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
  const x=await page.evaluate(()=>window.__tsumimac!.state().activeX!);await page.keyboard.press('ArrowLeft');
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().activeX!)).toBeLessThan(x);
  await page.keyboard.press('KeyX');await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.state().score.devices)).toBeGreaterThan(1);
  expect(await page.evaluate(()=>localStorage.getItem('tsumimac.highscore.v1'))).toBe(old);
  expect(errors).toEqual([]);
});

test('real mode on mobile keeps controls accessible and can open the live oblique view',async({page,isMobile})=>{
  test.skip(!isMobile,'Touch layout');await page.goto('/?seed=28');await page.getByTestId('real-start-button').tap();
  await expect(page.getByTestId('game-screen')).toHaveAttribute('data-mode','real');
  await page.getByTestId('oblique-panel').locator('summary').tap();
  await expect.poll(()=>page.evaluate(()=>window.__tsumimac!.views().synchronized)).toBe(true);
  await expect(page.getByTestId('touch-left')).toBeInViewport();await page.getByTestId('touch-left').tap();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

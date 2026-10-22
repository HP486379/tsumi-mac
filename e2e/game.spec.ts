import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__TSUMI__);
});
test("start, move, rotate, pause, touch controls, visibility and resize", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "積みはじめる" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().status))
    .toBe("playing");
  const before = await page.evaluate(() => window.__TSUMI__!.state().active!.x);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "左移動", exact: true }).tap();
  else await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().active!.x))
    .toBeLessThan(before);
  // Let tall devices fall far enough to rotate clear of the top edge.
  await page.waitForTimeout(450);
  const angle = await page.evaluate(
    () => window.__TSUMI__!.state().active!.angle,
  );
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "右回転", exact: true }).tap();
  else await page.keyboard.press("x");
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().active!.angle))
    .not.toBe(angle);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "物欲も、ひと休み。" }),
  ).toBeVisible();
  const paused = await page.evaluate(() => window.__TSUMI__!.state().active!.y);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__TSUMI__!.state().active!.y)).toBe(
    paused,
  );
  await page.getByRole("button", { name: "積むのを再開する" }).click();
  await page
    .getByRole("button", { name: "ハードドロップ", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__TSUMI__!.state().entries.some((e) => e.locked),
      ),
    )
    .toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "遊び方", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "遊び方" })).toContainText(
    "丸ごと整理",
  );
  await page.getByRole("button", { name: "わかった" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().status))
    .toBe("paused");
  await page.getByRole("button", { name: "積むのを再開する" }).click();
  // Dispatching hidden state exercises the same handler as switching tabs.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().status))
    .toBe("paused");
  expect(errors).toEqual([]);
});
test("row clear, real danger timeout, score persistence, share and retry", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => window.__TSUMI__!.scenario("row"));
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().rows))
    .toBe(1);
  await expect(page.getByTestId("organized")).toHaveText("¥250,000");
  await expect(page.getByRole("status")).toContainText("資産整理");
  await page.evaluate(() => window.__TSUMI__!.triggerDanger());
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().status))
    .toBe("over");
  await expect(
    page.getByRole("heading", { name: "積みMac崩壊" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("起動したMac：");
  await expect(page.getByTestId("best")).toHaveText("¥250,000");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.getByRole("button", { name: "結果をテキストで共有" }).click();
  await expect(page.getByRole("status")).toContainText("コピーしました");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "¥250,000",
  );
  await page.getByRole("button", { name: "もう一度積む" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__TSUMI__!.state().status))
    .toBe("playing");
  await expect(page.getByTestId("rows")).toHaveText("00 ROWS");
  await page.reload();
  await expect(page.getByTestId("best")).toHaveText("¥250,000");
  expect(errors).toEqual([]);
});
test("sound preferences, blocked spawn, share cancellation and fallback", async ({
  page,
}) => {
  const sfx = page.getByRole("button", { name: "効果音" });
  await sfx.click();
  await expect(sfx).toHaveAttribute("aria-pressed", "false");
  const bgm = page.getByRole("button", { name: "BGM" });
  await bgm.click();
  await expect(bgm).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.waitForFunction(() => !!window.__TSUMI__);
  await expect(sfx).toHaveAttribute("aria-pressed", "false");
  await expect(bgm).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.__TSUMI__!.scenario("blocked"));
  await expect(
    page.getByRole("heading", { name: "積みMac崩壊" }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.reject(new DOMException("cancel", "AbortError")),
    }),
  );
  await page.getByRole("button", { name: "結果をテキストで共有" }).click();
  await expect(page.getByRole("status")).toContainText("キャンセル");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.resolve(),
    }),
  );
  await page.getByRole("button", { name: "結果をテキストで共有" }).click();
  await expect(page.getByRole("status")).toContainText("共有しました");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("denied")),
    });
  });
  await page.getByRole("button", { name: "結果をテキストで共有" }).click();
  await expect(page.getByRole("status")).toContainText("選択してコピー");
  await expect(
    page.getByRole("textbox", { name: "共有用の結果テキスト" }),
  ).toHaveValue(/起動したMac：0台/);
});

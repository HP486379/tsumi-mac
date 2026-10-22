import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("built preview plays without any external assets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const html = await readFile("dist/preview.html", "utf8");
  const extraRequests: string[] = [];
  // Serve exactly the generated HTML, at a nested path, with no asset server.
  // This tests the same content as a static HTML viewer without requiring file:
  // navigation, which managed Chromium blocks by administrator policy.
  await page.route("**/*", (route) => {
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: html });
    extraRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto("http://127.0.0.1:4175/tsumi-mac/preview.html");
  await page.getByRole("button", { name: "積みはじめる" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "左移動", exact: true }).click();
  await page.getByRole("button", { name: "ハードドロップ", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await expect(page.getByRole("heading", { name: "物欲も、ひと休み。" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(extraRequests).toEqual([]);
});

test("built preview renders in a sandboxed HTML visualization", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const html = await readFile("dist/preview.html", "utf8");
  await page.evaluate((srcdoc) => {
    document.body.innerHTML = "";
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.cssText = "width:100%;height:95vh;border:0";
    frame.srcdoc = srcdoc;
    document.body.append(frame);
  }, html);
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "積みはじめる" }).click();
  await expect(frame.locator("canvas")).toBeVisible();
  await frame.getByRole("button", { name: "一時停止", exact: true }).click();
  await expect(frame.getByRole("heading", { name: "物欲も、ひと休み。" })).toBeVisible();
  expect(errors).toEqual([]);
});

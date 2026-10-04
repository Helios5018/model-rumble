import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const snap = (page: any) => page.evaluate(() => (window as any).__RUMBLE__.snapshot());
const ids = ["deepseek", "claude", "gpt", "gemini", "qwen", "grok", "doubao", "glm", "kimi"];

test("four CPU levels persist into HUD and modes disable the selector", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#difficulty option")).toHaveText(["Low", "Medium", "High", "Ultra"]);
  for (const level of ["low", "medium", "high", "ultra"]) {
    await page.locator("#difficulty").selectOption(level);
    await page.locator("#start").click();
    expect((await snap(page)).match.difficulty).toBe(level);
    await expect(page.locator(".fighter-hud.right")).toContainText(level[0].toUpperCase() + level.slice(1));
    await page.locator("#back").click();
    await expect(page.locator("#difficulty")).toHaveValue(level);
  }
  for (const mode of ["local", "training"]) {
    await page.locator(`[data-mode=${mode}]`).click();
    await expect(page.locator("#difficulty")).toBeDisabled();
  }
});

test("nine mirror costumes and all eighteen melee animations render through real keys", async ({ page }) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("../scratchpad/visual-review", { recursive: true });
  for (const id of ids) {
    await page.goto("/");
    await page.locator(`[data-fighter=${id}]`).click();
    await page.locator("#pick-p2").click();
    await page.locator(`[data-fighter=${id}]`).click();
    await expect(page.locator(`[data-fighter=${id}] em`)).toHaveText(["P1", "P2"]);
    await expect(page.locator("#choose-opponent")).toContainText("P2 替代配色");
    await page.locator('[data-mode=training]').click();
    await page.locator("#start").click();
    await expect.poll(async () => (await snap(page)).match.countdown).toBe(0);
    const before = await snap(page);
    expect(before.visuals.every((v: any) => v.badge)).toBe(true);
    expect(before.visuals[0].color).not.toBe(before.visuals[1].color);
    for (const [key, attack] of [["j", "light"], ["k", "heavy"]]) {
      await page.keyboard.down(key);
      await page.waitForFunction(() => (window as any).__RUMBLE__.snapshot().visuals[0].meleeVisible);
      await page.keyboard.up(key);
      await page.keyboard.press("Escape");
      const during = await snap(page);
      expect(during.match.fighters[0].cooldown[attack]).toBeGreaterThan(0);
      expect(during.visuals[0].meleeVisible).toBe(true);
      expect(Math.abs(during.visuals[0].bodyX)).toBeGreaterThan(0.03);
      await page.locator("#pause-overlay").evaluate((el: HTMLElement) => { el.style.visibility = "hidden"; });
      await page.screenshot({ path: `../scratchpad/visual-review/${id}-${attack}.png` });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(850);
      expect((await snap(page)).visuals[0].meleeVisible).toBe(false);
    }
    expect((await snap(page)).match.fighters[1].damage).toBe(0);
    await page.locator("#back").click();
    await page.locator(`[data-fighter=${id === "gpt" ? "claude" : "gpt"}]`).click();
    await expect(page.locator("#choose-opponent")).not.toContainText("替代配色");
  }
  expect(errors).toEqual([]);
});

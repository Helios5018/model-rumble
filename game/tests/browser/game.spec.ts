import { test, expect } from "@playwright/test";
const snap = async (page: any) =>
  page.evaluate(() => (window as any).__RUMBLE__.snapshot());
const startPractice = async (page: any) => {
  await page.goto("/");
  await page.getByRole("button", { name: "练习场", exact: true }).click();
  await page.locator("#start").click();
  await expect.poll(async () => (await snap(page)).match.countdown).toBe(0);
};
async function hold(page: any, key: string, time = 250) {
  await page.keyboard.down(key);
  await page.waitForTimeout(time);
  await page.keyboard.up(key);
}
test("lobby, all nine 3D portraits, selection, latest intel and sound/quality", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("[data-fighter]")).toHaveCount(9);
  for (const id of [
    "deepseek",
    "claude",
    "gpt",
    "gemini",
    "qwen",
    "grok",
    "doubao",
    "glm",
    "kimi",
  ]) {
    await page.locator(`[data-fighter=${id}]`).click();
    expect((await snap(page)).selected).toBe(id);
    await expect(page.locator(`[data-fighter=${id}]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.locator("[data-fighter=glm]").click();
  await page.screenshot({ path: "../docs/3d/niulai-lobby.png" });
  await page.locator("[data-fighter=deepseek]").click();
  await page.screenshot({ path: "../docs/3d/lobby.png" });
  await page.locator("#intel").click();
  await expect(page.getByRole("dialog")).toContainText("牛来");
  await expect(page.getByRole("dialog")).toContainText("GPT-6 Astra");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toContainText("静音");
  await page.locator("#quality").click();
  await expect(page.locator("#quality")).toContainText("流畅");
  expect(errors).toEqual([]);
});
test("real keyboard movement, double jump, platform landing, melee hit and pause", async ({
  page,
}) => {
  await startPractice(page);
  const x = (await snap(page)).match.fighters[0].x;
  await hold(page, "d", 450);
  expect((await snap(page)).match.fighters[0].x).toBeGreaterThan(x + 1);
  await page.keyboard.press("w");
  await page.waitForTimeout(130);
  expect((await snap(page)).match.fighters[0].y).toBeGreaterThan(0.5);
  await page.keyboard.press("w");
  await expect
    .poll(async () => (await snap(page)).match.fighters[0].jumps)
    .toBe(0);
  await page.waitForTimeout(1500);
  await hold(page, "d", 650);
  await hold(page, "j", 1100);
  expect((await snap(page)).match.fighters[1].damage).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  expect((await snap(page)).paused).toBe(true);
  const elapsed = (await snap(page)).match.elapsed;
  await page.waitForTimeout(250);
  expect((await snap(page)).match.elapsed).toBe(elapsed);
  await page.locator("#resume").click();
  await page.screenshot({ path: "../docs/3d/battle.png" });
});
test("all fighters can cast both specials and ultimate through actual keys", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const id of [
    "deepseek",
    "claude",
    "gpt",
    "gemini",
    "qwen",
    "grok",
    "doubao",
    "glm",
    "kimi",
  ]) {
    await page.goto("/");
    await page.locator(`[data-fighter=${id}]`).click();
    await page.getByRole("button", { name: "练习场", exact: true }).click();
    await page.locator("#start").click();
    await expect.poll(async () => (await snap(page)).match.countdown).toBe(0);
    await page.keyboard.press("l");
    await page.waitForTimeout(100);
    expect(
      (await snap(page)).match.fighters[0].cooldown.special,
    ).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await page.keyboard.press("u");
    await page.waitForTimeout(100);
    expect(
      (await snap(page)).match.fighters[0].cooldown.utility,
    ).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await page.keyboard.press("i");
    await page.waitForTimeout(100);
    expect(
      (await snap(page)).match.fighters[0].cooldown.ultimate,
    ).toBeGreaterThan(0);
    await page.screenshot({ path: `../docs/3d/ultimate-${id}.png` });
    await page.waitForTimeout(200);
  }
  expect(errors).toEqual([]);
});
test("local P2 keyboard controls, block and focus-safe pause", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "本地双人", exact: true }).click();
  await page.locator("#start").click();
  await expect.poll(async () => (await snap(page)).match.countdown).toBe(0);
  await hold(page, "ArrowLeft", 300);
  expect((await snap(page)).match.fighters[1].x).toBeLessThan(3.5);
  await page.keyboard.down("b");
  await page.waitForTimeout(100);
  expect((await snap(page)).match.fighters[1].guard).toBe(true);
  await page.keyboard.up("b");
  await page.keyboard.press("/");
  await page.waitForTimeout(100);
  expect((await snap(page)).match.fighters[1].cooldown.special).toBeGreaterThan(
    0,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect((await snap(page)).paused).toBe(true);
  await page.locator("#resume").click();
  await page.locator("#back").click();
  expect((await snap(page)).screen).toBe("lobby");
});
test("a complete real-time AI match reaches results and can rematch", async ({
  page,
}) => {
  test.setTimeout(200000);
  await page.goto("/?autop1=1");
  await page.locator("[data-fighter=grok]").click();
  await page.locator("#pick-p2").click();
  await page.locator("[data-fighter=glm]").click();
  await page.locator("#start").click();
  await expect(page.locator("#rematch")).toBeVisible({ timeout: 185000 });
  expect((await snap(page)).match.hits).toBeGreaterThan(10);
  await page.screenshot({ path: "../docs/3d/result.png" });
  await page.keyboard.press("r");
  await expect(page.locator("#timer")).toHaveText("180");
  expect((await snap(page)).match.fighters[0].stocks).toBe(3);
});
test("small landscape and portrait touch controls remain operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator("#start")).toBeInViewport();
  await page.screenshot({ path: "../docs/3d/landscape.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#start").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "练习场", exact: true }).click();
  await page.locator("#start").click();
  await expect.poll(async () => (await snap(page)).match.countdown).toBe(0);
  await expect(page.locator(".touch-controls")).toBeVisible();
  const x = (await snap(page)).match.fighters[0].x;
  const b = page.locator("[data-key=KeyD]");
  const rect = await b.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  expect((await snap(page)).match.fighters[0].x).toBeGreaterThan(x);
  await page.screenshot({ path: "../docs/3d/mobile.png" });
});
test("repeated summon rounds reuse GPU resources", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-fighter=qwen]").click();
  await page.getByRole("button", { name: "练习场", exact: true }).click();
  const memory: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.locator("#start").click();
    await expect.poll(async () => (await snap(page)).match.countdown).toBe(0);
    await page.keyboard.press("l");
    await page.waitForTimeout(700);
    memory.push((await snap(page)).geometries);
    await page.locator("#back").click();
  }
  expect(memory[2]).toBeLessThanOrEqual(memory[1] + 3);
  console.log("GPU geometry across summon rounds:", memory);
});

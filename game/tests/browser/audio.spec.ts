import { test, expect } from "@playwright/test";

const snapshot = (page: any) => page.evaluate(() => (window as any).__RUMBLE__.snapshot());
const busState = (page: any) => page.evaluate(() => (window as any).__audioTest.snapshot());
async function audioHarness(page: any) {
  await page.goto("/audio-lab.html");
  await page.evaluate(async () => {
    // Exercise the actual browser Web Audio implementation, not an audio mock.
    const url = "/src/rumble/audio.ts";
    const { AudioBus } = await import(/* @vite-ignore */ url);
    (window as any).__audioTest = new AudioBus();
    document.querySelector("#stop")!.addEventListener("click", () => (window as any).__audioTest.unlock());
  });
  await page.locator("#stop").click();
  await expect.poll(async () => (await busState(page)).state).toBe("running");
  await expect.poll(async () => (await busState(page)).loaded).toBe(52);
  expect((await busState(page)).failed).toEqual([]);
}

test("real audio buffers decode, variations rotate, important cues survive a burst", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await audioHarness(page);
  const takes = await page.evaluate(async () => {
    const bus = (window as any).__audioTest;
    const files: string[] = [];
    for (let i = 0; i < 8; i++) {
      bus.play("hit_light");
      files.push(bus.snapshot().recent.at(-1).file);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    bus.stopEffects();
    for (let i = 0; i < 12; i++) bus.play(["swing", "jump", "respawn"][i % 3], undefined, 0, i);
    const before = bus.snapshot().active;
    bus.play("ko");
    return { files, before, after: bus.snapshot() };
  });
  for (let i = 1; i < takes.files.length; i++) expect(takes.files[i]).not.toBe(takes.files[i - 1]);
  expect(takes.before).toBe(12);
  expect(takes.after.active).toBeLessThanOrEqual(12);
  expect(takes.after.active).toBeGreaterThan(0);
  expect(takes.after.recent.at(-1)?.name).toBe("ko");
  await expect.poll(async () => (await busState(page)).musicGain).toBeLessThan(0.05);
  await expect.poll(async () => (await busState(page)).musicGain).toBeGreaterThan(0.12);
  expect(errors).toEqual([]);
});

test("mute and pause stop tails; win event stays silent; music resumes", async ({ page }) => {
  await audioHarness(page);
  const state = await page.evaluate(() => {
    const bus = (window as any).__audioTest;
    bus.play("ko");
    bus.pause();
    bus.play("hit_light");
    const paused = bus.snapshot();
    bus.toggle();
    bus.toggle(); // Unmuting while paused must not restart music.
    const stillPaused = bus.snapshot();
    bus.resume();
    const count = bus.snapshot().recent.length;
    bus.event({ type: "win", x: 0, y: 0, color: "#fff" });
    const afterWin = bus.snapshot().recent.length;
    bus.toggle();
    bus.play("counter");
    return { paused, stillPaused, count, afterWin, muted: bus.snapshot() };
  });
  expect(state.paused.active).toBe(0);
  expect(state.paused.musicPaused).toBe(true);
  expect(state.stillPaused.musicPaused).toBe(true);
  expect(state.afterWin).toBe(state.count);
  expect(state.muted.active).toBe(0);
  expect(state.muted.musicPaused).toBe(true);
  await page.evaluate(() => (window as any).__audioTest.toggle());
  await expect.poll(async () => (await busState(page)).musicPaused).toBe(false);
});

test("keyboard dodge, help pause and mute work in the actual game", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "练习场", exact: true }).click();
  await page.locator("#start").click();
  await expect.poll(async () => (await snapshot(page)).match.countdown).toBe(0);
  await expect.poll(async () => (await snapshot(page)).audio.loaded).toBe(52);
  await page.keyboard.down("d");
  await page.keyboard.press("Shift", { delay: 100 });
  await page.keyboard.up("d");
  await expect.poll(async () => (await snapshot(page)).audio.recent.some((e: any) => e.name === "dodge")).toBe(true);
  await page.locator("#help").click();
  expect((await snapshot(page)).audio.paused).toBe(true);
  expect((await snapshot(page)).audio.active).toBe(0);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).audio.musicPaused).toBe(false);
  await page.keyboard.press("Escape");
  expect((await snapshot(page)).audio.musicPaused).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator("#sound").click();
  expect((await snapshot(page)).audio.muted).toBe(true);
  await page.locator("#sound").click();
  await expect.poll(async () => (await snapshot(page)).audio.musicPaused).toBe(false);
  expect((await snapshot(page)).audio.failed).toEqual([]);
  expect(errors).toEqual([]);
});

test("listening page plays all 52 new takes, six originals and both combos", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.url().includes("/assets/audio/") && r.status() >= 400) errors.push(r.url()); });
  await page.goto("/audio-lab.html");
  const buttons = page.locator("[data-take]");
  await expect(buttons).toHaveCount(58);
  for (let i = 0; i < 58; i++) {
    await buttons.nth(i).click();
    await expect(page.locator("#status")).toContainText("秒");
  }
  await page.locator("#old-combo").click();
  await expect(page.locator("#status")).toHaveText("正在播放旧版连段");
  await page.locator("#new-combo").click();
  await expect(page.locator("#status")).toHaveText("正在播放新版连段");
  await page.locator("#stop").click();
  await expect(page.locator("#status")).toHaveText("已停止");
  expect(errors).toEqual([]);
});

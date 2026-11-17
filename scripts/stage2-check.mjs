import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
process.env.TEMP = process.env.TMP = path.resolve("temp");
const root = path.resolve("temp/stage2-" + Date.now());
await fs.mkdir(root, { recursive: true });
let server, browser;
const errors = [];
try {
  server = spawn(process.execPath, ["scripts/server.mjs"], {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      LIVEDANCE_PORT: "5382",
      LIVEDANCE_DATA_DIR: path.join(root, "music"),
      LIVEDANCE_SKIN_DIR: path.join(root, "skins"),
    },
  });
  server.stderr.on("data", (b) => console.log(String(b)));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5382/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5382/?empty=1&diagnostics=1");
  await page.waitForFunction(() => window.__V05?.inspect().ready);
  await page.evaluate(() => {
    const w = window.__V05.world;
    w.config.afk = false;
    w.config.adaptive = false;
    w.config.quality = "MEDIUM";
    w.config.replacement = "reject";
  });
  const inspect = () => page.evaluate(() => window.__V05.inspect());
  const evt = (type, id, extra = {}) => ({
    schemaVersion: 1,
    source: "simulator",
    eventId: type + "-" + id,
    viewerId: id,
    username: id,
    eventType: type,
    giftCount: 1,
    timestamp: Date.now(),
    metadata: {},
    ...extra,
  });
  const send = (e) => page.evaluate((e) => window.__V05.submit(e), e);
  const follow = evt("FOLLOW", "viewer-first");
  assert.equal((await send(follow)).reason, "queued");
  assert.equal((await send(follow)).reason, "duplicate");
  await page.waitForFunction(() => window.__V05.inspect().actors.length === 1);
  const first = (await inspect()).actors[0].skinId;
  assert.equal((await inspect()).registered.length, 1);
  for (let i = 1; i < 30; i++)
    assert.equal(
      (await send(evt("VIEWER_JOIN", "viewer-" + i))).reason,
      "queued",
    );
  await page.waitForFunction(
    () => window.__V05.inspect().actors.length === 30,
    {},
    { timeout: 30000 },
  );
  let s = await inspect();
  assert.equal(s.registered.length, 30);
  assert.equal(s.visible.length, 10);
  const assignments = s.actors.map((a) => [a.id, a.skinId]).sort();
  const vip = evt("GIFT", "viewer-29", {
    giftId: "galaxy",
    giftName: "Galaxia",
    metadata: { tier: "HIGH" },
  });
  await send(vip);
  await page.waitForFunction(
    () => window.__V05.inspect().event?.kind === "vip",
  );
  s = await inspect();
  assert.equal(s.event.id, "viewer-29");
  assert.equal(s.visible[0], "viewer-29");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/v06/evidence/stage2-vip.png" });
  await page.keyboard.press("F8");
  const stopped = await inspect();
  await page.waitForTimeout(700);
  s = await inspect();
  assert.equal(s.paused, true);
  assert.equal(s.registered.length, 30);
  assert.deepEqual(s.camera, stopped.camera);
  assert.equal((await send(evt("FOLLOW", "blocked"))).reason, "paused");
  assert.deepEqual(s.actors.map((a) => [a.id, a.skinId]).sort(), assignments);
  await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  assert.equal((await inspect()).paused, false);
  await send(evt("SIMULATED", "viewer-first", { giftId: "fever-demo" }));
  await page.waitForFunction(
    () => window.__V05.inspect().event?.kind === "fever",
  );
  assert.equal((await inspect()).registered.length, 30);
  await page.waitForTimeout(300);
  await page.keyboard.press("F8");
  assert.equal((await inspect()).queued, 0);
  await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.__V05?.inspect().ready);
  await send({ ...evt("FOLLOW", "viewer-first"), eventId: "restart" });
  await page.waitForFunction(() => window.__V05.inspect().actors.length === 1);
  assert.equal((await inspect()).actors[0].skinId, first);
  await page
    .locator("nav")
    .getByRole("button", { name: "Dancers", exact: true })
    .click();
  await page.waitForSelector(".skin-card");
  assert.equal(await page.locator(".skin-card").count(), 3);
  await page.waitForFunction(() => !window.__V05.inspect().event);
  await page.locator("[data-skin-preview]").first().click();
  await page.waitForFunction(() => !!window.__V05.inspect().preview);
  assert.equal((await inspect()).registered.length, 1);
  await page.locator('[data-v05="exit-preview"]').click();
  assert.deepEqual(errors, []);
  const core = await page.evaluate(() => window.__LiveDance.inspect());
  assert.deepEqual(core.errors, []);
  await fs.writeFile(
    "docs/v06/stage2.json",
    JSON.stringify(
      {
        gate: "PASS",
        checks: [
          "Follow creates skin",
          "dedup",
          "30 identities/10 featured",
          "VIP correct waiting viewer",
          "F8 freezes camera, preserves identities, rejects events",
          "explicit recovery",
          "Fever preserves participants",
          "skin persists after reload",
          "library preview does not create viewer",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Stage2 PASS");
} finally {
  await browser?.close();
  server?.kill();
}

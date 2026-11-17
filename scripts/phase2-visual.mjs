import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const port = 5274;
const server = spawn(process.execPath, ["scripts/server.mjs"], {
  windowsHide: true, stdio: "pipe",
  env: { ...process.env, LIVEDANCE_PORT: String(port), LIVEDANCE_DATA_DIR: "../../work/v04-phase2-visual-data" },
});
let browser;
const errors = [];
try {
  await new Promise((resolve, reject) => { server.stdout.once("data", resolve); server.once("error", reject); });
  browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-precise-memory-info"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/?empty=1&diagnostics=1`);
  await page.waitForFunction(() => !!window.__V04?.debug && !!window.__LiveDance);
  await page.evaluate(() => {
    window.__V04.configure({ version: 1, backend: "BLOCK", palette: "AUTO", accessory: "AUTO", dance: "AUTO" });
    const { world, scene } = window.__V04.debug;
    Object.assign(world.config, { maxDancers: 30, adaptive: false, quality: "MEDIUM", afk: false, cameraAuto: true, names: true, safeAreas: true });
    document.querySelector("#safe-area").classList.add("show");
    scene.setQuality("MEDIUM");
    for (let i = 0; i < 30; i++) world.bus.emit({ schemaVersion: 1, eventId: `visual-join-${i}`, source: "simulator", viewerId: `visual-${i}`, username: `visual.viewer.${i}`, eventType: "VIEWER_JOIN", giftCount: 1, timestamp: Date.now(), metadata: {} });
  });
  await page.waitForFunction(() => window.__LiveDance.snapshot().dancers === 30, null, { timeout: 40000 });
  const resetPresentation = () => page.evaluate(() => {
    const { world, scene } = window.__V04.debug;
    scene.presentation.cancel();
    scene.entertainment.reset();
    scene.cinema.reset();
    world.effects.active.clear();
    for (const dancer of world.spawn.dancers.values()) {
      dancer.vipUntil = 0;
      dancer.featuredUntil = 0;
    }
    world.config.cameraAuto = false;
    world.camera.wide(world.now, world.config);
  });
  const results = [];
  for (const [width, height] of [[365, 648], [720, 1280]]) {
    await resetPresentation();
    await page.evaluate(([w, h]) => {
      const host = document.querySelector("#stage");
      for (const [key, value] of Object.entries({ width: `${w}px`, height: `${h}px`, "max-width": "none", "max-height": "none", "aspect-ratio": "auto" })) host.style.setProperty(key, value, "important");
      window.__V04.debug.scene.resize();
    }, [width, height]);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__V04.debug.clearSamples());
    await page.waitForTimeout(3000);
    await page.locator("#stage").screenshot({ path: `docs/v04/screenshots/phase2-crowd-${width}.png` });
    const crowd = await page.evaluate(() => {
      const { scene } = window.__V04.debug;
      return { visibleNames: [...scene.labels.values()].filter((label) => label.visible).length, ...window.__LiveDance.snapshot() };
    });
    await page.evaluate(() => {
      const { world } = window.__V04.debug;
      world.config.cameraAuto = true;
      world.bus.emit({ schemaVersion: 1, eventId: `visual-vip-${Date.now()}`, source: "simulator", viewerId: "visual-15", username: "visual.viewer.15", eventType: "GIFT", giftId: "galaxy", giftName: "Galaxy", giftCount: 1, timestamp: Date.now(), metadata: {} });
    });
    await page.waitForFunction(() => window.__LiveDance.snapshot().camera === "VIP", null, { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__V04.debug.clearSamples());
    await page.waitForTimeout(2200);
    await page.locator("#stage").screenshot({ path: `docs/v04/screenshots/phase2-vip-${width}.png` });
    const vip = await page.evaluate(() => {
      const { scene } = window.__V04.debug;
      return { frame: scene.subjectFrame(), visibleNames: [...scene.labels.values()].filter((label) => label.visible).length, ...window.__LiveDance.snapshot() };
    });
    results.push({ width, height, crowd, vip });
  }
  assert.deepEqual(errors, []);
  await mkdir(path.join("docs", "v04"), { recursive: true });
  await writeFile("docs/v04/phase2-visual.json", JSON.stringify({ errors, results }, null, 2));
  console.log(JSON.stringify({ errors, results: results.map(({ width, height, crowd, vip }) => ({ width, height, crowd: { fps: crowd.fps, p95: crowd.p95, visibleNames: crowd.visibleNames, ingress: crowd.ingress }, vip: { fps: vip.fps, p95: vip.p95, visibleNames: vip.visibleNames, frame: vip.frame } })) }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}

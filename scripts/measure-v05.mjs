import { harness } from "./v05-harness.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const h = await harness("measure");
const { page } = h;
const rows = [],
  cycles = [];
const start = Date.now();
const cdp = await page.context().newCDPSession(page);
async function resources() {
  await cdp.send("HeapProfiler.collectGarbage");
  return page.evaluate(() => ({
    metrics: window.__LiveDance.snapshot(),
    heap: performance.memory?.usedJSHeapSize,
    show: window.__V05.inspect(),
  }));
}
async function measure(label, n, resolution, seconds = 8) {
  const data = await page.evaluate(async (seconds) => {
    const raf = [],
      cpu = [];
    let previous;
    await new Promise((resolve) => {
      const end = performance.now() + seconds * 1000;
      function tick(t) {
        if (previous !== undefined) raf.push(t - previous);
        previous = t;
        cpu.push(window.__LiveDance.snapshot().cpuMs);
        if (t < end) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length,
      p95 = (a) => a.sort((a, b) => a - b)[Math.floor(a.length * 0.95)];
    return {
      fps: 1000 / avg(raf),
      frameMs: avg(raf),
      p95RAF: p95(raf),
      cpuMean: avg(cpu),
      cpuP95: p95(cpu),
      samples: raf.length,
      metrics: window.__LiveDance.snapshot(),
      heap: performance.memory?.usedJSHeapSize,
      show: window.__V05.inspect(),
    };
  }, seconds);
  assert.equal(data.metrics.width, resolution[0]);
  assert.equal(data.metrics.height, resolution[1]);
  assert.equal(data.show.registered.length, n);
  assert.equal(data.show.failure, "");
  const row = {
    label,
    participants: n,
    resolution,
    rendered: data.show.actors.filter((a) => a.visible).length,
    ...data,
  };
  rows.push(row);
  await fs.writeFile(
    "docs/v06/benchmark.json",
    JSON.stringify(
      {
        rows,
        cycles,
        errors: h.errors,
        elapsedSeconds: (Date.now() - start) / 1000,
      },
      null,
      2,
    ),
  );
  console.log(
    label,
    n,
    resolution.join("x"),
    data.fps.toFixed(1),
    data.p95RAF.toFixed(2),
    "CPU",
    data.cpuMean.toFixed(2),
  );
}
try {
  for (const resolution of [
    [365, 648],
    [720, 1280],
  ]) {
    await page.setViewportSize({ width: resolution[0], height: resolution[1] });
    for (const n of [1, 10, 30]) {
      await h.fill(n);
      await measure("WIDE", n, resolution);
    }
    await h.send("GIFT", "viewer-29", {
      giftId: "galaxy",
      giftName: "Galaxia",
      metadata: { tier: "HIGH" },
    });
    await page.waitForFunction(
      () => window.__V05.inspect().event?.kind === "vip",
    );
    await measure("VIP", 30, resolution, 8);
    await page.waitForTimeout(2500);
    await h.send("SIMULATED", "viewer-0", { giftId: "fever-demo" });
    await page.waitForFunction(
      () => window.__V05.inspect().event?.kind === "fever",
    );
    await measure("Fever", 30, resolution, 12);
    await page.waitForTimeout(3000);
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    await h.fill(30);
    await h.send("GIFT", "viewer-29", {
      giftId: "galaxy",
      giftName: "Galaxia",
      metadata: { tier: "HIGH" },
    });
    await page.waitForTimeout(1500);
    await page.keyboard.press("F8");
    assert.equal(
      (await page.evaluate(() => window.__V05.inspect())).registered.length,
      30,
    );
    await page.getByRole("button", { name: "Reanudar", exact: true }).click();
    const populated = await resources();
    await page.evaluate(() => window.__V05.reset());
    await page.waitForTimeout(2000);
    const empty = await resources();
    assert.equal(empty.show.actors.length, 0);
    assert.equal(empty.show.pending, 0);
    assert.equal(empty.show.queued, 0);
    cycles.push({ cycle, populated, empty });
    console.log(
      "resource cycle",
      cycle,
      populated.heap,
      empty.heap,
      empty.metrics.textures,
    );
  }
  const emptyGeometries = cycles.map((c) => c.empty.metrics.geometries),
    emptyTextures = cycles.map((c) => c.empty.metrics.textures);
  assert.equal(new Set(emptyGeometries).size, 1);
  assert.equal(new Set(emptyTextures).size, 1);
  assert.deepEqual(h.errors, []);
  await fs.writeFile(
    "docs/v06/benchmark.json",
    JSON.stringify(
      {
        rows,
        cycles,
        errors: h.errors,
        elapsedSeconds: (Date.now() - start) / 1000,
        notes: [
          "CPU includes JS update and render submission, not GPU execution.",
          "JS heap is not VRAM/process RAM.",
          "No recording or exact vertex diagnostics during timed samples.",
          "MEDIUM, deviceScaleFactor=1, hardware backend identified in metrics.gpu.",
          "30 registered, at most10 featured, camera culls only background whole bodies.",
          "Short repeated-cycle test, not an hours-long soak.",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await h.close();
}

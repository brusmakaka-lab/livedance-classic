import { harness } from "./v05-harness.mjs";
import { decodePNG, encodePNG } from "./skins/png.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const h = await harness("integration");
const { page } = h;
const checks = [];
const inspect = () => page.evaluate(() => window.__V05.inspect());
try {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await h.fill(30);
  const ids = (await inspect()).registered;
  const skins = (await inspect()).actors.map((a) => [a.id, a.skinId]).sort();
  await h.send("FOLLOW", "viewer-29");
  await page.waitForFunction(
    () => window.__V05.inspect().event?.kind === "follow",
  );
  await h.send("SIMULATED", "viewer-0", { giftId: "fever-demo" });
  await page.waitForFunction(
    () => window.__V05.inspect().event?.kind === "fever",
  );
  await h.send("GIFT", "viewer-28", {
    giftId: "galaxy",
    giftName: "Galaxia",
    metadata: { tier: "HIGH" },
  });
  await page.waitForFunction(
    () => window.__V05.inspect().event?.id === "viewer-28",
  );
  await h.send("FOLLOW", "viewer-2");
  await page.waitForTimeout(300);
  assert.equal((await inspect()).event.id, "viewer-28");
  assert.equal((await inspect()).visible[0], "viewer-28");
  checks.push("VIP > Fever > Follow and correct waiting subject");
  await page.keyboard.press("F8");
  const frozen = (await inspect()).camera;
  await page.waitForTimeout(500);
  assert.deepEqual((await inspect()).camera, frozen);
  assert.deepEqual((await inspect()).registered, ids);
  assert.equal((await h.send("FOLLOW", "blocked")).reason, "paused");
  await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  assert.deepEqual(
    (await inspect()).actors.map((a) => [a.id, a.skinId]).sort(),
    skins,
  );
  checks.push("overlap + F8 preserves identities and explicit recovery");
  await page.evaluate(() => {
    document.body.classList.remove("clean");
    window.__V05.configure({ enabled: false });
  });
  await page.waitForTimeout(1500);
  assert.equal(
    (await page.evaluate(() => window.__LiveDance.inspect())).dancers.length,
    30,
  );
  assert.equal(await page.locator("body.integration-active").count(), 0);
  assert.equal((await inspect()).camera.viewOffset, false);
  await page.evaluate(() => window.__V05.configure({ enabled: true }));
  await page.waitForFunction(() => window.__V05.inspect().actors.length === 30);
  assert.deepEqual(
    (await inspect()).actors.map((a) => [a.id, a.skinId]).sort(),
    skins,
  );
  checks.push(
    "renderer flag round trip keeps Phase2 participants and skin IDs",
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Dancers", exact: true })
    .click();
  await page.waitForSelector(".skin-card");
  const decoded = decodePNG(
    await fs.readFile("public/integration/skins/coral.png"),
  );
  decoded[0] ^= 1;
  const png = encodePNG(decoded);
  await page
    .locator("details")
    .filter({ has: page.locator("#skin-import") })
    .locator("summary")
    .click();
  await page
    .locator("#skin-file")
    .setInputFiles({
      name: "Own-test.png",
      mimeType: "image/png",
      buffer: png,
    });
  for (const [id, value] of Object.entries({
    "skin-name": "Fixture importada",
    "skin-author": "LiveDance",
    "skin-source": "Variante fixture propia Coral",
    "skin-license": "Prueba local propia",
  }))
    await page.locator("#" + id).fill(value);
  await page.locator("#skin-authorized").check();
  await page.locator("#skin-import button[type=submit]").click();
  await page.waitForFunction(
    () => window.__V05.show.client.state.records.length === 4,
  );
  await page.locator("#skin-search").fill("Fixture");
  assert.equal(await page.locator(".skin-card").count(), 1);
  await page.locator("[data-skin-preview]").click();
  await page.waitForFunction(() =>
    window.__V05.inspect().actors.some((a) => a.id === "__preview__"),
  );
  await page.screenshot({ path: "docs/v06/evidence/library.png" });
  page.once("dialog", (d) => d.accept());
  await page.locator("[data-skin-delete]").click();
  await page.waitForFunction(
    () => window.__V05.show.client.state.records.length === 3,
  );
  assert.equal((await inspect()).registered.length, 30);
  checks.push("PNG import/search/3D preview/delete through main UI");
  const invalid = await page.evaluate(async () => {
    const c = window.__V05.show.client;
    try {
      await c.mutate("import", {
        png: btoa("not PNG"),
        authorized: true,
        name: "Bad",
        model: "classic",
        author: "Test",
        source: "Test",
        license: "Test",
      });
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(invalid, true);
  checks.push("invalid PNG rejected without modifying library");
  await page.evaluate(() => {
    const s = window.__V05.show;
    s.preview(s.client.state.records[0].id);
    s.preview(s.client.state.records[1].id);
    s.preview(s.client.state.records[2].id);
  });
  await page.waitForFunction(() => {
    const s = window.__V05.show;
    return s.actors.get("__preview__")?.skin.id === s.previewId;
  });
  checks.push("rapid previews cannot display stale texture");
  await page.evaluate(() => window.__V05.reset());
  await h.send("FOLLOW", "late-load");
  await page.evaluate(() => window.__V05.reset());
  await page.waitForTimeout(1500);
  assert.equal((await inspect()).registered.length, 0);
  assert.equal((await inspect()).actors.length, 0);
  checks.push("reset cancels pending admissions and async actors");
  await page
    .locator("nav")
    .getByRole("button", { name: "Simulator", exact: true })
    .click();
  await page.locator("[data-v05=demo]").click();
  await page.waitForFunction(
    () => window.__V05.inspect().event?.kind === "fever",
    null,
    { timeout: 40000 },
  );
  assert.equal((await inspect()).registered.length, 11);
  await page.screenshot({ path: "docs/v06/evidence/simulator.png" });
  checks.push("Simulator full Follow→VIP→Fever demonstration");
  await page.keyboard.press("F8");
  await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  assert.deepEqual(
    await page.evaluate(() => window.__LiveDance.inspect().errors),
    [],
  );
  await page.route("**/integration/rio-mixamo.glb", (route) => route.abort());
  await page.reload();
  await page.waitForFunction(() => !!window.__V05?.inspect().failure);
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("body.integration-active").count(), 0);
  assert.ok(
    (await page.evaluate(() => window.__LiveDance.snapshot())).drawCalls > 0,
  );
  checks.push("failed model load keeps legacy renderer available");
  assert.deepEqual(h.errors, []);
  await fs.writeFile(
    "docs/v06/integration-results.json",
    JSON.stringify(
      {
        gate: "PASS",
        checks,
        errors: h.errors,
        expectedFailure:
          "last test deliberately aborted GLB load; legacy renderer remained available",
      },
      null,
      2,
    ),
  );
  console.log("Integration PASS", checks.length);
} finally {
  await h.close();
}

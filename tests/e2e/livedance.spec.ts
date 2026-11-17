import { test, expect, type Page } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
const read = (page: Page) =>
  page.evaluate(() => ({
    snapshot: (window as any).__LiveDance.snapshot(),
    ...(window as any).__LiveDance.inspect(),
  }));
test("paneles Scene/Audio/Events y borrador del Simulator", async ({
  page,
}) => {
  await boot(page);
  await page.getByLabel("Identificador del espectador", { exact: true }).fill("persistent-draft");
  await nav(page, "Camera");
  await nav(page, "Simulator");
  await expect(page.getByLabel("Identificador del espectador", { exact: true })).toHaveValue(
    "persistent-draft",
  );
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await nav(page, "Scene");
  await page.getByLabel("Ver áreas seguras", { exact: true }).check();
  await expect(page.locator("#safe-area")).toBeVisible();
  await nav(page, "Audio");
  await page
    .getByRole("button", { name: "Activar audio", exact: true })
    .click();
  await expect(
    page.getByLabel("Silenciar audio", { exact: true }),
  ).not.toBeChecked();
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page
    .locator("#music-file")
    .setInputFiles({
      name: "test-original.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await expect(page.locator("#audio-status")).toContainText(
    "Música local: test-original.wav",
  );
  await page
    .getByRole("button", { name: "Detener música", exact: true })
    .click();
  await nav(page, "Events");
  await expect(page.locator("#events-list")).toContainText("VIEWER_JOIN");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Exportar diagnóstico", exact: true })
      .click(),
  ]);
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.errors).toEqual([]);
  expect(data.metrics.events).toBeGreaterThan(0);
});
async function boot(page: Page) {
  await page.goto("/?empty=1");
  await expect(
    page.getByRole("heading", { name: "Tu pista. Su momento." }),
  ).toBeVisible();
  await page.waitForFunction(() => Boolean((window as any).__LiveDance));
}
async function nav(page: Page, name: string) {
  await page.locator('nav [data-nav="'+name+'"]').click();
}
test("arranque, recursos locales y escena 3D sin errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  await expect(page.locator("canvas")).toBeVisible();
  await expect
    .poll(async () => (await read(page)).snapshot.drawCalls)
    .toBeGreaterThan(0);
  await page.screenshot({
    path: "docs/v04/legacy-v031/screenshots/startup.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect((await read(page)).errors).toEqual([]);
});
test("Simulator: entra caminando, ocupa slot, baila, nombre sanitizado y follow", async ({
  page,
}) => {
  await boot(page);
  await page.getByLabel("Nombre del espectador", { exact: true }).fill("<mila>");
  await page.getByLabel("Identificador del espectador", { exact: true }).fill("walk-test");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).dancers[0]?.state)
    .toBe("ENTERING");
  expect((await read(page)).dancers[0].animationState).toBe("Walk");
  await expect
    .poll(async () => (await read(page)).dancers[0]?.state)
    .toBe("DANCING");
  let data = await read(page);
  expect(data.dancers[0].username).toBe("mila");
  expect(
    Math.hypot(
      data.dancers[0].position.x - data.dancers[0].slot.position.x,
      data.dancers[0].position.z - data.dancers[0].slot.position.z,
    ),
  ).toBeLessThan(0.1);
  await page.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect
    .poll(async () =>
      (await read(page)).effects.some((e: any) => e.kind === "particles"),
    )
    .toBe(true);
  await page.screenshot({
    path: "docs/v04/legacy-v031/screenshots/follow.png",
    fullPage: true,
  });
});
test("30 viewers: capacidad, separación, cuatro bailes y métricas", async ({
  page,
}) => {
  test.setTimeout(100000);
  await boot(page);
  await nav(page, "Settings");
  await page.getByLabel("Calidad adaptativa", { exact: true }).uncheck();
  await page
    .getByLabel("Inactividad antes de salida (segundos)", { exact: true })
    .fill("300");
  await page
    .getByLabel("Inactividad antes de salida (segundos)", { exact: true })
    .blur();
  await nav(page, "Simulator");
  await page.getByRole("button", { name: "+ 30 espectadores", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).snapshot.dancers, { timeout: 35000 })
    .toBe(30);
  await expect
    .poll(
      async () =>
        (await read(page)).dancers.filter((d: any) => d.state === "DANCING")
          .length,
      { timeout: 45000 },
    )
    .toBe(30);
  const data = await read(page);
  expect(data.snapshot.queue).toBe(0);
  expect(new Set(data.dancers.map((d: any) => d.animationState)).size).toBe(4);
  for (const a of data.dancers)
    for (const b of data.dancers)
      if (a !== b)
        expect(
          Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z),
        ).toBeGreaterThan(1.4);
  await nav(page, "Performance");
  await page.waitForTimeout(6000);
  const measured = await read(page);
  await mkdir("docs/v04/legacy-v031/screenshots", { recursive: true });
  await writeFile(
    "docs/v04/legacy-v031/metrics-30-software.json",
    JSON.stringify(
      {
        context:
          "Playwright Chromium headless, explicit SwiftShader, 1440×1080 viewport. Not a physical GPU benchmark.",
        ...measured,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: "docs/v04/legacy-v031/screenshots/30-dancers.png",
    fullPage: true,
  });
  expect(measured.errors).toEqual([]);
});
test("gifts xN, VIP, top, prioridad, retorno de cámara y cleanup", async ({
  page,
}) => {
  await boot(page);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).dancers[0]?.state)
    .toBe("DANCING");
  await page.getByRole("button", { name: "Aura · Bajo" }).click();
  await expect
    .poll(async () =>
      (await read(page)).effects.some((e: any) => e.kind === "aura"),
    )
    .toBe(true);
  await page.getByLabel("Cantidad ×N", { exact: true }).fill("5");
  await page.getByRole("button", { name: "VIP · Alto" }).click();
  await expect.poll(async () => (await read(page)).snapshot.camera).toBe("VIP");
  expect((await read(page)).dancers[0].slot.vip).toBe(true);
  await page.getByRole("button", { name: "Solo · Normal" }).click();
  expect((await read(page)).snapshot.camera).toBe("VIP");
  await page
    .getByRole("button", { name: "Máximo apoyo", exact: false })
    .click();
  await expect.poll(async () => (await read(page)).effects.some((e: any) => e.kind === "crown")).toBe(true);
  await expect.poll(async () => (await read(page)).events.some(
    (e: any) => e.eventType === "GIFT" && e.giftCount === 5,
  )).toBe(true);
  await page.screenshot({ path: "docs/v04/legacy-v031/screenshots/vip.png", fullPage: true });
  await expect
    .poll(async () => (await read(page)).snapshot.camera, { timeout: 15000 })
    .toBe("WIDE");
  await expect
    .poll(async () => (await read(page)).snapshot.effects, { timeout: 25000 })
    .toBe(0);
  expect((await read(page)).dancers[0].slot.vip).toBe(false);
});
test("AFK demo genera actividad ficticia y se puede detener", async ({
  page,
}) => {
  await boot(page);
  await page
    .getByRole("button", { name: "Iniciar demo AFK", exact: false })
    .click();
  await expect
    .poll(async () => (await read(page)).snapshot.events, { timeout: 12000 })
    .toBeGreaterThan(2);
  await page
    .getByRole("button", { name: "Detener demo AFK", exact: false })
    .click();
  const count = (await read(page)).snapshot.events;
  await page.waitForTimeout(3000);
  expect((await read(page)).snapshot.events).toBe(count);
  expect(
    (await read(page)).events.every((e: any) => e.source === "simulator"),
  ).toBe(true);
});
test("ajustes persisten tras reinicio y vista limpia vuelve con Escape", async ({
  page,
}) => {
  await boot(page);
  await nav(page, "Settings");
  await page.getByLabel("Máximo de dancers (1–30 · fase 2)", { exact: true }).fill("22");
  await page.getByLabel("Máximo de dancers (1–30 · fase 2)", { exact: true }).blur();
  await page.getByLabel("Preset máximo", { exact: true }).selectOption("LOW");
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).__LiveDance));
  expect((await read(page)).config.maxDancers).toBe(22);
  expect((await read(page)).config.quality).toBe("LOW");
  await page
    .getByRole("button", { name: "Vista limpia", exact: false })
    .click();
  await expect(page.locator("body")).toHaveClass(/\bclean\b/);
  await expect(page.locator("nav")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("nav")).toBeVisible();
  expect((await read(page)).errors).toEqual([]);
});
test("salida por inactividad libera dancer, slots y efectos", async ({
  page,
}) => {
  await boot(page);
  await nav(page, "Settings");
  await page
    .getByLabel("Inactividad antes de salida (segundos)", { exact: true })
    .fill("10");
  await page
    .getByLabel("Inactividad antes de salida (segundos)", { exact: true })
    .blur();
  await nav(page, "Simulator");
  await page.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect.poll(async () => (await read(page)).snapshot.dancers).toBe(1);
  await expect
    .poll(async () => (await read(page)).dancers[0]?.state, { timeout: 18000 })
    .toBe("EXITING");
  await expect
    .poll(async () => (await read(page)).snapshot.dancers, { timeout: 20000 })
    .toBe(0);
  expect((await read(page)).snapshot.effects).toBe(0);
});
test("capacidad y cola durante reemplazo; spam controlado", async ({
  page,
}) => {
  await boot(page);
  await nav(page, "Settings");
  await page.getByLabel("Máximo de dancers (1–30 · fase 2)", { exact: true }).fill("2");
  await page.getByLabel("Máximo de dancers (1–30 · fase 2)", { exact: true }).blur();
  await nav(page, "Simulator");
  await page.getByRole("button", { name: "+ 10 espectadores", exact: true }).click();
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(400);
    expect((await read(page)).snapshot.dancers).toBeLessThanOrEqual(2);
  }
  await page
    .getByRole("button", { name: "Spam controlado", exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Detener spam", exact: true }).click();
  expect((await read(page)).snapshot.events).toBeGreaterThan(10);
  expect((await read(page)).snapshot.queue).toBeLessThanOrEqual(240);
});

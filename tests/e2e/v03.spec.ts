import { test, expect, type Page } from "@playwright/test";
const inspect = (p: Page) =>
  p.evaluate(() => (window as any).__LiveDance.inspect());
const nav = (p: Page, n: string) =>
  p.locator('nav [data-nav="'+n+'"]').click();
test("v03 Hype, Fever, goals, slides, ranking and reset cleanup", async ({
  page,
}) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?empty=1");
  await page.waitForFunction(() => (window as any).__LiveDance);
  await nav(page, "Simulator");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page)).dancers[0]?.state)
    .toBe("DANCING");
  await page.getByRole("button", { name: "Hype +50", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page)).entertainment.hype)
    .toBeGreaterThan(40);
  await page.getByText("Interacciones y progresión", { exact: true }).click();
  for (const n of [1, 5, 10]) {
    await page.getByRole("button", { name: `Gift x${n}`, exact: true }).click();
    await expect
      .poll(async () => (await inspect(page)).events[0].giftCount)
      .toBe(n);
  }
  await page.getByRole("button", { name: "VIP · Alto" }).click();
  await expect
    .poll(
      async () => (await inspect(page)).events[0]?.metadata.tier,
    )
    .toBe("HIGH");
  await page.getByRole("button", { name: "Gift x1", exact: true }).click();
  await expect(page.locator("#event-slide")).toBeVisible();
  await page
    .getByRole("button", { name: "Promote Top 1", exact: true })
    .click();
  expect((await inspect(page)).entertainment.top[0].score).toBeGreaterThan(50);
  await page.getByRole("button", { name: "Like Goal", exact: true }).click();
  await page.getByRole("button", { name: "Follow Goal", exact: true }).click();
  await page
    .getByRole("button", { name: "Trigger Fever", exact: true })
    .click();
  await expect
    .poll(async () => (await inspect(page)).entertainment.state)
    .toBe("FEVER");
  await expect
    .poll(async () => (await inspect(page)).entertainment.state, {
      timeout: 35000,
    })
    .not.toBe("FEVER");
  await page
    .getByRole("button", { name: "Trigger Fever", exact: true })
    .click();
  expect((await inspect(page)).entertainment.state).not.toBe("FEVER");
  await nav(page, "Settings");
  await page
    .getByRole("button", { name: "Reiniciar escena de prueba", exact: true })
    .click();
  await expect
    .poll(async () => (await inspect(page)).entertainment.slides.active)
    .toBeNull();
  const final = await inspect(page);
  expect(final.dancers).toHaveLength(0);
  expect(final.entertainment.gifts).toBe(0);
  expect(final.entertainment.top).toEqual([]);
  expect(errors).toEqual([]);
});
test("v03 collections favorites queue tags and persisted settings", async ({
  page,
}) => {
  await page.goto("/?empty=1");
  await page.waitForFunction(() => (window as any).__LiveDance);
  await nav(page, "Audio");
  await page.locator(".audio-library > summary").click();
  await page
    .getByRole("button", { name: "Eliminar todas", exact: true })
    .click();
  await expect
    .poll(async () => (await inspect(page)).audio.state.tracks.length)
    .toBe(0);
  await expect.poll(async () => (await inspect(page)).audio.busy).toBe(false);
  const b = Buffer.alloc(44 + 16000 * 8);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  await page
    .locator("#music-file")
    .setInputFiles(
      ["A", "B"].map((n) => ({
        name: `v3-${n}.wav`,
        mimeType: "audio/wav",
        buffer: b,
      })),
    );
  await expect.poll(async () => (await inspect(page)).audio.busy).toBe(false);
  await expect
    .poll(async () => (await inspect(page)).audio.state.tracks.length)
    .toBe(2);
  await page
    .getByLabel("Nombre de la lista", { exact: true })
    .fill("Party test");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.locator("#saved-playlist")).not.toHaveValue("");
  const createdPlaylistId = await page.locator("#saved-playlist").inputValue();
  await page.locator("[data-membership]").first().click();
  await page.locator("[data-favorite]").first().click();
  await page.locator("[data-track-tag]").first().selectOption("HYPE");
  await page.locator("[data-enqueue]").nth(0).click();
  await page.locator("[data-enqueue]").nth(1).click();
  await page.getByLabel("Subir en cola 2", { exact: true }).click();
  await expect
    .poll(async () => (await inspect(page)).audio.state.queue.length)
    .toBe(2);
  const before = (await inspect(page)).audio.state;
  expect(before.queue[0]).toBe(before.tracks[1].id);
  expect(
    before.playlists.find((p: any) => p.id === createdPlaylistId).trackIds,
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Quitar de playlist", exact: true })
    .click();
  expect((await inspect(page)).audio.state.tracks).toHaveLength(2);
  await page.reload();
  await page.waitForFunction(
    () =>
      (window as any).__LiveDance?.inspect().audio.state.tracks.length === 2,
  );
  const after = (await inspect(page)).audio.state;
  expect(after.queue).toEqual(before.queue);
  expect(after.tracks[0].favorite).toBe(true);
  expect(after.tracks[0].tag).toBe("HYPE");
  await nav(page, "Scene");
  await page
    .getByText("Ajustes de fiesta y Clean View", { exact: true })
    .click();
  await page.getByLabel("Reduce motion", { exact: true }).check();
  await page.reload();
  await page.waitForFunction(() => (window as any).__LiveDance);
  expect((await inspect(page)).entertainment.config.reduceMotion).toBe(true);
  await page
    .getByRole("button", { name: "Vista limpia", exact: false })
    .click();
  await expect(page.locator(".sim-badge")).toBeVisible();
  await expect(page.locator(".sidebar")).not.toBeVisible();
});

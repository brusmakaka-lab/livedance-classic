import { test, expect, type Page } from "@playwright/test";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
const read = (p: Page) =>
  p.evaluate(() => (window as any).__LiveDance.inspect());
const nav = (p: Page, name: string) =>
  p.locator('nav [data-nav="'+name+'"]').click();
async function openOptions(p: Page) {
  if (!await p.locator(".audio-options").evaluate(e => (e as HTMLDetailsElement).open))
    await p.locator(".audio-options summary").click();
}
function tone(name: string, seconds = 12) {
  const rate = 8000,
    samples = rate * seconds,
    b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i / rate) * 440 * Math.PI * 2) * 1500),
      44 + i * 2,
    );
  return { name, mimeType: "audio/wav", buffer: b };
}
async function audioBoot(p: Page) {
  await p.goto("/?empty=1");
  await p.waitForFunction(() => (window as any).__LiveDance);
  await nav(p, "Audio");
  await p.locator(".audio-options summary").click();
  await p.waitForFunction(
    () =>
      !(window as any).__LiveDance
        .inspect()
        .audio.status.includes("Silenciado"),
  );
  await p.getByRole("button", { name: "Eliminar todas", exact: true }).click();
  await expect
    .poll(async () => (await read(p)).audio.state.tracks.length)
    .toBe(0);
  await openOptions(p);
  await p.getByLabel("Modo", { exact: true }).selectOption("SEQUENTIAL");
  await openOptions(p);
  await p.getByLabel("Repetir", { exact: true }).selectOption("OFF");
  await openOptions(p);
  await p.getByLabel("Transición entre canciones", { exact: true }).selectOption("0");
  await openOptions(p);
  await p.getByLabel("Bajar música durante VIP", { exact: true }).check();
  await p.locator("#duck-amount").fill("0.55");
  await p.locator("#duck-amount").dispatchEvent("change");
  await p.getByRole("button", { name: "Activar audio", exact: true }).click();
}
async function upload(p: Page, seconds = 12) {
  await p
    .locator("#music-file")
    .setInputFiles([
      tone("Original A.wav", seconds),
      tone("Original B.wav", seconds),
      tone("Original C.wav", seconds),
    ]);
  await expect
    .poll(async () => (await read(p)).audio.state.tracks.length)
    .toBe(3);
  await expect.poll(async () => (await read(p)).audio.busy).toBe(false);
}
async function seek(p: Page, value: number) {
  await p.locator("#music-seek").fill(String(value));
  await p.locator("#music-seek").dispatchEvent("change");
}
test("v02 missing copy and corrupt decoder are skipped without an endless loop", async ({
  page,
}) => {
  await audioBoot(page);
  await upload(page);
  const root = path.resolve("temp/e2e-music"),
    index = JSON.parse(
      await readFile(path.join(root, "playlist.json"), "utf8"),
    );
  const copy = path.resolve(root, "music", index.tracks[0].file);
  expect(copy.startsWith(path.join(root, "music") + path.sep)).toBe(true);
  await unlink(copy);
  await page.reload();
  await page.waitForFunction(
    () =>
      (window as any).__LiveDance?.inspect().audio.state.tracks.length === 3,
  );
  expect((await read(page)).audio.state.tracks[0].missing).toBe(true);
  await nav(page, "Audio");
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).audio.state.currentId)
    .toBe(index.tracks[1].id);
  await expect.poll(async () => (await read(page)).audio.playing).toBe(true);
  await page
    .getByRole("button", { name: "Eliminar todas", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).audio.state.tracks.length)
    .toBe(0);
  const corrupt = Buffer.alloc(60);
  corrupt.write("RIFF");
  corrupt.write("WAVE", 8);
  await page
    .locator("#music-file")
    .setInputFiles([
      { name: "decode-fails.wav", mimeType: "audio/wav", buffer: corrupt },
      tone("Valid original.wav"),
    ]);
  await expect
    .poll(async () => (await read(page)).audio.state.tracks.length)
    .toBe(2);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).audio.state.tracks[0].error)
    .toBeTruthy();
  await expect.poll(async () => (await read(page)).audio.playing).toBe(true);
  expect((await read(page)).audio.state.currentId).toBe(
    (await read(page)).audio.state.tracks[1].id,
  );
});
test("v02 playlist multiple import, play/pause, next/previous, seek, reorder, restart and remove", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await audioBoot(page);
  await upload(page);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect.poll(async () => (await read(page)).audio.playing).toBe(true);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).audio.state.currentId)
    .toBe((await read(page)).audio.state.tracks[1].id);
  await page.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).audio.state.currentId)
    .toBe((await read(page)).audio.state.tracks[0].id);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await seek(page, 4);
  expect((await read(page)).audio.position).toBeCloseTo(4, 0);
  await page
    .getByRole("button", { name: "Bajar Original A.wav", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).audio.state.tracks[1].name)
    .toBe("Original A.wav");
  await openOptions(page);
  await page.getByLabel("Modo", { exact: true }).selectOption("SHUFFLE");
  await openOptions(page);
  await page.getByLabel("Repetir", { exact: true }).selectOption("PLAYLIST");
  await page.getByLabel("BPM Original A.wav", { exact: true }).fill("120");
  await page.getByLabel("BPM Original A.wav", { exact: true }).blur();
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(
    () =>
      (window as any).__LiveDance?.inspect().audio.state.tracks.length === 3,
  );
  let a = (await read(page)).audio;
  expect(a.state.tracks[1].name).toBe("Original A.wav");
  expect(a.state.tracks[1].bpm).toBe(120);
  expect(a.state.mode).toBe("SHUFFLE");
  expect(a.state.repeat).toBe("PLAYLIST");
  expect(a.playing).toBe(false);
  await nav(page, "Audio");
  await page
    .getByRole("button", { name: "Eliminar Original B.wav", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).audio.state.tracks.length)
    .toBe(2);
  await page
    .getByRole("button", { name: "Eliminar todas", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).audio.state.tracks.length)
    .toBe(0);
  expect(errors).toEqual([]);
  expect((await read(page)).errors).toEqual([]);
});
test("v02 automatic sequential repeat TRACK PLAYLIST OFF and crossfade cancellation", async ({
  page,
}) => {
  await audioBoot(page);
  await upload(page, 8);
  await openOptions(page);
  await page.getByLabel("Repetir", { exact: true }).selectOption("TRACK");
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect.poll(async () => (await read(page)).audio.playing).toBe(true);
  const first = (await read(page)).audio.state.currentId;
  await seek(page, 7.7);
  await expect
    .poll(async () => (await read(page)).audio.position)
    .toBeLessThan(2);
  expect((await read(page)).audio.state.currentId).toBe(first);
  await openOptions(page);
  await page.getByLabel("Repetir", { exact: true }).selectOption("PLAYLIST");
  await openOptions(page);
  await page.getByLabel("Transición entre canciones", { exact: true }).selectOption("3");
  await seek(page, 5.1);
  await expect.poll(async () => (await read(page)).audio.fading).toBe(true);
  let a = (await read(page)).audio;
  expect(a.decks.filter((d: any) => !d.paused)).toHaveLength(2);
  expect(a.state.currentId).not.toBe(first);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  a = (await read(page)).audio;
  expect(a.fading).toBe(false);
  expect(a.decks.every((d: any) => d.paused)).toBe(true);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect.poll(async () => (await read(page)).audio.loading).toBe(false);
  await openOptions(page);
  await page.getByLabel("Transición entre canciones", { exact: true }).selectOption("0");
  await openOptions(page);
  await page.getByLabel("Repetir", { exact: true }).selectOption("OFF");
  await seek(page, 7.6);
  await expect.poll(async () => (await read(page)).audio.playing).toBe(false);
  expect((await read(page)).audio.status).toBe("Fin de playlist");
});
test("v02 ducking VIP restores, mute and Stop leave no decks playing", async ({
  page,
}) => {
  await audioBoot(page);
  await upload(page, 20);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect.poll(async () => (await read(page)).audio.playing).toBe(true);
  await nav(page, "Simulator");
  await page.getByRole("button", { name: "VIP · Alto", exact: false }).click();
  await expect
    .poll(async () => (await read(page)).audio.duck)
    .toBeLessThan(0.7);
  await expect
    .poll(async () => (await read(page)).audio.duck, { timeout: 7000 })
    .toBeGreaterThan(0.99);
  await nav(page, "Audio");
  await page.locator(".audio-options summary").click();
  await openOptions(page);
  await page.getByLabel("Bajar música durante VIP", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Probar sonido", exact: true })
    .click();
  await page.waitForTimeout(400);
  expect((await read(page)).audio.duck).toBeGreaterThan(0.99);
  await page.getByLabel("Silenciar audio", { exact: true }).check();
  expect((await read(page)).config.mute).toBe(true);
  await page.getByRole("button", { name: "Detener", exact: true }).click();
  const a = (await read(page)).audio;
  expect(a.playing).toBe(false);
  expect(a.position).toBe(0);
  expect(a.decks.every((d: any) => d.paused)).toBe(true);
});
test("v02 invalid audio reports failure; API rejects external origin and missing token", async ({
  page,
  request,
}) => {
  await audioBoot(page);
  await page.locator("#music-file").setInputFiles({
    name: "broken.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not a wave"),
  });
  await expect(page.locator("#toast")).toContainText("dañado");
  expect((await read(page)).audio.state.tracks).toHaveLength(0);
  const rejected = await request.delete("/api/music", {
    headers: { Origin: "http://evil.example" },
  });
  expect(rejected.status()).toBe(403);
  const noToken = await request.delete("/api/music", {
    headers: { Origin: "http://127.0.0.1:5410" },
  });
  expect(noToken.status()).toBe(403);
});
test("v02 branding persistence, VIP priority, reaction cleanup and visible simulation in clean view", async ({
  page,
}) => {
  await page.goto("/?empty=1");
  await page.waitForFunction(() => (window as any).__LiveDance);
  await nav(page, "Scene");
  await page
    .getByLabel("Nombre del escenario", { exact: true })
    .fill("MI AFTERGLOW");
  await page.getByLabel("Nombre del escenario", { exact: true }).blur();
  await page.getByLabel("Mostrar branding", { exact: true }).uncheck();
  await page.reload();
  await page.waitForFunction(() => (window as any).__LiveDance);
  expect((await read(page)).presentation.config.sceneName).toBe("MI AFTERGLOW");
  expect((await read(page)).presentation.config.branding).toBe(false);
  await page.getByRole("button", { name: "VIP · Alto", exact: false }).click();
  await expect
    .poll(async () => (await read(page)).presentation.lighting)
    .toBe("VIP");
  await page
    .getByRole("button", { name: "Solo · Normal", exact: false })
    .click();
  expect((await read(page)).presentation.shot).toBe("VIP");
  await page
    .getByRole("button", { name: "Máximo apoyo", exact: false })
    .click();
  await expect
    .poll(async () => (await read(page)).presentation.lighting)
    .toBe("HYPE");
  await page
    .getByRole("button", { name: "Vista limpia", exact: false })
    .click();
  await expect(page.locator(".sim-badge")).toBeVisible();
  await expect(page.locator(".broadcast-brand")).toBeHidden();
  await expect(page.locator("nav")).toBeHidden();
  await page.keyboard.press("Escape");
  await nav(page, "Settings");
  await page
    .getByRole("button", { name: "Reiniciar escena de prueba", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).presentation.lighting)
    .toBe("AMBIENT");
  expect((await read(page)).presentation.reactions).toHaveLength(0);
  expect((await read(page)).presentation.vipId).toBeNull();
});


import { harness } from "./v05-harness.mjs";
import fs from "node:fs/promises";
const h = await harness("record");
const { page } = h;
const manifest = [];
const followOnly = process.argv.includes("--follow-only");
if (followOnly) manifest.push(...JSON.parse(await fs.readFile("docs/v06/videos/manifest.json", "utf8")).manifest.filter(x => !x.file.startsWith("follow-")));
await fs.mkdir("docs/v06/videos", { recursive: true });
async function record(name, seconds, action) {
  const recording = page.evaluate((s) => window.__V05.record(s), seconds);
  await page.waitForTimeout(500);
  if (action) await action();
  const bytes = Buffer.from(await recording, "base64");
  await fs.writeFile(`docs/v06/videos/${name}.webm`, bytes);
  manifest.push({
    file: name + ".webm",
    seconds,
    width: 720,
    height: 1280,
    bytes: bytes.length,
    audio: false,
  });
  console.log("recorded", name, bytes.length);
}
async function prepare(cinematic) {
  await page.evaluate((c) => {
    const s = window.__V05.show;
    s.events.clear();
    s.waiting = [];
    s.entertainment.hype.reset();
    s.lastFever = false;
    s.cast.focus();
    s.manual = "WIDE";
    s.configure({ enabled: true, cinematic: c, motion: "SUAVE", fixed: false });
    s.director.initialized = false;
  }, cinematic);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const s = window.__V05.show;
    s.time = 0;
    [...s.actors.values()].forEach((a, i) => { a.born = -1; a.player.seek((i % 5) * 0.27); });
  });
}
try {
  await page.setViewportSize({ width: 720, height: 1280 });
  for (const cinematic of [false, true]) {
    const suffix = cinematic ? "cinematic-v1" : "camera-3g";
    await h.fill(9);
    await prepare(cinematic);
    await record("follow-" + suffix, 6, () =>
      h.send("FOLLOW", "follow-guest", { username: "Luna Live" }),
    );
    if (followOnly) continue;
    await h.fill(30);
    await prepare(cinematic);
    await record("wide-" + suffix, 5);
    await prepare(cinematic);
    await record("vip-" + suffix, 11, () =>
      h.send("GIFT", "viewer-29", {
        username: "Nova VIP",
        giftId: "galaxy",
        giftName: "Galaxia",
        metadata: { tier: "HIGH" },
      }),
    );
    await prepare(cinematic);
    await record("fever-" + suffix, 15, () =>
      h.send("SIMULATED", "viewer-0", { giftId: "fever-demo" }),
    );
  }
  if (!followOnly) {
  await prepare(true);
  await record("f8-recovery", 9, async () => {
    await h.send("GIFT", "viewer-29", {
      username: "Nova VIP",
      giftId: "galaxy",
      giftName: "Galaxia",
      metadata: { tier: "HIGH" },
    });
    await page.waitForTimeout(2000);
    await page.keyboard.press("F8");
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Reanudar", exact: true }).click();
  });
  await page.evaluate(() => window.__V05.configure({ enabled: false }));
  await page.waitForTimeout(4000);
  await record("phase2-renderer-wide", 5);
  }
  await fs.writeFile(
    "docs/v06/videos/manifest.json",
    JSON.stringify(
      {
        manifest,
        notes: [
          "Recorded with browser canvas MediaRecorder, silent, 30fps requested.",
          "Same rig, skins, clips, lighting and 30 registered for WIDE/VIP/Fever camera comparisons. Follow starts with9 and creates a tenth.",
          "Caption redrawn for recording; DOM music/ranking controls are not composited.",
          "Camera-3G clips are the retained 3G director inside v0.5, not a recording of the untouched source app.",
          "Phase2 renderer clip is the preserved fallback inside v0.5.",
        ],
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    "docs/v06/videos/index.html",
    `<!doctype html><html lang="es"><meta charset="utf-8"><title>LiveDance v0.5 — Comparación</title><style>body{background:#0c1420;color:#dce9e3;font:16px system-ui;margin:30px}section{display:flex;gap:20px;flex-wrap:wrap;margin:20px 0 50px}video{width:min(42vw,330px);background:#000}h1,h2{font-weight:500}p{max-width:850px;color:#a5b9c0}figure{margin:0}figcaption{padding:10px 0}</style><h1>LiveDance v0.5 · evaluación visual</h1><p>Izquierda: cámara Phase3G conservada. Derecha: Cinematic v1. Mismo modelo, skins y clips Mixamo; reproducción silenciosa. Iniciar ambos videos para comparar. La captura recompone el cartel del evento, sin todos los módulos del HUD. Esta evidencia no implica aprobación artística.</p>${["wide", "follow", "vip", "fever"].map((k) => `<h2>${k.toUpperCase()}</h2><section>${["camera-3g", "cinematic-v1"].map((s) => `<figure><video controls muted loop preload="metadata" src="${k}-${s}.webm"></video><figcaption>${s}</figcaption></figure>`).join("")}</section>`).join("")}<h2>F8 y recuperación</h2><video controls muted src="f8-recovery.webm"></video><h2>Renderer Phase2 conservado</h2><video controls muted src="phase2-renderer-wide.webm"></video></html>`,
  );
} finally {
  await h.close();
}

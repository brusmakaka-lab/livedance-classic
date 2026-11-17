import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
process.env.TEMP = process.env.TMP = path.resolve("temp");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");
  const checks = [];
  for (const name of [
    "follow-camera-3g",
    "follow-cinematic-v1",
    "wide-camera-3g",
    "wide-cinematic-v1",
    "vip-camera-3g",
    "vip-cinematic-v1",
    "fever-camera-3g",
    "fever-cinematic-v1",
    "f8-recovery",
    "phase2-renderer-wide",
  ]) {
    const base64 = (
      await fs.readFile("docs/v06/videos/" + name + ".webm")
    ).toString("base64");
    const result = await page.evaluate(
      async ({ base64, name }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
          url = URL.createObjectURL(new Blob([bytes], { type: "video/webm" }));
        const v = document.createElement("video");
        v.muted = true;
        v.src = url;
        const wait = (event) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error("video " + event)),
              15000,
            );
            v.addEventListener(
              event,
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
        await wait("loadedmetadata");
        const c = document.createElement("canvas");
        c.width = 720;
        c.height = 704;
        const ctx = c.getContext("2d");
        const times = name.startsWith("fever")
          ? [1, 4, 8, 12]
          : name.startsWith("vip")
            ? [1, 3, 6, 9]
            : name === "f8-recovery"
              ? [1, 3, 5, 8]
              : [0.7, 1.8, 3, 4.5];
        for (let i = 0; i < 4; i++) {
          const seek = wait("seeked");
          v.currentTime = times[i];
          await seek;
          const x = (i % 2) * 360,
            y = Math.floor(i / 2) * 352;
          ctx.drawImage(v, x, y, 180, 320);
          ctx.fillStyle = "#0d1723";
          ctx.fillRect(x + 180, y, 180, 320);
          ctx.fillStyle = "#dae8df";
          ctx.font = "14px system-ui";
          ctx.fillText(times[i] + " s", x + 196, y + 30);
          ctx.fillText(
            name.includes("camera-3g") ? "Camera Phase3G" : "v0.5",
            x + 196,
            y + 56,
          );
          ctx.fillText(name.split("-")[0], x + 196, y + 80);
        }
        const single = document.createElement("canvas");
        single.width = v.videoWidth;
        single.height = v.videoHeight;
        const seek = wait("seeked");
        v.currentTime = name === "f8-recovery" ? 3.2 : name.startsWith("follow") ? 1.8 : 3.5;
        await seek;
        single.getContext("2d").drawImage(v, 0, 0);
        const output = {
          width: v.videoWidth,
          height: v.videoHeight,
          readyState: v.readyState,
          sheet: c.toDataURL("image/png").split(",")[1],
          single: single.toDataURL("image/png").split(",")[1],
        };
        v.removeAttribute("src");
        v.load();
        URL.revokeObjectURL(url);
        return output;
      },
      { base64, name },
    );
    await fs.writeFile(
      "docs/v06/evidence/" + name + "-sheet.png",
      Buffer.from(result.sheet, "base64"),
    );
    await fs.writeFile(
      "docs/v06/evidence/" + name + "-frame.png",
      Buffer.from(result.single, "base64"),
    );
    checks.push({
      file: name + ".webm",
      width: result.width,
      height: result.height,
      decodedFrames: 5,
    });
  }
  await fs.writeFile(
    "docs/v06/video-decode.json",
    JSON.stringify({ checks }, null, 2),
  );
  console.log("Decoded", checks.length, "videos");
} finally {
  await browser.close();
}

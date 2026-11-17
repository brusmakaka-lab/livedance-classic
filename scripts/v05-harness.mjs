import { Store } from "./skins/store.mjs";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
export async function harness(tag, port = 5527, fixture = false) {
  process.env.TEMP = process.env.TMP = path.resolve("temp");
  const root = path.resolve("temp/" + tag + "-" + Date.now());
  await fs.mkdir(root, { recursive: true });
  if(fixture){
    const store=new Store(path.join(root,"skins"),path.resolve("public/integration/skins"),()=>0);await store.init();
    for(let i=0;i<30;i++)await store.assign(createHash("sha256").update("phase2:viewer-"+i).digest("hex"),["Río","Luna","Sol","Nova","Álex"][i%5]+" "+i,store.state.records[i%store.state.records.length].id);
  }
  const server = spawn(process.execPath, ["scripts/server.mjs"], {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      LIVEDANCE_PORT: String(port),
      LIVEDANCE_DATA_DIR: path.join(root, "music"),
      LIVEDANCE_SKIN_DIR: path.join(root, "skins"),
    },
  });
  let stderr = "";
  server.stderr.on("data", (b) => (stderr += b));
  for (let i = 0; i < 100; i++) {
    try {
      const response=await fetch(`http://127.0.0.1:${port}/health`);
      if(response.ok){const info=await response.json();if(info.pid!==server.pid||info.root.toLowerCase()!==path.resolve("dist").toLowerCase())throw Error("Port is not owned by this harness");break;}
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw Error(stderr);
  }
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--enable-precise-memory-info",
      "--disable-background-timer-throttling",
    ],
  });
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 365, height: 648 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  if(fixture)await page.addInitScript(()=>{let seed=7381;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(`http://127.0.0.1:${port}/?empty=1&clean=1&diagnostics=1`);
  await page.waitForFunction(() => window.__V05?.inspect().ready);
  await page.evaluate(() => {
    const w = window.__V05.world;
    w.config.afk = false;
    w.config.adaptive = false;
    w.config.quality = "MEDIUM";
    w.config.replacement = "reject";
  });
  let seq = 0;
  const event = (type, id, extra = {}) => ({
    schemaVersion: 1,
    source: "simulator",
    eventId: tag + "-" + ++seq,
    viewerId: id,
    username: id,
    eventType: type,
    giftCount: 1,
    timestamp: Date.now(),
    metadata: {},
    ...extra,
  });
  const send = (type, id, extra) =>
    page.evaluate((e) => window.__V05.submit(e), event(type, id, extra));
  const fill = async (n) => {
    await page.evaluate(() => window.__V05.reset());
    for (let i = 0; i < n; i++)
      await send("VIEWER_JOIN", "viewer-" + i, {
        username: ["Río", "Luna", "Sol", "Nova", "Álex"][i % 5] + " " + i,
      });
    await page.waitForFunction(
      (n) => window.__V05.inspect().actors.length === n,
      n,
      { timeout: 40000 },
    );
    await page.waitForTimeout(4500);
  };
  return {
    page,
    browser,
    server,
    root,
    errors,
    send,
    event,
    fill,
    close: async () => {
      await browser.close();
      server.kill();
    },
  };
}

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { SkinFolder } from "./skins/folder.mjs";
import { Store as SkinStore } from "./skins/store.mjs";
import { MusicStore, body, limits } from "./music-library.mjs";
import { LiveAdapter } from "../connector/adapter.mjs";
import { DiagnosticLog } from "../connector/diagnostics.mjs";
const diagnostics = new DiagnosticLog(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../logs'));
const live = new LiveAdapter(undefined, { onLog: row => diagnostics.write(row) });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { void live.dispose().then(() => diagnostics.close()).finally(() => process.exit(0)); });
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
const logDir = path.resolve(root, "../logs");
await mkdir(logDir, { recursive: true });
const port = Number(process.env.LIVEDANCE_PORT || 5580);
const library = new MusicStore(
  process.env.LIVEDANCE_DATA_DIR || path.resolve(root, "../data-rowshow-polish"),
);
await library.init();
const project = path.resolve(root, ".."),
  skinDir = path.resolve(
    process.env.LIVEDANCE_SKIN_DIR || path.join(project, "data-rowshow-polish/skins"),
  );
if (!skinDir.startsWith(project + path.sep))
  throw Error("Skin data must stay inside IntegrationLab");
const skins = new SkinStore(
  skinDir,
  path.join(project, "public/integration/skins"),
);
await skins.init();
const folder = new SkinFolder(process.env.LIVEDANCE_SKIN_DIR ? path.join(skinDir, "inbox") : path.join(project,"Mis-skins"), skins, path.join(skinDir,"folder.json"));
await folder.init();
folder.start();
const token = randomBytes(32).toString("hex");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".md": "text/plain; charset=utf-8",
};
const server = http.createServer(async (req, res) => {
  const host = req.headers.host || "";
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host)) {
    res.writeHead(403);
    return res.end("Host rejected");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiktokcdn.com https://*.tiktokcdn.com https://tiktokcdn-us.com https://*.tiktokcdn-us.com https://tiktokcdn-eu.com https://*.tiktokcdn-eu.com https://byteoversea.com https://*.byteoversea.com https://ibytedtos.com https://*.ibytedtos.com; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'",
  );
  let u;
  try {
    u = new URL(req.url, "http://127.0.0.1");
  } catch {
    res.writeHead(400);
    return res.end("Invalid URL");
  }
  if (u.pathname.startsWith("/api/")) {
    const origin = req.headers.origin;
    const sameOrigin = [
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ].includes(origin);
    const mutation = !["GET", "HEAD"].includes(req.method);
    res.setHeader("Content-Type", "application/json");
    const json = (data, status = 200) => {
      res.writeHead(status);
      res.end(JSON.stringify(data));
    };
    if (
      (origin && !sameOrigin) ||
      (mutation && (!sameOrigin || req.headers["x-livedance-token"] !== token))
    )
      return json({ error: "Origin or session rejected" }, 403);
    try {
      if (u.pathname === "/api/live/status" && req.method === "GET") return json({ ...live.status(), diagnosticLog: diagnostics.status() });
      if (u.pathname.startsWith("/api/live/") && req.method === "POST") {
        const b = JSON.parse((await body(req, 2048)).toString());
        if (u.pathname === "/api/live/connect") return json(await live.start(b.username, b.owner));
        if (u.pathname === "/api/live/poll") return json(live.poll(b.owner, b.ack, b.rejected));
        if (u.pathname === "/api/live/disconnect") {
          if (live.owner && b.owner !== live.owner && b.emergency !== true) throw Error("Otra ventana controla el LIVE; sólo F8 puede detenerlo globalmente");
          await live.stop(); return json(live.status());
        }
        return json({ error: "Ruta no encontrada" }, 404);
      }
      if (u.pathname === "/api/skins/folder-status" && req.method === "GET") return json(folder.status());
      if (u.pathname === "/api/skins" && req.method === "GET")
        return json(skins.snapshot());
      const skinBlob = u.pathname.match(/^\/api\/skins\/blob\/([a-f0-9]{64})$/);
      if (skinBlob && ["GET", "HEAD"].includes(req.method)) {
        if (!skins.state.records.some((s) => s.hash === skinBlob[1]))
          return json({ error: "Skin no disponible" }, 404);
        const bytes = await readFile(
          path.join(skinDir, "blobs", skinBlob[1] + ".png"),
        );
        res.setHeader("Content-Type", "image/png");
        return res.end(req.method === "HEAD" ? undefined : bytes);
      }
      if (u.pathname.startsWith("/api/skins/") && req.method === "POST") {
        if (req.headers["content-type"] !== "application/json")
          return json({ error: "JSON requerido" }, 400);
        const b = JSON.parse((await body(req, 1500000)).toString());
        let result;
        if (u.pathname === "/api/skins/folder-config") result = await folder.configure(b);
        else if (u.pathname === "/api/skins/folder-scan") result = await folder.scan(true);
        else if (u.pathname === "/api/skins/import") {
          if (
            typeof b.png !== "string" ||
            b.png.length > 1398104 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(b.png)
          )
            throw Error("PNG codificado inválido");
          result = await skins.import(b, Buffer.from(b.png, "base64"));
        } else if (u.pathname === "/api/skins/delete")
          result = await skins.remove(b.id);
        else if (u.pathname === "/api/skins/random")
          result = await skins.random();
        else if (u.pathname === "/api/skins/assign") {
          if (
            typeof b.viewerId !== "string" ||
            !b.viewerId.trim() ||
            b.viewerId.length > 64 ||
            /[<>\x00-\x1f]/.test(b.viewerId)
          )
            throw Error("viewerId inválido");
          // Stable namespace supports every normalized Phase2 ID without using it as a filesystem path.
          const key = createHash("sha256")
            .update("phase2:" + b.viewerId)
            .digest("hex");
          result = await skins.assign(key, b.name);
          diagnostics.write({ at: Date.now(), component: 'SkinStore', code: 'SKIN_ASSIGNED', viewerKey: key, skinId: result.skinId });
        } else return json({ error: "Ruta no encontrada" }, 404);
        return json({ result, state: skins.snapshot() });
      }
      if (u.pathname === "/api/session" && req.method === "GET")
        return json({ token });
      if (u.pathname === "/api/music") {
        if (req.method === "GET") return json(await library.snapshot());
        if (req.method === "PUT")
          return json(
            await library.update(
              JSON.parse((await body(req, 128 * 1024)).toString()),
            ),
          );
        if (req.method === "DELETE") return json(await library.remove());
      }
      if (u.pathname === "/api/music/import" && req.method === "POST")
        return json(
          await library.import(
            decodeURIComponent(req.headers["x-file-name"] || ""),
            await body(req, limits.file),
          ),
          201,
        );
      if (u.pathname === "/api/music/open-folder" && req.method === "POST") {
        await library.open();
        return json({ ok: true });
      }
      const match = u.pathname.match(
        /^\/api\/music\/([a-f0-9-]{36})(\/audio)?$/,
      );
      if (match?.[2] && ["GET", "HEAD"].includes(req.method))
        return await library.stream(match[1], req, res);
      if (match && !match[2] && req.method === "DELETE")
        return json(await library.remove(match[1]));
      return json({ error: "Not found" }, 404);
    } catch (error) {
      if (!res.headersSent) return json({ error: error.message }, 400);
      res.destroy();
      return;
    }
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end();
  }
  if (u.pathname === "/health") {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        app: "LiveDance",
        version: "0.6.14.1",
        pid: process.pid,
        port,
        root,
      }),
    );
  }
  if (u.pathname === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }
  try {
    const rel = decodeURIComponent(u.pathname);
    const file = path.resolve(root, "." + (rel === "/" ? "/index.html" : rel));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.writeHead(200);
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.on("error", async (err) => {
  console.error(err.message);
  await appendFile(
    path.join(logDir, "server.log"),
    `${new Date().toISOString()} ${err.message}\n`,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`LiveDance v0.6.14.1 · http://127.0.0.1:${port}`),
);

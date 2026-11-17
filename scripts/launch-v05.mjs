import { spawn } from "node:child_process";
import { existsSync, openSync, closeSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  dist = path.join(root, "dist"),
  stateFile = path.join(root, "logs", "launcher.json");
const health = async (port) => {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};
const owned = (h) =>
  h?.app === "LiveDance" &&
  h.version === "0.6.14.1" &&
  h.root?.toLowerCase() === dist.toLowerCase();
await mkdir(path.join(root, "logs"), { recursive: true });
if (process.argv.includes("--stop")) {
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    console.log("No hay un servidor registrado.");
    process.exit(0);
  }
  const h = await health(state.port);
  if (!owned(h) || h.pid !== state.pid) {
    console.log(
      "El servidor registrado ya no está activo; no se detuvo ningún otro proceso.",
    );
    process.exit(0);
  }
  process.kill(h.pid);
  console.log("Servidor LiveDance detenido. Podés cerrar su ventana.");
  process.exit(0);
}
if (!existsSync(path.join(dist, "index.html")))
  throw Error(
    "Falta dist/index.html. Reconstruí el paquete o ejecutá npm run build.",
  );
let port, child, info;
for (let candidate = 5600; candidate <= 5600; candidate++) {
  const existing = await health(candidate);
  if (owned(existing)) {
    port = candidate;
    info = existing;
    break;
  }
  if (existing) continue;
  const out = openSync(path.join(root, "logs", "server.log"), "a");
  child = spawn(process.execPath, [path.join(root, "scripts", "server.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      LIVEDANCE_PORT: String(candidate),
      LIVEDANCE_DATA_DIR: path.join(root, "data-rowshow-polish"),
    },
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  closeSync(out);
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    info = await health(candidate);
    if (owned(info)) {
      port = candidate;
      break;
    }
    if (child.exitCode !== null) break;
  }
  if (port) break;
}
if (!port)
  throw Error(
    "No hay puertos disponibles 5600 (no se cambia de puerto para conservar el origen del perfil). Revisá logs/server.log.",
  );
await writeFile(
  stateFile,
  JSON.stringify({ port, pid: info.pid, started: new Date().toISOString() }),
);
if (process.argv.includes("--smoke")) {
  console.log(
    JSON.stringify({
      smoke: "PASS",
      port,
      pid: info.pid,
      root: info.root,
      version: info.version,
      profile: path.join(root, ".profile-rowshow-polish"),
    }),
  );
  if (child && child.pid === info.pid) process.kill(info.pid);
  process.exit(0);
}
const edge = [
  process.env["ProgramFiles(x86)"],
  process.env.ProgramFiles,
  process.env.LOCALAPPDATA,
]
  .filter(Boolean)
  .map((p) => path.join(p, "Microsoft", "Edge", "Application", "msedge.exe"))
  .find((p) => existsSync(p));
if (!edge)
  throw Error(
    `Microsoft Edge no está instalado. Abrí manualmente http://127.0.0.1:${port} en un navegador WebGL2 o instalá Edge por el canal oficial.`,
  );
const browser = spawn(
  edge,
  [
    `--user-data-dir=${path.join(root, ".profile-rowshow-polish")}`,
    `--app=http://127.0.0.1:${port}${process.argv.includes("--capture") ? "/?clean=1" : "/"}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
  { cwd: root, detached: true, stdio: "ignore", windowsHide: true },
);
browser.unref();
console.log(
  `LiveDance v0.6.14.1 ROW SHOW · http://127.0.0.1:${port}\nPerfil: ${path.join(root, ".profile-rowshow-polish")}\nPara detener el servidor: Detener-RowShowPolish.cmd`,
);
